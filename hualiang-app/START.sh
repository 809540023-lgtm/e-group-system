#!/bin/bash

# 華亮分會 App - 一鍵啟動腳本 (Linux/macOS)

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "================================"
echo "華亮分會 App - 啟動中..."
echo "================================"
echo ""

# 顏色定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 檢查後端虛擬環境
if [ ! -d "$APP_DIR/backend/venv" ]; then
    echo -e "${YELLOW}⚠ 後端虛擬環境不存在，請先運行 SETUP.sh${NC}"
    echo ""
    echo "運行以下命令進行初始設置:"
    echo "  bash $APP_DIR/SETUP.sh"
    echo ""
    exit 1
fi

# 檢查前端依賴
if [ ! -d "$APP_DIR/frontend/node_modules" ]; then
    echo -e "${YELLOW}⚠ 前端依賴不存在，請先運行 SETUP.sh${NC}"
    echo ""
    echo "運行以下命令進行初始設置:"
    echo "  bash $APP_DIR/SETUP.sh"
    echo ""
    exit 1
fi

# 檢查管理後台依賴
if [ ! -d "$APP_DIR/admin/node_modules" ]; then
    echo -e "${YELLOW}⚠ 管理後台依賴不存在，請先運行 SETUP.sh${NC}"
    echo ""
    echo "運行以下命令進行初始設置:"
    echo "  bash $APP_DIR/SETUP.sh"
    echo ""
    exit 1
fi

# 清理之前的進程
echo "清理之前的進程..."
pkill -f "python.*app.py" || true
pkill -f "npm.*run dev" || true
sleep 1

echo ""
echo -e "${BLUE}【1/3】啟動後端服務 (端口 5000)...${NC}"
cd "$APP_DIR/backend"
source venv/bin/activate
python app.py > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "PID: $BACKEND_PID"
sleep 3

echo ""
echo -e "${BLUE}【2/3】啟動前端應用 (端口 5173)...${NC}"
cd "$APP_DIR/frontend"
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "PID: $FRONTEND_PID"
sleep 3

echo ""
echo -e "${BLUE}【3/3】啟動管理後台 (端口 5174)...${NC}"
cd "$APP_DIR/admin"
npm run dev > /tmp/admin.log 2>&1 &
ADMIN_PID=$!
echo "PID: $ADMIN_PID"
sleep 3

echo ""
echo "================================"
echo -e "${GREEN}✓ 所有服務已啟動${NC}"
echo "================================"
echo ""
echo -e "${YELLOW}訪問地址:${NC}"
echo -e "  用戶應用:  ${GREEN}http://localhost:5173${NC}"
echo -e "  管理後台:  ${GREEN}http://localhost:5174${NC}"
echo -e "  後端 API:  ${GREEN}http://localhost:5000${NC}"
echo ""
echo -e "${YELLOW}日誌文件:${NC}"
echo "  後端日誌: /tmp/backend.log"
echo "  前端日誌: /tmp/frontend.log"
echo "  管理日誌: /tmp/admin.log"
echo ""
echo -e "${YELLOW}停止服務:${NC}"
echo "  bash $APP_DIR/STOP.sh"
echo ""
echo -e "${YELLOW}查看日誌:${NC}"
echo "  tail -f /tmp/backend.log   # 後端"
echo "  tail -f /tmp/frontend.log  # 前端"
echo "  tail -f /tmp/admin.log     # 管理"
echo ""

# 保存 PIDs
echo "$BACKEND_PID" > /tmp/app.pids
echo "$FRONTEND_PID" >> /tmp/app.pids
echo "$ADMIN_PID" >> /tmp/app.pids

# 等待用戶中斷
echo -e "${YELLOW}按 Ctrl+C 停止所有服務...${NC}"
trap 'bash "$APP_DIR/STOP.sh"' SIGINT
wait
