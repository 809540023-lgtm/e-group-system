# GitHub + Render 自動部署指南

## 📋 步驟 1：建立 GitHub 倉庫 (5分鐘)

### 1.1 在 GitHub 上建立倉庫
1. 訪問 https://github.com/new
2. 填寫資訊：
   - **Repository name:** `e-group-system`
   - **Description:** `E 組完整庫存管理系統`
   - **Public** ✓ (選擇公開)
   - 不要初始化任何文件！

3. 點擊 **Create repository**

### 1.2 推送代碼
```bash
git remote set-url origin https://github.com/809540023-lgtm/e-group-system.git
git branch -M main
git push -u origin main
```

---

## 📋 步驟 2：在 Render 上部署 (10分鐘)

### 2.1 連接 GitHub 倉庫
1. 訪問 https://dashboard.render.com
2. 用 cia8885@gmail.com 登入
3. 點擊 **New +** → **Web Service**
4. 選擇 **Connect a repository**
5. 選擇 **809540023-lgtm/e-group-system**

### 2.2 部署後端 API (Node.js)

**基本信息：**
- Name: `e-group-backend`
- Environment: `Node`
- Build Command: `cd backend && npm install`
- Start Command: `cd backend && npm start`
- Plan: **Starter** (免費)

**環境變數：**
```
SUPABASE_URL=https://yytohitekvzsowgdzwuj.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliaGhtbWNtaXRuc3Z0eHdjYnNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg0MDAxNCwiZXhwIjoyMDkwNDE2MDE0fQ.sw13wT7XU4DGcK4dl46OKM5dKb8uctqQzbzLjoICEGk
JWT_SECRET=your_secure_random_string_here
PORT=3001
```

點擊 **Create Web Service** → 等待部署完成 (2-3分鐘)

記錄後端 URL: `https://e-group-backend.onrender.com`

### 2.3 部署前端 (Next.js)

1. 點擊 **New +** → **Web Service**
2. 再次選擇同一個倉庫

**基本信息：**
- Name: `e-group-frontend`
- Environment: `Node`
- Build Command: `cd frontend && npm install && npm run build`
- Start Command: `cd frontend && npm start`
- Plan: **Starter**

**環境變數：**
```
NEXT_PUBLIC_API_URL=https://e-group-backend.onrender.com/api
```

點擊 **Create Web Service** → 等待部署 (3-5分鐘)

記錄前端 URL: `https://e-group-frontend.onrender.com`

### 2.4 部署 E 組定時任務 (Python)

1. 點擊 **New +** → **Cron Job**

**基本信息：**
- Name: `e-group-scheduler`
- Language: `Python`
- Build Command: `cd e_group && pip install -r requirements.txt`
- Start Command: `cd e_group && python src/main.py`
- Schedule: `0 0 * * *` (每天午夜)

**環境變數：**
```
GOOGLE_API_KEY=AIzaSyCCdyhppTJPs02GaxqGJzUO_sR06lWFtxY
GOOGLE_DRIVE_FOLDER_ID=agai2_new
SUPABASE_URL=https://yytohitekvzsowgdzwuj.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliaGhtbWNtaXRuc3Z0eHdjYnNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg0MDAxNCwiZXhwIjoyMDkwNDE2MDE0fQ.sw13wT7XU4DGcK4dl46OKM5dKb8uctqQzbzLjoICEGk
OPENAI_API_KEY=你的_OpenAI_key
TELEGRAM_BOT_TOKEN=8376193906:AAG-c8BmIINdNok5xFpv6PfdSM6bZ5jAfe8
TELEGRAM_CHAT_ID=849976863
```

點擊 **Create Cron Job**

---

## ✅ 驗證部署

### 檢查後端
```bash
curl https://e-group-backend.onrender.com/health
# 回應: {"status":"ok","timestamp":"..."}
```

### 訪問前端
```
https://e-group-frontend.onrender.com
```

### 測試登入
- 用戶名: 在 Supabase 中建立或使用測試帳戶
- 密碼: 對應密碼

---

## 🔄 自動部署設置

### 連接 GitHub 到 Render
1. 進入 Render Dashboard
2. 每個服務的設置頁面
3. **Deploy Webhook** 已自動啟用
4. 未來任何 push 到 GitHub 都會自動觸發部署

---

## 🔐 環境變數完整清單

### 後端 API (e-group-backend)
```env
SUPABASE_URL=https://yytohitekvzsowgdzwuj.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...
JWT_SECRET=你的_jwt_密鑰
PORT=3001
```

### 前端 (e-group-frontend)
```env
NEXT_PUBLIC_API_URL=https://e-group-backend.onrender.com/api
```

### E 組定時任務 (e-group-scheduler)
```env
GOOGLE_API_KEY=AIzaSy...
GOOGLE_DRIVE_FOLDER_ID=agai2_new
SUPABASE_URL=https://yytohitekvzsowgdzwuj.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...
OPENAI_API_KEY=sk-...
TELEGRAM_BOT_TOKEN=8376193906:AAG-...
TELEGRAM_CHAT_ID=849976863
```

---

## 📊 部署完成後

### 檢查清單
- [ ] 後端 API 能訪問 (health check)
- [ ] 前端能訪問
- [ ] 能登入系統
- [ ] Supabase 資料庫表已建立
- [ ] 商品管理頁面能加載

### 首次設置
1. 訪問 Supabase 執行 `e_group/src/supabase_schema.sql`
2. 建立初始用戶帳戶
3. 上傳測試商品圖片到 Google Drive

### 系統 URL
- **前端：** https://e-group-frontend.onrender.com
- **後端 API：** https://e-group-backend.onrender.com/api
- **健康檢查：** https://e-group-backend.onrender.com/health

---

## 🆘 故障排查

### 部署失敗
檢查 Render 日誌：
1. 進入服務詳情頁
2. 點擊 **Logs**
3. 查看錯誤信息

### API 連接失敗
- 確認 SUPABASE_URL 和 SERVICE_KEY 正確
- 檢查 Supabase 表是否已建立

### 前端無法加載
- 確認 NEXT_PUBLIC_API_URL 指向正確的後端
- 檢查瀏覽器控制台是否有 CORS 錯誤

---

## 💡 建議

### 優化性能
- 啟用 Render 的自動擴展
- 使用 CDN 加速靜態資源
- 定期檢查日誌和性能指標

### 監控告警
- 在 Render 設置 CPU/記憶體告警
- 在 GitHub Actions 中設置失敗通知
- 在 Telegram 設置系統告警

### 定期維護
- 每月更新依賴
- 每季檢查安全補丁
- 定期備份 Supabase 資料

---

## 📞 支援

- Render 文檔: https://render.com/docs
- GitHub Actions: https://github.com/features/actions
- 本項目文檔: 見 PROJECT_STRUCTURE.md

---

**部署完成後，整個系統將自動運行！** 🚀
