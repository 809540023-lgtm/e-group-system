# 🚀 一鍵部署指南 (使用你的 Render API Token)

我已經為你準備好了完全自動化的部署方案。現在只需 3 步！

---

## ✅ 你已提供的信息

```
✓ Render API Token: rnd_gq4BtbXa54L83rVow891A3ilQ3XA
✓ 代碼已推送到 GitHub
✓ 所有配置已準備
```

---

## 🎯 部署步驟 (3 個簡單點擊)

### 方式 1️⃣：使用 Render Web 界面 (最簡單，5 分鐘)

#### 第 1 步：連接 GitHub

1. 訪問 https://dashboard.render.com
2. 使用 cia8885@gmail.com 登入
3. 點擊左側 **"+ New"** → **"Web Service"**
4. 點擊 **"Connect account"** → 授權 GitHub

#### 第 2 步：部署後端

```
New Web Service
├─ Repository: 809540023-lgtm/e-group-system
├─ Branch: main
├─ Root Directory: hualiang-app/backend
├─ Runtime: Python 3
├─ Build: pip install -r requirements.txt
├─ Start: gunicorn -w 4 -b 0.0.0.0:$PORT app:create_app()
├─ Environment:
│  ├─ FLASK_ENV: production
│  ├─ FLASK_DEBUG: False
│  └─ SECRET_KEY: hualiang-2025-secret-key-production
└─ 點擊【Create Web Service】
```

**等待 3-5 分鐘部署完成**

複製生成的 URL，例如：
```
https://hualiang-api.onrender.com
```

#### 第 3 步：部署前端

```
New Static Site
├─ Repository: 809540023-lgtm/e-group-system
├─ Branch: main
├─ Root Directory: hualiang-app/frontend
├─ Build: npm install && npm run build
├─ Publish: dist
├─ Environment:
│  └─ VITE_API_URL: https://hualiang-api.onrender.com/api
└─ 點擊【Create Static Site】
```

**等待 1-2 分鐘部署完成**

複製生成的 URL，例如：
```
https://hualiang-frontend.onrender.com
```

#### 第 4 步：部署管理後台

```
New Static Site
├─ Repository: 809540023-lgtm/e-group-system
├─ Branch: main
├─ Root Directory: hualiang-app/admin
├─ Build: npm install && npm run build
├─ Publish: dist
├─ Environment:
│  └─ VITE_API_URL: https://hualiang-api.onrender.com/api
└─ 點擊【Create Static Site】
```

**等待 1-2 分鐘部署完成**

複製生成的 URL，例如：
```
https://hualiang-admin.onrender.com
```

---

### 方式 2️⃣：命令行自動部署 (最快，10 秒)

我無法直接自動部署（API 限制），但你可以運行這個命令：

```bash
# 進入項目目錄
cd hualiang-app

# 運行部署腳本
bash deploy.sh

# 按提示輸入：
# 1. Render API Token: rnd_gq4BtbXa54L83rVow891A3ilQ3XA
# 2. GitHub Token: (可選)
# 3. Secret Key: (可選)
```

---

## ✅ 部署完成檢查清單

部署完成後，訪問以下地址確認：

- [ ] **用戶應用** https://hualiang-frontend.onrender.com
  - 應該看到首頁、會員列表、商機卡片

- [ ] **管理後台** https://hauliang-admin.onrender.com
  - 應該看到儀表板、統計數據

- [ ] **API 健康檢查** https://hualiang-api.onrender.com/api/health
  - 應該返回：`{"status": "ok"}`

- [ ] **獲取會員** https://hauliang-api.onrender.com/api/members
  - 應該返回 JSON 格式的會員列表

---

## 🎉 完成！

現在你擁有：

```
📱 用戶應用: https://hauliang-frontend.onrender.com
⚙️ 管理後台: https://hauliang-admin.onrender.com
🔌 API: https://hauliang-api.onrender.com
```

---

## 🔄 後續更新 (自動化)

推送新代碼後，Render 會自動檢測並重新部署！

```bash
# 在本地修改代碼
git add .
git commit -m "你的提交信息"
git push

# Render 自動部署 ✨
```

---

## 🐛 故障排除

### 前端無法連接 API？
1. 確認環境變量 `VITE_API_URL` 正確設置
2. 確認後端已部署並運行
3. 查看 Render 服務日誌

### 部署失敗？
1. 查看 Render Dashboard 的 "Logs" 標籤
2. 確保 GitHub 倉庫是公開的
3. 手動點擊 "Redeploy" 重試

### 數據丟失？
- SQLite 在重新部署時會重置
- 升級到 PostgreSQL 以保持數據

---

## 📞 需要幫助？

如果有任何問題：
1. 查看 Render Dashboard 的實時日誌
2. 檢查環境變量設置
3. 確認所有 URL 都正確

---

**準備好部署了嗎？** 選擇上面的一種方式開始吧！ 🚀

推薦使用 **方式 1 (Web 界面)** - 最簡單直觀！
