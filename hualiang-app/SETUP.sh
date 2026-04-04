#!/bin/bash

# 華亮分會 App - 完整安裝和啟動腳本

set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

echo "================================"
echo "華亮分會 App - 完整設置"
echo "================================"
echo ""

# 顏色定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. 後端設置
echo -e "${BLUE}【1/3】設置後端服務...${NC}"
cd backend

if [ ! -d "venv" ]; then
    echo "  → 建立虛擬環境..."
    python3 -m venv venv
fi

echo "  → 啟用虛擬環境..."
source venv/bin/activate

echo "  → 安裝 Python 依賴..."
pip install -q -r requirements.txt

echo -e "${GREEN}✓ 後端設置完成${NC}"
echo ""

# 2. 前端設置
echo -e "${BLUE}【2/3】設置前端應用...${NC}"
cd ../frontend

if [ ! -d "node_modules" ]; then
    echo "  → 安裝前端依賴 (首次運行會較慢)..."
    npm install -q
else
    echo "  → 前端依賴已安裝"
fi

echo -e "${GREEN}✓ 前端設置完成${NC}"
echo ""

# 3. 管理後台設置
echo -e "${BLUE}【3/3】設置管理後台...${NC}"
cd ../admin

if [ ! -d "node_modules" ]; then
    echo "  → 安裝管理後台依賴 (首次運行會較慢)..."
    npm install -q
else
    echo "  → 管理後台依賴已安裝"
fi

echo -e "${GREEN}✓ 管理後台設置完成${NC}"
echo ""

# 提示啟動信息
echo "================================"
echo -e "${GREEN}✓ 所有依賴已安裝${NC}"
echo "================================"
echo ""
echo -e "${YELLOW}現在請在三個不同的終端窗口執行以下命令:${NC}"
echo ""
echo -e "${BLUE}終端 1 - 啟動後端:${NC}"
echo -e "  cd $APP_DIR/backend"
echo -e "  source venv/bin/activate"
echo -e "  python app.py"
echo ""
echo -e "${BLUE}終端 2 - 啟動前端:${NC}"
echo -e "  cd $APP_DIR/frontend"
echo -e "  npm run dev"
echo ""
echo -e "${BLUE}終端 3 - 啟動管理後台:${NC}"
echo -e "  cd $APP_DIR/admin"
echo -e "  npm run dev"
echo ""
echo -e "${YELLOW}訪問地址:${NC}"
echo -e "  用戶應用:  ${GREEN}http://localhost:5173${NC}"
echo -e "  管理後台:  ${GREEN}http://localhost:5174${NC}"
echo -e "  後端 API:  ${GREEN}http://localhost:5000${NC}"
echo ""
echo -e "${YELLOW}首次啟動後端時會自動建立數據庫和初始化數據${NC}"
echo ""
