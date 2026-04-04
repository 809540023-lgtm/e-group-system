#!/bin/bash

# 華亮分會 App - 停止所有服務

echo "停止所有服務..."

# 停止 Python 進程
pkill -f "python.*app.py" && echo "✓ 後端已停止" || echo "後端未運行"

# 停止 npm 進程
pkill -f "npm.*run dev" && echo "✓ 前端和管理後台已停止" || echo "前端/管理後台未運行"

# 清理 PID 文件
rm -f /tmp/app.pids

echo ""
echo "所有服務已停止"
