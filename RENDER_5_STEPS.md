# 🚀 5 步完成 Render 部署

## 步驟 1️⃣：訪問一個 URL

複製這個整個 URL，在瀏覽器打開：

```
https://dashboard.render.com/new?repo=https://github.com/809540023-lgtm/e-group-system
```

如果打不開，手動方式：
1. 訪問 https://dashboard.render.com
2. 點擊 **New** → **Blueprint**
3. 貼上倉庫：`https://github.com/809540023-lgtm/e-group-system`

---

## 步驟 2️⃣：點擊 Deploy

頁面會自動讀取 `render.yaml` 配置

點擊藍色 **Deploy** 按鈕

---

## 步驟 3️⃣：填環境變數（複製貼上）

系統會要求填寫環境變數，分 3 個服務：

### 服務 1：e-group-backend
```
SUPABASE_URL=https://yytohitekvzsowgdzwuj.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliaGhtbWNtaXRuc3Z0eHdjYnNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg0MDAxNCwiZXhwIjoyMDkwNDE2MDE0fQ.sw13wT7XU4DGcK4dl46OKM5dKb8uctqQzbzLjoICEGk
JWT_SECRET=your_jwt_secret_key_2026
PORT=3001
```

### 服務 2：e-group-frontend
```
NEXT_PUBLIC_API_URL=https://e-group-backend.onrender.com/api
```

### 服務 3：e-group-scheduler
```
GOOGLE_API_KEY=AIzaSyCCdyhppTJPs02GaxqGJzUO_sR06lWFtxY
GOOGLE_DRIVE_FOLDER_ID=agai2_new
SUPABASE_URL=https://yytohitekvzsowgdzwuj.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliaGhtbWNtaXRuc3Z0eHdjYnNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg0MDAxNCwiZXhwIjoyMDkwNDE2MDE0fQ.sw13wT7XU4DGcK4dl46OKM5dKb8uctqQzbzLjoICEGk
OPENAI_API_KEY=sk-your-openai-api-key-here
TELEGRAM_BOT_TOKEN=8376193906:AAG-c8BmIINdNok5xFpv6PfdSM6bZ5jAfe8
TELEGRAM_CHAT_ID=849976863
```

---

## 步驟 4️⃣：等待部署

Render 會自動：
- 下載代碼
- 安裝依賴
- 啟動服務
- 分配 URL

⏱️ 預期時間：5-10 分鐘

---

## 步驟 5️⃣：檢查部署結果

部署完成後，你會看到 3 個服務都是 **Live** ✅

### 訪問你的系統：
- **前端管理平台：** https://e-group-frontend.onrender.com
- **後端 API：** https://e-group-backend.onrender.com/api
- **健康檢查：** https://e-group-backend.onrender.com/health

---

## 🎉 完成！

現在你有：
- ✅ 自動化庫存入倉系統 (E 組)
- ✅ 後台管理 API (Node.js)
- ✅ 前端管理平台 (Next.js)
- ✅ 定時任務 (每天午夜執行)
- ✅ 完全自動部署 (GitHub push 自動更新)

---

## 🆘 如果失敗

1. 檢查 Render 的 Logs
2. 確認環境變數沒有空格或特殊字符
3. 確認 OPENAI_API_KEY 是有效的

---

**現在就開始吧！👉**
https://dashboard.render.com/new?repo=https://github.com/809540023-lgtm/e-group-system
