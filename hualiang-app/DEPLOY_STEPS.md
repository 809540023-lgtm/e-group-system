# 🚀 華亮分會 App - 快速部署到 Render

## ✅ 準備完成

你的代碼已經推送到 GitHub，並已添加所有必要的部署配置。

---

## 📋 5 分鐘快速部署步驟

### 🔐 登入 Render

1. 訪問 [https://render.com](https://render.com)
2. 使用 **cia8885@gmail.com** 登入
3. 進入 Dashboard

---

### 🔗 第 1 步：連接 GitHub 倉庫

1. 點擊 **"New +"** → **"Web Service"**
2. 點擊 **"Connect a repository"**
3. 搜索並選擇 **809540023-lgtm/e-group-system**
4. 授權 Render 訪問你的 GitHub

---

### 🛠️ 第 2 步：部署後端 API

#### 2.1 建立後端服務
```
New Web Service
├─ Name: hualiang-api
├─ Repository: 809540023-lgtm/e-group-system
├─ Branch: main
├─ Root Directory: hualiang-app/backend
└─ Runtime: Python 3
```

#### 2.2 配置構建和啟動
```
Build Command: pip install -r requirements.txt
Start Command: gunicorn -w 4 -b 0.0.0.0:$PORT app:create_app()
```

#### 2.3 添加環境變量
進入 "Environment" 標籤，添加：
```
FLASK_ENV=production
FLASK_DEBUG=False
SECRET_KEY=hualiang-2025-secret-key-change-me-in-production
DATABASE_URL=sqlite:///instance/hualiang.db
```

#### 2.4 部署
點擊 **"Create Web Service"**
- ⏳ 等待 2-5 分鐘部署完成
- 📍 複製生成的 URL，例如：`https://hualiang-api.onrender.com`

---

### 🎨 第 3 步：部署前端應用

#### 3.1 建立前端靜態網站
```
New Static Site
├─ Name: hualiang-frontend
├─ Repository: 809540023-lgtm/e-group-system
├─ Branch: main
└─ Root Directory: hualiang-app/frontend
```

#### 3.2 配置構建
```
Build Command: npm install && npm run build
Publish Directory: dist
```

#### 3.3 添加環境變量
進入 "Environment" 標籤，添加：
```
VITE_API_URL=https://hualiang-api.onrender.com/api
```

#### 3.4 部署
點擊 **"Create Static Site"**
- ⏳ 等待 1-3 分鐘部署完成
- 📍 複製生成的 URL，例如：`https://hualiang-frontend.onrender.com`

---

### ⚙️ 第 4 步：部署管理後台

#### 4.1 建立管理後台靜態網站
```
New Static Site
├─ Name: hualiang-admin
├─ Repository: 809540023-lgtm/e-group-system
├─ Branch: main
└─ Root Directory: hualiang-app/admin
```

#### 4.2 配置構建
```
Build Command: npm install && npm run build
Publish Directory: dist
```

#### 4.3 添加環境變量
進入 "Environment" 標籤，添加：
```
VITE_API_URL=https://hualiang-api.onrender.com/api
```

#### 4.4 部署
點擊 **"Create Static Site"**
- ⏳ 等待 1-3 分鐘部署完成
- 📍 複製生成的 URL，例如：`https://hualiang-admin.onrender.com`

---

## 🎯 部署完成！

### 📍 你的應用地址

| 應用 | URL |
|------|------|
| **用戶應用** | `https://hualiang-frontend.onrender.com` |
| **管理後台** | `https://hualiang-admin.onrender.com` |
| **後端 API** | `https://hualiang-api.onrender.com` |

### ✨ 立即測試
1. 訪問用戶應用 - 查看會員、商機、活動
2. 訪問管理後台 - 管理所有數據
3. 一切正常運作！

---

## 🔄 後續更新流程

每次修改代碼後：

1. **本地修改** → 提交代碼
   ```bash
   git add .
   git commit -m "你的提交信息"
   git push
   ```

2. **Render 自動部署**
   - Render 會自動檢測到 GitHub 更新
   - 自動重新構建和部署
   - 無需手動操作！

---

## 🐛 故障排除

### 前端無法連接 API？
✅ **解決方案:**
- 確認後端已部署並運行
- 檢查環境變量 `VITE_API_URL` 是否正確
- 檢查 CORS 是否在後端啟用（已默認啟用）

### 部署失敗？
✅ **解決方案:**
1. 進入服務頁面 → "Logs" 標籤
2. 查看錯誤信息
3. 常見問題：
   - GitHub 倉庫是否公開？
   - 是否有 `package.json` 或 `requirements.txt`？
   - 端口配置是否正確？

### 數據丟失？
✅ **說明:**
- Render 的免費層在每次部署時重置 SQLite 數據
- 升級到付費層或改用 PostgreSQL 以保持數據

---

## 💰 計費說明

### Render 免費層
- ✅ 免費 Web Service (共享資源，會自動休眠)
- ✅ 免費靜態網站 (無限)
- ❌ 免費數據庫

### 推薦配置
- **開發/測試**: 使用免費層
- **生產環境**: 升級到付費層 ($7-12/月)

---

## 🎓 進階部署

### 使用自定義域名
1. 在 Render 服務設置 → "Custom Domain"
2. 添加你的域名
3. 更新 DNS 記錄（Render 會提供詳細指引）

### 使用 PostgreSQL
1. 在 Render 創建 PostgreSQL 數據庫
2. 複製連接字符串
3. 更新後端環境變量 `DATABASE_URL`
4. 重新部署

### 監控和分析
- Render Dashboard 可查看：
  - 實時日誌
  - CPU/內存使用
  - 請求統計
  - 部署歷史

---

## ✅ 部署檢查清單

- [ ] 登入 Render (cia8885@gmail.com)
- [ ] 後端已部署 (hualiang-api)
- [ ] 前端已部署 (hualiang-frontend)
- [ ] 管理後台已部署 (hualiang-admin)
- [ ] 所有環境變量已設置
- [ ] 前端可訪問並顯示數據
- [ ] 管理後台可訪問
- [ ] API 連接正常

---

## 📞 需要幫助？

- Render 文檔: https://render.com/docs
- GitHub 倉庫: https://github.com/809540023-lgtm/e-group-system
- 本地文檔: 查看 `RENDER_DEPLOY.md`

---

## 🎉 恭喜！

你的華亮分會應用現在已在線運行！

可以：
1. ✅ 與團隊分享應用鏈接
2. ✅ 在管理後台添加真實數據
3. ✅ 監控應用使用情況
4. ✅ 持續改進和更新

祝賀部署成功！🚀

---

**提示**: 如有任何問題，檢查服務的 "Logs" 標籤查看詳細的錯誤信息。
