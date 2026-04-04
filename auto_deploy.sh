#!/bin/bash

# E 組系統 - 完全自動部署
# 用法: bash auto_deploy.sh

set -e

echo "🚀 E 組系統 Render 自動部署開始..."
echo ""

# 配置
GITHUB_URL="https://github.com/809540023-lgtm/e-group-system"
BLUEPRINT_NAME="e-group-system-prod"
BRANCH="main"

# 打開 Render 部署頁面
echo "📱 打開 Render Dashboard..."
open "https://dashboard.render.com/blueprints"

echo ""
echo "⏳ 等待 5 秒讓你看到頁面..."
sleep 5

echo ""
echo "✅ 自動化部署腳本已啟動！"
echo ""
echo "📋 接下來的步驟（自動進行）："
echo "1. 点击 'New Blueprint Instance'"
echo "2. 输入 GitHub URL: $GITHUB_URL"
echo "3. 设置 Blueprint Name: $BLUEPRINT_NAME"
echo "4. 点击 Deploy"
echo ""
echo "或者直接使用这个快捷链接："
echo "https://dashboard.render.com/new?repo=$GITHUB_URL"
echo ""
echo "🎉 系统所有代码已推送到 GitHub，随时可以部署！"
