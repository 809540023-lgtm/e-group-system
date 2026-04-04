#!/bin/bash

# 自動獲取 Render Owner ID

echo "正在查詢你的 Render Owner ID..."
echo ""

# 檢查 .env 文件是否存在
if [ ! -f ".env" ]; then
  echo "未找到 .env 文件"
  echo "建立 .env 文件："
  echo "  cp .env.example .env"
  echo ""
  exit 1
fi

# 從 .env 讀取 API Token
export $(cat .env | grep -v '^#' | xargs)
API_TOKEN="$RENDER_API_TOKEN"

if [ -z "$API_TOKEN" ]; then
  echo "RENDER_API_TOKEN 未設置在 .env 文件中"
  exit 1
fi

# 方法 1: 使用 API
echo "嘗試方法 1: 通過 API 查詢..."
OWNER_ID=$(curl -s -H "Authorization: Bearer $API_TOKEN" \
  https://api.render.com/v1/owners | jq -r '.[0].id // empty' 2>/dev/null)

if [ -n "$OWNER_ID" ]; then
  echo "✓ 找到 Owner ID: $OWNER_ID"
  echo ""
  echo "現在更新 .env 文件："
  echo "  編輯 .env 並設置："
  echo "  RENDER_OWNER_ID=$OWNER_ID"
  exit 0
fi

# 方法 2: 手動輸入
echo ""
echo "無法自動獲取，請手動提供："
echo ""
echo "訪問: https://dashboard.render.com/account"
echo "複製瀏覽器 URL 中的 accountId"
echo ""
read -p "輸入你的 Owner ID: " MANUAL_ID

if [ -n "$MANUAL_ID" ]; then
  echo ""
  echo "現在編輯 .env 文件並設置："
  echo "  RENDER_OWNER_ID=$MANUAL_ID"
  exit 0
else
  echo "✗ Owner ID 不能為空"
  exit 1
fi
