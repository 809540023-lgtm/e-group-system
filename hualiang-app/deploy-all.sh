#!/bin/bash

# 華亮分會 - 完全自動部署腳本
# 用法: bash deploy-all.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}"
echo "================================"
echo "華亮分會 - 完全自動部署"
echo "================================"
echo -e "${NC}\n"

# 檢查必要的工具
echo "檢查環境..."
for cmd in curl jq; do
  if ! command -v $cmd &> /dev/null; then
    echo -e "${RED}✗ 需要 $cmd，請先安裝${NC}"
    exit 1
  fi
done
echo -e "${GREEN}✓ 環境檢查完成${NC}\n"

# 從 .env 文件讀取配置，如果不存在則提示
if [ ! -f ".env" ]; then
  echo -e "${YELLOW}⚠ 未找到 .env 文件${NC}"
  echo ""
  echo "請建立 .env 文件，或複製 .env.example："
  echo "  cp .env.example .env"
  echo ""
  echo "然後編輯 .env 添加："
  echo "  RENDER_API_TOKEN=your_token"
  echo "  RENDER_OWNER_ID=your_owner_id"
  exit 1
fi

# 讀取環境變量
export $(cat .env | grep -v '^#' | xargs)

API_TOKEN="$RENDER_API_TOKEN"
OWNER_ID="$RENDER_OWNER_ID"
REPO="https://github.com/809540023-lgtm/e-group-system.git"
REPO_NAME="e-group-system"
BRANCH="main"

# 驗證必要的配置
if [ -z "$API_TOKEN" ]; then
  echo -e "${RED}✗ RENDER_API_TOKEN 未設置${NC}"
  exit 1
fi

if [ -z "$OWNER_ID" ]; then
  echo -e "${RED}✗ RENDER_OWNER_ID 未設置${NC}"
  echo ""
  echo "請在 .env 文件中設置 RENDER_OWNER_ID"
  echo "從此鏈接獲取: https://dashboard.render.com/account"
  exit 1
fi

echo -e "${GREEN}✓ 配置已加載${NC}\n"

echo ""
echo -e "${BLUE}第 2 步：部署後端 API${NC}"

BACKEND_PAYLOAD=$(cat <<EOF
{
  "name": "hualiang-api",
  "ownerId": "$OWNER_ID",
  "type": "web_service",
  "environmentId": "python3",
  "repo": "$REPO",
  "repoBranch": "$BRANCH",
  "rootDir": "hualiang-app/backend",
  "buildCommand": "pip install -r requirements.txt",
  "startCommand": "gunicorn -w 4 -b 0.0.0.0:\$PORT app:create_app()",
  "envVars": [
    {"key": "FLASK_ENV", "value": "production"},
    {"key": "FLASK_DEBUG", "value": "False"},
    {"key": "SECRET_KEY", "value": "hualiang-2025-secret-key-production"}
  ]
}
EOF
)

BACKEND_RESPONSE=$(curl -s -X POST https://api.render.com/v1/services \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$BACKEND_PAYLOAD")

BACKEND_ID=$(echo $BACKEND_RESPONSE | jq -r '.id // empty')

if [ -n "$BACKEND_ID" ]; then
  echo -e "${GREEN}✓ 後端已提交 (ID: $BACKEND_ID)${NC}"
  API_URL="https://hualiang-api.onrender.com"
else
  echo -e "${RED}✗ 後端部署失敗${NC}"
  echo "Response: $BACKEND_RESPONSE"
  exit 1
fi

echo ""
echo -e "${BLUE}第 3 步：部署前端應用${NC}"

FRONTEND_PAYLOAD=$(cat <<EOF
{
  "name": "hualiang-frontend",
  "ownerId": "$OWNER_ID",
  "type": "static_site",
  "repo": "$REPO",
  "repoBranch": "$BRANCH",
  "rootDir": "hualiang-app/frontend",
  "buildCommand": "npm install && npm run build",
  "publishDirectory": "dist",
  "envVars": [
    {"key": "VITE_API_URL", "value": "$API_URL/api"}
  ]
}
EOF
)

FRONTEND_RESPONSE=$(curl -s -X POST https://api.render.com/v1/services \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$FRONTEND_PAYLOAD")

FRONTEND_ID=$(echo $FRONTEND_RESPONSE | jq -r '.id // empty')

if [ -n "$FRONTEND_ID" ]; then
  echo -e "${GREEN}✓ 前端已提交 (ID: $FRONTEND_ID)${NC}"
  FRONTEND_URL="https://hualiang-frontend.onrender.com"
else
  echo -e "${RED}⚠ 前端部署失敗（繼續...）${NC}"
  echo "Response: $FRONTEND_RESPONSE"
fi

echo ""
echo -e "${BLUE}第 4 步：部署管理後台${NC}"

ADMIN_PAYLOAD=$(cat <<EOF
{
  "name": "hualiang-admin",
  "ownerId": "$OWNER_ID",
  "type": "static_site",
  "repo": "$REPO",
  "repoBranch": "$BRANCH",
  "rootDir": "hualiang-app/admin",
  "buildCommand": "npm install && npm run build",
  "publishDirectory": "dist",
  "envVars": [
    {"key": "VITE_API_URL", "value": "$API_URL/api"}
  ]
}
EOF
)

ADMIN_RESPONSE=$(curl -s -X POST https://api.render.com/v1/services \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$ADMIN_PAYLOAD")

ADMIN_ID=$(echo $ADMIN_RESPONSE | jq -r '.id // empty')

if [ -n "$ADMIN_ID" ]; then
  echo -e "${GREEN}✓ 管理後台已提交 (ID: $ADMIN_ID)${NC}"
  ADMIN_URL="https://hualiang-admin.onrender.com"
else
  echo -e "${RED}⚠ 管理後台部署失敗（繼續...）${NC}"
  echo "Response: $ADMIN_RESPONSE"
fi

echo ""
echo -e "${GREEN}"
echo "================================"
echo "✓ 部署已提交到 Render！"
echo "================================"
echo -e "${NC}"

echo ""
echo -e "${YELLOW}應用 URL：${NC}"
echo "  📱 用戶應用:  $FRONTEND_URL"
echo "  ⚙️ 管理後台:  $ADMIN_URL"
echo "  🔌 後端 API:  $API_URL"

echo ""
echo -e "${YELLOW}構建進度 (5-10 分鐘):${NC}"
echo "  後端:    $BACKEND_ID"
echo "  前端:    $FRONTEND_ID"
echo "  管理後台: $ADMIN_ID"

echo ""
echo -e "${YELLOW}監控部署：${NC}"
echo "  訪問: https://dashboard.render.com"

echo ""
echo -e "${GREEN}完成！應用將在 5-10 分鐘內上線 🚀${NC}"
