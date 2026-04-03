#!/bin/bash

# E 組系統 - Render 完全自動部署腳本
# 使用 Render CLI 自動部署所有服務

set -e

echo "🚀 E 組系統 Render 自動部署"
echo "================================"

# 檢查 CLI
if ! command -v render &> /dev/null; then
    echo "📦 安裝 Render CLI..."
    npm install -g @render-corp/cli
fi

# 登入 Render
echo ""
echo "🔐 登入 Render..."
echo "請在瀏覽器中完成登入"
render login

# 部署後端
echo ""
echo "📡 部署後端 API (e-group-backend)..."
render create --name e-group-backend \
  --type web \
  --repo https://github.com/809540023-lgtm/e-group-system \
  --branch main \
  --runtime node \
  --buildCommand "cd backend && npm install" \
  --startCommand "cd backend && npm start" \
  --plan starter \
  --envVars SUPABASE_URL=https://yytohitekvzsowgdzwuj.supabase.co \
  --envVars SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliaGhtbWNtaXRuc3Z0eHdjYnNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg0MDAxNCwiZXhwIjoyMDkwNDE2MDE0fQ.sw13wT7XU4DGcK4dl46OKM5dKb8uctqQzbzLjoICEGk \
  --envVars JWT_SECRET=your_secure_jwt_secret_2026 \
  --envVars PORT=3001

# 部署前端
echo ""
echo "🎨 部署前端 (e-group-frontend)..."
render create --name e-group-frontend \
  --type web \
  --repo https://github.com/809540023-lgtm/e-group-system \
  --branch main \
  --runtime node \
  --buildCommand "cd frontend && npm install && npm run build" \
  --startCommand "cd frontend && npm start" \
  --plan starter \
  --envVars NEXT_PUBLIC_API_URL=https://e-group-backend.onrender.com/api

# 部署定時任務
echo ""
echo "⏰ 部署 E 組定時任務 (e-group-scheduler)..."
render create --name e-group-scheduler \
  --type background-worker \
  --repo https://github.com/809540023-lgtm/e-group-system \
  --branch main \
  --runtime python-3 \
  --buildCommand "cd e_group && pip install -r requirements.txt" \
  --startCommand "cd e_group && python src/main.py" \
  --schedule "0 0 * * *" \
  --plan starter \
  --envVars GOOGLE_API_KEY=AIzaSyCCdyhppTJPs02GaxqGJzUO_sR06lWFtxY \
  --envVars GOOGLE_DRIVE_FOLDER_ID=agai2_new \
  --envVars SUPABASE_URL=https://yytohitekvzsowgdzwuj.supabase.co \
  --envVars SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliaGhtbWNtaXRuc3Z0eHdjYnNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg0MDAxNCwiZXhwIjoyMDkwNDE2MDE0fQ.sw13wT7XU4DGcK4dl46OKM5dKb8uctqQzbzLjoICEGk \
  --envVars OPENAI_API_KEY=sk-your-openai-key \
  --envVars TELEGRAM_BOT_TOKEN=8376193906:AAG-c8BmIINdNok5xFpv6PfdSM6bZ5jAfe8 \
  --envVars TELEGRAM_CHAT_ID=849976863

echo ""
echo "✅ 部署完成！"
echo ""
echo "前端: https://e-group-frontend.onrender.com"
echo "後端: https://e-group-backend.onrender.com/api"
echo "定時任務: 每天午夜自動執行"
echo ""
