# 📦 Render 部署指南

完整部署華亮分會應用到 Render 的步驟。

## 🔗 第一步：連接 GitHub

1. 訪問 [Render 官網](https://render.com)
2. 使用 cia8885@gmail.com 登入
3. 進入 Dashboard
4. 點擊 "New +" → "Web Service"
5. 選擇 "Connect a repository"
6. 授權連接你的 GitHub 帳號
7. 選擇 `hualiang-app` 倉庫

---

## 🚀 第二步：部署後端 API

### 建立後端服務

1. **New Web Service**
   - Name: `hualiang-api`
   - Repository: 選擇你的 hualiang-app 倉庫
   - Branch: `main`
   - Root Directory: `hualiang-app/backend`

2. **Build & Deploy**
   - Runtime: `Python 3`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn -w 4 -b 0.0.0.0:$PORT app:create_app()`

3. **Environment**
   添加環境變量:
   ```
   FLASK_ENV=production
   FLASK_DEBUG=False
   SECRET_KEY=你的超級密鑰-改這裡-超級密鑰-改這裡
   DATABASE_URL=sqlite:///instance/hualiang.db
   ```

4. **Deploy**
   - 點擊 "Create Web Service"
   - 等待部署完成（約 2-5 分鐘）
   - 複製生成的 URL，例如：`https://hualiang-api.onrender.com`

---

## 🎨 第三步：部署前端應用

### 建立前端靜態網站

1. **New Static Site**
   - Name: `hualiang-frontend`
   - Repository: 選擇你的 hualiang-app 倉庫
   - Branch: `main`
   - Root Directory: `hualiang-app/frontend`

2. **Build**
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`

3. **環境變量**
   ```
   VITE_API_URL=https://hualiang-api.onrender.com/api
   ```

4. **Deploy**
   - 點擊 "Create Static Site"
   - 等待部署完成
   - 獲得前端 URL，例如：`https://hualiang-frontend.onrender.com`

---

## ⚙️ 第四步：部署管理後台

### 建立管理後台靜態網站

1. **New Static Site**
   - Name: `hualiang-admin`
   - Repository: 選擇你的 hualiang-app 倉庫
   - Branch: `main`
   - Root Directory: `hualiang-app/admin`

2. **Build**
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`

3. **環境變量**
   ```
   VITE_API_URL=https://hualiang-api.onrender.com/api
   ```

4. **Deploy**
   - 點擊 "Create Static Site"
   - 等待部署完成
   - 獲得管理後台 URL，例如：`https://hualiang-admin.onrender.com`

---

## 📝 第五步：更新前端 API 配置

部署完成後，更新前端文件連接到正確的 API：

### 前端 (frontend/src/utils/api.js)
```javascript
const API_BASE = import.meta.env.VITE_API_URL || 'https://hualiang-api.onrender.com/api';
```

### 管理後台 (admin/src/utils/api.js)
```javascript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://hualiang-api.onrender.com/api',
});
```

---

## 🔗 訪問你的應用

部署完成後，訪問：

| 應用 | URL |
|------|------|
| 用戶應用 | `https://hualiang-frontend.onrender.com` |
| 管理後台 | `https://hualiang-admin.onrender.com` |
| 後端 API | `https://hualiang-api.onrender.com/api` |

---

## 🚨 常見問題

### 1. 部署失敗？
- 檢查 GitHub 倉庫是否公開
- 確認分支名稱正確
- 查看 "Logs" 標籤查看錯誤信息

### 2. 前端無法連接 API？
- 確認後端 URL 在前端環境變量中正確設置
- 確認 CORS 在後端已啟用

### 3. 數據庫問題？
- Render 上的 SQLite 數據會在重新部署時重置
- 建議升級到 PostgreSQL（付費）以保持數據

### 4. 如何更新應用？
- 在本地修改代碼並推送到 GitHub
- Render 會自動檢測並重新部署

---

## 💡 進階配置

### 使用 PostgreSQL

對於生產環境，建議使用 PostgreSQL：

1. 在 Render 建立 PostgreSQL 數據庫
2. 複製連接字符串
3. 在後端環境變量設置：
   ```
   DATABASE_URL=postgresql://username:password@host:5432/dbname
   ```

### 自定義域名

如果你有自己的域名：

1. 在 Render 服務設置中找到 "Custom Domains"
2. 添加你的域名
3. 更新 DNS 記錄（詳見 Render 文檔）

---

## 📊 監控和日誌

### 查看日誌
1. 進入服務頁面
2. 點擊 "Logs" 標籤
3. 查看實時日誌和錯誤信息

### 性能監控
1. 進入服務頁面
2. 查看 "Metrics" 標籤
3. 監控 CPU、內存、請求等數據

---

## ✅ 部署檢查清單

- [ ] GitHub 倉庫已建立並包含所有代碼
- [ ] 後端服務已部署並正在運行
- [ ] 前端應用已部署並可訪問
- [ ] 管理後台已部署並可訪問
- [ ] 環境變量已正確設置
- [ ] 前端可以連接到後端 API
- [ ] 管理後台可以連接到後端 API
- [ ] 數據庫已初始化並包含示例數據

---

**需要幫助？** 查看 Render 官方文檔：https://render.com/docs

**已完成部署？** 現在可以：
1. 訪問你的應用
2. 在管理後台添加真實數據
3. 分享給團隊使用

祝你部署順利！ 🎉
