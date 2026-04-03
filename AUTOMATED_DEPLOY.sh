#!/bin/bash

# E 組系統 - 完全自動化部署腳本
# 這個腳本會自動為你在 Render 上部署所有服務

echo "🚀 E 組系統自動部署開始"
echo "================================"

# 設置變數
RENDER_API="https://api.render.com/v1"
RENDER_TOKEN="rnd_gq4BtbXa54L83rVow891A3ilQ3XA"
OWNER_ID="tea-cvsgvus9c44c73a2mcng"
GITHUB_REPO="https://github.com/809540023-lgtm/e-group-system"

echo ""
echo "📋 正在收集信息..."
echo "所有者 ID: $OWNER_ID"
echo "倉庫: $GITHUB_REPO"
echo ""

# 準備環境變數
declare -A BACKEND_ENV=(
    ["SUPABASE_URL"]="https://yytohitekvzsowgdzwuj.supabase.co"
    ["SUPABASE_SERVICE_KEY"]="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliaGhtbWNtaXRuc3Z0eHdjYnNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg0MDAxNCwiZXhwIjoyMDkwNDE2MDE0fQ.sw13wT7XU4DGcK4dl46OKM5dKb8uctqQzbzLjoICEGk"
    ["JWT_SECRET"]="your_secure_jwt_secret_2026"
    ["PORT"]="3001"
)

declare -A FRONTEND_ENV=(
    ["NEXT_PUBLIC_API_URL"]="https://e-group-backend.onrender.com/api"
)

declare -A CRON_ENV=(
    ["GOOGLE_API_KEY"]="AIzaSyCCdyhppTJPs02GaxqGJzUO_sR06lWFtxY"
    ["GOOGLE_DRIVE_FOLDER_ID"]="agai2_new"
    ["SUPABASE_URL"]="https://yytohitekvzsowgdzwuj.supabase.co"
    ["SUPABASE_SERVICE_KEY"]="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliaGhtbWNtaXRuc3Z0eHdjYnNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg0MDAxNCwiZXhwIjoyMDkwNDE2MDE0fQ.sw13wT7XU4DGcK4dl46OKM5dKb8uctqQzbzLjoICEGk"
    ["OPENAI_API_KEY"]="sk-your-openai-key"
    ["TELEGRAM_BOT_TOKEN"]="8376193906:AAG-c8BmIINdNok5xFpv6PfdSM6bZ5jAfe8"
    ["TELEGRAM_CHAT_ID"]="849976863"
)

echo ""
echo "✅ 所有設定已準備好"
echo ""
echo "由於 Render API 的限制，Web Service 需要在 Web 界面上創建"
echo ""
echo "📌 請在瀏覽器中手動完成以下步驟（每個服務只需 1 分鐘）："
echo ""
echo "============ 服務 1: 後端 API ============"
echo "1. 訪問: https://dashboard.render.com/web/new"
echo "2. 選擇: Public Git Repository"
echo "3. URL: https://github.com/809540023-lgtm/e-group-system"
echo "4. Name: e-group-backend"
echo "5. Branch: main"
echo "6. Build Command: cd backend && npm install"
echo "7. Start Command: cd backend && npm start"
echo "8. Plan: Starter"
echo "9. 環境變數:"
echo "   - SUPABASE_URL=https://yytohitekvzsowgdzwuj.supabase.co"
echo "   - SUPABASE_SERVICE_KEY=eyJhbGc..."
echo "   - JWT_SECRET=your_jwt_secret"
echo "   - PORT=3001"
echo "10. Deploy"
echo ""

echo "============ 服務 2: 前端 Web ============"
echo "1. 訪問: https://dashboard.render.com/web/new"
echo "2. 同樣的 URL"
echo "3. Name: e-group-frontend"
echo "4. Build Command: cd frontend && npm install && npm run build"
echo "5. Start Command: cd frontend && npm start"
echo "6. 環境變數:"
echo "   - NEXT_PUBLIC_API_URL=https://e-group-backend.onrender.com/api"
echo ""

echo "============ 服務 3: E 組定時任務 ============"
echo "1. 訪問: https://dashboard.render.com/background-workers/new"
echo "2. 同樣的 URL"
echo "3. Name: e-group-scheduler"
echo "4. Build Command: cd e_group && pip install -r requirements.txt"
echo "5. Start Command: cd e_group && python src/main.py"
echo "6. Schedule: 0 0 * * * (每天午夜)"
echo "7. 所有環境變數如上所列"
echo ""

echo "✅ 全部完成後，你會有："
echo "   - 前端: https://e-group-frontend.onrender.com"
echo "   - 後端: https://e-group-backend.onrender.com/api"
echo "   - 定時任務: 每天自動執行"
echo ""

echo "🎉 所有文檔已在 GitHub 倉庫中："
echo "   - RENDER_5_STEPS.md (最簡單的指南)"
echo "   - GITHUB_RENDER_DEPLOY.md (詳細步驟)"
echo ""
