# 🚀 E 組系統 - 一鍵部署指南

## 最簡單的方式：使用 Render 的 Blueprint 部署

Render 支持通過 `render.yaml` 自動部署整個應用棧。

### 1️⃣ 只需點擊這個按鈕：

訪問這個 URL（我已為你準備）：

```
https://dashboard.render.com/new?repo=https://github.com/809540023-lgtm/e-group-system
```

或者手動步驟：

### 2️⃣ 在 Render Dashboard 上：

1. 訪問：https://dashboard.render.com
2. 點擊：**New** → **Blueprint**
3. 選擇倉庫：**809540023-lgtm/e-group-system**
4. 點擊：**Deploy**

---

## 環境變數配置

當 Render 詢問環境變數時，填入以下信息：

### 後端 (e-group-backend)
```
SUPABASE_URL = https://yytohitekvzsowgdzwuj.supabase.co
SUPABASE_SERVICE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliaGhtbWNtaXRuc3Z0eHdjYnNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg0MDAxNCwiZXhwIjoyMDkwNDE2MDE0fQ.sw13wT7XU4DGcK4dl46OKM5dKb8uctqQzbzLjoICEGk
JWT_SECRET = your_jwt_secret_key_2026
PORT = 3001
```

### 前端 (e-group-frontend)
```
NEXT_PUBLIC_API_URL = https://e-group-backend.onrender.com/api
```

### E 組定時任務 (e-group-scheduler)
```
GOOGLE_API_KEY = AIzaSyCCdyhppTJPs02GaxqGJzUO_sR06lWFtxY
GOOGLE_DRIVE_FOLDER_ID = agai2_new
SUPABASE_URL = https://yytohitekvzsowgdzwuj.supabase.co
SUPABASE_SERVICE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliaGhtbWNtaXRuc3Z0eHdjYnNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg0MDAxNCwiZXhwIjoyMDkwNDE2MDE0fQ.sw13wT7XU4DGcK4dl46OKM5dKb8uctqQzbzLjoICEGk
OPENAI_API_KEY = sk-your-openai-key
TELEGRAM_BOT_TOKEN = 8376193906:AAG-c8BmIINdNok5xFpv6PfdSM6bZ5jAfe8
TELEGRAM_CHAT_ID = 849976863
```

---

## ⏱️ 預期時間

- 配置環境變數：2分鐘
- 部署 3 個服務：5-10分鐘
- **總計：不超過 15 分鐘！**

---

## ✅ 部署完成後

1. 訪問前端：https://e-group-frontend.onrender.com
2. 檢查後端：https://e-group-backend.onrender.com/health
3. 登入系統（使用 Supabase 中的用戶帳號）

---

## 🔄 未來更新

任何 GitHub 推送都會自動觸發部署。完全自動化！

---

**準備好了嗎？點擊這個按鈕開始：**
https://dashboard.render.com/new?repo=https://github.com/809540023-lgtm/e-group-system
