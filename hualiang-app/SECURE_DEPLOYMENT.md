# 🔐 安全部署指南

## ⚠️ 安全提醒

你的 Render API 密鑰是敏感信息，**千萬不要**：
- ❌ 將密鑰提交到 GitHub
- ❌ 在公開場所分享密鑰
- ❌ 在代碼中硬編碼密鑰
- ❌ 在聊天或郵件中發送密鑰

## ✅ 安全步驟

### 1️⃣ 獲取 Render API 密鑰

1. 訪問 https://dashboard.render.com/account/api-tokens
2. 點擊 **"Create API Token"**
3. 給予名稱（例如：`deployment-token`）
4. 複製生成的密鑰

### 2️⃣ 創建 .env 文件

在 `hualiang-app` 目錄中：

```bash
cp .env.example .env
```

### 3️⃣ 編輯 .env 文件

使用你的編輯器打開 `.env`：

```bash
nano .env
# 或
vim .env
# 或使用你喜歡的編輯器
```

填入你的密鑰和 Owner ID：

```
RENDER_API_TOKEN=your_actual_token_here
RENDER_OWNER_ID=your_actual_owner_id_here
```

### 4️⃣ 獲取 Owner ID

#### 方式 A：從 Dashboard URL

1. 訪問 https://dashboard.render.com/account
2. 查看瀏覽器 URL
3. 複製 `accountId=` 後面的 ID

URL 格式例子：
```
https://dashboard.render.com/account?accountId=u1234567890abcdefg
```

複製 `u1234567890abcdefg` 這個部分

#### 方式 B：使用自動查詢腳本

```bash
bash get-owner-id.sh
```

腳本會嘗試自動查詢，或提示手動輸入

### 5️⃣ 安裝部署依賴

```bash
pip3 install -r requirements-deploy.txt
```

### 6️⃣ 運行部署

```bash
python3 auto_deploy.py
```

或使用 Bash 腳本：

```bash
bash deploy-all.sh
```

## 🔍 驗證安全性

### 確認 .env 被忽略

```bash
git status
```

應該 **不會** 看到 `.env` 在列表中

### 確認密鑰未提交

```bash
git log --all --full-history -- .env
```

應該返回空結果

## 🛡️ 如果密鑰被洩露

1. **立即撤銷密鑰**
   - 訪問 https://dashboard.render.com/account/api-tokens
   - 刪除泄露的密鑰

2. **生成新密鑰**
   - 點擊 **"Create API Token"**
   - 複製新密鑰

3. **更新 .env 文件**
   ```bash
   nano .env
   # 替換 RENDER_API_TOKEN 為新密鑰
   ```

## 📝 .env 文件結構

```
# Render API 配置
# 從 https://dashboard.render.com/account/api-tokens 獲取
RENDER_API_TOKEN=your_render_api_token_here

# Render Owner ID
# 從 https://dashboard.render.com/account 的 URL 中獲取
RENDER_OWNER_ID=your_owner_id_here
```

## ✨ 完成

現在你可以安全地運行部署了！

```bash
python3 auto_deploy.py
```

🚀 祝部署成功！
