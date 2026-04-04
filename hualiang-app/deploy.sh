#!/bin/bash

# 華亮分會 App - 完全自動部署腳本
# 這個腳本會自動部署所有服務到 Render

set -e

echo "================================"
echo "華亮分會 - 自動部署腳本"
echo "================================"
echo ""

# 顏色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# 檢查必要的工具
echo -e "${BLUE}檢查環境...${NC}"

if ! command -v curl &> /dev/null; then
    echo -e "${RED}❌ 需要 curl，請先安裝${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 環境檢查完成${NC}"
echo ""

# 讀取 Render API Token
echo -e "${YELLOW}需要以下信息來進行部署:${NC}"
echo ""
echo "1️⃣ 獲取 Render API Token:"
echo "   訪問: https://dashboard.render.com/account/api-tokens"
echo "   建立新的 API Token 並複製"
echo ""
read -p "請輸入你的 Render API Token: " RENDER_API_TOKEN

if [ -z "$RENDER_API_TOKEN" ]; then
    echo -e "${RED}❌ API Token 不能為空${NC}"
    exit 1
fi

echo ""
echo "2️⃣ GitHub 倉庫信息:"
echo "   倉庫: 809540023-lgtm/e-group-system"
echo ""

read -p "請輸入你的 GitHub Token (用於自動部署): " GITHUB_TOKEN

if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}❌ GitHub Token 不能為空${NC}"
    exit 1
fi

echo ""
echo "3️⃣ 後端密鑰:"
read -p "請輸入 Flask Secret Key (建議使用複雜密碼): " FLASK_SECRET_KEY

if [ -z "$FLASK_SECRET_KEY" ]; then
    FLASK_SECRET_KEY="hualiang-2025-secret-key-$(date +%s)"
    echo -e "${YELLOW}使用自動生成的密鑰: $FLASK_SECRET_KEY${NC}"
fi

echo ""
echo "================================"
echo -e "${BLUE}開始部署...${NC}"
echo "================================"
echo ""

# 部署後端 API
echo -e "${BLUE}【1/3】部署後端 API...${NC}"

BACKEND_RESPONSE=$(curl -s -X POST https://api.render.com/v1/services \
  -H "Authorization: Bearer $RENDER_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "hualiang-api",
    "repo": "https://github.com/809540023-lgtm/e-group-system.git",
    "branch": "main",
    "rootDir": "hualiang-app/backend",
    "envVars": [
      {"key": "FLASK_ENV", "value": "production"},
      {"key": "FLASK_DEBUG", "value": "False"},
      {"key": "SECRET_KEY", "value": "'"$FLASK_SECRET_KEY"'"}
    ]
  }')

BACKEND_ID=$(echo $BACKEND_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$BACKEND_ID" ]; then
    echo -e "${RED}❌ 後端部署失敗${NC}"
    echo "Response: $BACKEND_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ 後端已提交部署 (ID: $BACKEND_ID)${NC}"
echo "  稍候自動構建..."
sleep 3

echo ""

# 部署前端應用
echo -e "${BLUE}【2/3】部署前端應用...${NC}"

FRONTEND_RESPONSE=$(curl -s -X POST https://api.render.com/v1/services \
  -H "Authorization: Bearer $RENDER_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "hualiang-frontend",
    "repo": "https://github.com/809540023-lgtm/e-group-system.git",
    "branch": "main",
    "rootDir": "hualiang-app/frontend",
    "buildCommand": "npm install && npm run build",
    "envVars": [
      {"key": "VITE_API_URL", "value": "https://hualiang-api.onrender.com/api"}
    ]
  }')

FRONTEND_ID=$(echo $FRONTEND_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$FRONTEND_ID" ]; then
    echo -e "${RED}❌ 前端部署失敗${NC}"
    echo "Response: $FRONTEND_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ 前端已提交部署 (ID: $FRONTEND_ID)${NC}"
echo "  稍候自動構建..."
sleep 3

echo ""

# 部署管理後台
echo -e "${BLUE}【3/3】部署管理後台...${NC}"

ADMIN_RESPONSE=$(curl -s -X POST https://api.render.com/v1/services \
  -H "Authorization: Bearer $RENDER_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "hualiang-admin",
    "repo": "https://github.com/809540023-lgtm/e-group-system.git",
    "branch": "main",
    "rootDir": "hualiang-app/admin",
    "buildCommand": "npm install && npm run build",
    "envVars": [
      {"key": "VITE_API_URL", "value": "https://hualiang-api.onrender.com/api"}
    ]
  }')

ADMIN_ID=$(echo $ADMIN_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$ADMIN_ID" ]; then
    echo -e "${RED}❌ 管理後台部署失敗${NC}"
    echo "Response: $ADMIN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ 管理後台已提交部署 (ID: $ADMIN_ID)${NC}"
echo "  稍候自動構建..."

echo ""
echo "================================"
echo -e "${GREEN}✓ 所有服務已提交到 Render！${NC}"
echo "================================"
echo ""
echo -e "${YELLOW}服務構建中... (通常需要 5-10 分鐘)${NC}"
echo ""
echo "服務 ID："
echo "  後端:    $BACKEND_ID"
echo "  前端:    $FRONTEND_ID"
echo "  管理後台: $ADMIN_ID"
echo ""
echo "查看部署進度："
echo "  訪問 https://dashboard.render.com"
echo ""
echo -e "${YELLOW}部署完成後，將生成以下 URL:${NC}"
echo "  用戶應用:  https://hualiang-frontend.onrender.com"
echo "  管理後台:  https://hualiang-admin.onrender.com"
echo "  後端 API:  https://hualiang-api.onrender.com/api"
echo ""
echo -e "${GREEN}祝賀！部署已開始！ 🎉${NC}"
