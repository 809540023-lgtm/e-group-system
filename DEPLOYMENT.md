# E 組系統部署指南

## 🚀 快速部署

### 本地開發環境

#### 1. 克隆或準備項目
```bash
cd nostalgic-jackson
```

#### 2. 配置環境變數
複製 `.env.example` 到 `.env` 並填寫實際值：
```bash
cp .env.example .env
```

編輯 `.env` 檔案：
```env
# Google
GOOGLE_API_KEY=your_google_api_key
GOOGLE_DRIVE_FOLDER_ID=agai2_new

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
DATABASE_PASSWORD=your_db_password

# OpenAI
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4o-mini

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Backend
PORT=3001
JWT_SECRET=your_very_secure_random_string_here
```

#### 3. 安裝依賴

**E 組 (Python):**
```bash
cd e_group
python -m venv venv
source venv/bin/activate  # macOS/Linux
# 或
venv\Scripts\activate     # Windows

pip install -r requirements.txt
```

**後端 (Node.js):**
```bash
cd ../backend
npm install
```

**前端 (Next.js):**
```bash
cd ../frontend
npm install
```

#### 4. 初始化資料庫

在 Supabase dashboard 執行以下步驟：
1. 進入 SQL Editor
2. 新建 query
3. 複製 `e_group/src/supabase_schema.sql` 的內容
4. 執行

或使用 Supabase CLI:
```bash
supabase db push
```

#### 5. 啟動開發服務

打開 3 個終端窗口：

**終端 1 - E 組：**
```bash
cd e_group
source venv/bin/activate
python src/main.py
```

**終端 2 - 後端 API：**
```bash
cd backend
npm run dev
```

**終端 3 - 前端：**
```bash
cd frontend
npm run dev
```

訪問：
- 前端: http://localhost:3000
- 後端 API: http://localhost:3001/api
- 健康檢查: http://localhost:3001/health

---

## 🐳 Docker 部署

### 建立 Docker 映像

**後端 Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --only=production

COPY backend/src ./src

ENV PORT=3001
EXPOSE 3001

CMD ["node", "src/server.js"]
```

**前端 Dockerfile:**
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

EXPOSE 3000

CMD ["npm", "start"]
```

### 使用 Docker Compose

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY}
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - supabase

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001/api

  e-group:
    build: ./e_group
    environment:
      GOOGLE_API_KEY: ${GOOGLE_API_KEY}
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
```

---

## ☁️ Render 部署

### 後端部署

1. 連接 GitHub 倉庫
2. 建立新的 Web Service
3. 配置：
   - **Build Command:** `cd backend && npm install`
   - **Start Command:** `cd backend && npm start`
   - **Environment Variables:**
     ```
     SUPABASE_URL=...
     SUPABASE_SERVICE_KEY=...
     JWT_SECRET=...
     ```

4. 部署

### 前端部署

1. 建立新的 Static Site
2. 配置：
   - **Build Command:** `cd frontend && npm run build`
   - **Publish Directory:** `frontend/.next`
   - **Environment Variables:**
     ```
     NEXT_PUBLIC_API_URL=https://your-backend.onrender.com/api
     ```

3. 部署

### E 組定時任務

1. 建立新的 Cron Job
2. 配置：
   - **Build Command:** `cd e_group && pip install -r requirements.txt`
   - **Start Command:** `cd e_group && python src/main.py`
   - **Schedule:** `0 0 * * *` (每天午夜)

---

## 🔒 生產環境檢查清單

### 安全性
- [ ] 修改所有預設密碼
- [ ] 使用強密碼和複雜 JWT_SECRET
- [ ] 啟用 HTTPS
- [ ] 設置 CORS 白名單
- [ ] 隱藏敏感的錯誤信息
- [ ] 啟用請求限流 (rate limiting)
- [ ] 使用環境變數管理所有機密

### 性能
- [ ] 啟用前端資源的 gzip 壓縮
- [ ] 設置 CDN
- [ ] 優化資料庫查詢
- [ ] 啟用 Redis 快取
- [ ] 監控 API 響應時間

### 可靠性
- [ ] 備份資料庫
- [ ] 設置監控和告警
- [ ] 配置日誌收集
- [ ] 測試故障轉移
- [ ] 製定災難恢復計畫

### 合規性
- [ ] 符合資料保護法規
- [ ] 記錄用戶操作審計日誌
- [ ] 隱私政策和服務條款
- [ ] 加密敏感資料

---

## 📊 監控和日誌

### 應用監控
```bash
# 檢查後端狀態
curl http://localhost:3001/health

# 檢查日誌
tail -f backend/logs/combined.log
tail -f e_group/logs/e_group_*.log
```

### 警告設置
在 Render dashboard 中：
1. 進入 Services
2. 選擇服務
3. 配置 Alerts:
   - 高 CPU 使用率
   - 高記憶體使用率
   - 頻繁重啟

### Sentry 集成 (可選)

```javascript
// backend/src/server.js
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: process.env.SENTRY_DSN,
});

app.use(Sentry.Handlers.errorHandler());
```

---

## 🔄 更新和維護

### 升級依賴
```bash
# E 組
cd e_group
pip install --upgrade -r requirements.txt

# 後端
cd backend
npm update

# 前端
cd frontend
npm update
```

### 零停機部署
1. 部署新版本到暫存環境
2. 執行煙霧測試
3. 使用藍綠部署切換流量
4. 監控錯誤率
5. 需要時回滾

### 備份策略
```bash
# 備份 Supabase 資料
pg_dump -h db.example.supabase.co -U postgres > backup.sql

# 定期備份（每天）
0 2 * * * /path/to/backup.sh
```

---

## 🆘 故障排查

### 服務無法啟動
```bash
# 檢查環境變數
env | grep SUPABASE
env | grep OPENAI

# 檢查埠佔用
lsof -i :3001
lsof -i :3000

# 清除緩存重新安裝
rm -rf node_modules package-lock.json
npm install
```

### API 連接失敗
```bash
# 測試 Supabase 連接
curl -X GET https://your-project.supabase.co/rest/v1/ \
  -H "apikey: your_key"

# 測試 OpenAI API
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer sk-..."
```

### 資料庫錯誤
```bash
# 檢查資料庫狀態
SELECT * FROM pg_stat_activity;

# 清理過期連接
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE state = 'idle' AND query_start < now() - interval '1 hour';
```

---

## 📞 取得協助

- 查閱各模組 README.md
- 檢查日誌檔案
- GitHub Discussions
- Render 支援

---

**最後更新:** 2026-04-03
**版本:** 1.0.0 Release
