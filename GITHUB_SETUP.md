# 🚀 GitHub 自動部署設置（一次性）

你的應用已設置為完全自動部署！只需做這 3 個步驟一次，之後永遠自動。

## 📋 一次性設置

### 1️⃣ 獲取 Render API 密鑰

訪問：https://dashboard.render.com/account/api-tokens

- 點擊 **"Create API Token"**
- 給予名稱（例如：`github-deployment`）
- 複製生成的密鑰

### 2️⃣ 獲取 Owner ID

訪問：https://dashboard.render.com/account

- 查看瀏覽器 URL
- 複製 `accountId=` 後的 ID
- 例如：`https://dashboard.render.com/account?accountId=u1234567890`

### 3️⃣ 在 GitHub 中添加 Secrets

訪問：https://github.com/809540023-lgtm/e-group-system/settings/secrets/actions

點擊 **"New repository secret"**，添加兩個：

**Secret 1:**
- Name: `RENDER_API_TOKEN`
- Value: 粘貼你的 API 密鑰

**Secret 2:**
- Name: `RENDER_OWNER_ID`
- Value: 粘貼你的 Owner ID

點擊 **"Add secret"** 保存

## ✅ 完成！

現在你只需：

```bash
git push origin main
```

GitHub 會自動：
- ✅ 檢測到代碼更新
- ✅ 觸發自動部署 workflow
- ✅ 部署到 Render
- ✅ 一切完全在雲端

## 📊 監控部署

### GitHub 中查看部署進度

1. 訪問：https://github.com/809540023-lgtm/e-group-system/actions
2. 查看最新的 workflow 運行
3. 看到 ✅ 表示成功

### Render 中查看服務

訪問：https://dashboard.render.com

查看三個服務的狀態：
- `hualiang-api` (後端)
- `hualiang-frontend` (前端)
- `hualiang-admin` (管理後台)

## 🎯 從現在開始

每次你要部署新代碼：

```bash
git add .
git commit -m "你的更改說明"
git push origin main
```

就這樣！完全自動，無需手動操作。

---

**祝賀！你的應用現在有完全自動化的雲端部署！** 🚀
