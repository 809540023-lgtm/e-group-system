# 🚀 E 組系統 - 快速開始指南

## 📋 5 分鐘快速上手

### 第 1 步：環境配置 (2 分鐘)
```bash
# 複製環境變數模板
cp .env.example .env

# 在 .env 中填寫以下關鍵信息：
# - GOOGLE_API_KEY
# - SUPABASE_URL 和 SUPABASE_SERVICE_KEY
# - OPENAI_API_KEY
# - TELEGRAM_BOT_TOKEN 和 TELEGRAM_CHAT_ID
```

### 第 2 步：安裝依賴 (2 分鐘)
```bash
# E 組
cd e_group && pip install -r requirements.txt && cd ..

# 後端
cd backend && npm install && cd ..

# 前端
cd frontend && npm install && cd ..
```

### 第 3 步：啟動服務 (1 分鐘)
```bash
# 開啟 3 個終端窗口

# 終端 1: E 組
cd e_group
python src/main.py

# 終端 2: 後端
cd backend
npm run dev

# 終端 3: 前端
cd frontend
npm run dev
```

✅ 完成！訪問 http://localhost:3000

---

## 🎯 常見工作流程

### 工作流 1: 處理新入倉商品

```bash
# 1. 確保 Google Drive 有新圖片在 agai2_new/YYYYMMDD/ 資料夾

# 2. 運行 E 組自動處理
python e_group/src/main.py

# 3. 檢查 Telegram 通知（會收到摘要）

# 4. 登入 Web 平台審核商品
# http://localhost:3000
# 用戶名：(你設置的)
# 密碼：(你設置的)

# 5. 進入「商品管理」頁面審核待審核商品

# 6. 批准後商品可上架
```

### 工作流 2: 批量上架商品

```bash
# 1. 登入系統
# 進入「平台上架」頁面

# 2. 選擇已批准的商品
# 勾選要上架的商品

# 3. 選擇平台
# □ Facebook Marketplace
# □ Threads
# □ 蝦皮

# 4. 點擊「批量上架」
# 系統會自動生成行銷文案並上架

# 5. 監控狀態
# 進入「銷售追蹤」查看在線商品
```

### 工作流 3: 追蹤銷售

```bash
# 1. 進入「銷售追蹤」頁面

# 2. 查看已銷售商品清單
# 篩選：全部 / 待付款 / 已付款 / 已發貨 / 已完成

# 3. 對於已銷售商品
# - 記錄買家信息
# - 更新付款狀態
# - 追蹤發貨狀態

# 4. 查看統計
# 進入「儀表板」查看：
# - 今日銷售額
# - 按平台銷售統計
# - 平均商品價格
```

### 工作流 4: 管理用戶和權限

```bash
# 1. 以 admin 身份登入

# 2. 進入「用戶管理」頁面

# 3. 建立新用戶
# 名稱: 審核員 A
# 角色: reviewer
# 權限: 審核商品

# 4. 設置用戶角色
# - admin: 完全權限
# - reviewer: 審核商品
# - manager: 上架和銷售
# - user: 只讀

# 5. 監控用戶活動
# 查看每個用戶的操作記錄
```

---

## 🔑 重要概念

### 商品狀態流程
```
新入倉 → 待審核 (pending)
         ↓
    批准 (approved) ← 拒絕 (rejected)
         ↓
    等待上架
         ↓
    在線上架 (active)
         ↓
    已銷售 (sold)
```

### 用戶角色
| 角色 | 功能 | 用途 |
|------|------|------|
| admin | 完全管理 | 系統管理員 |
| reviewer | 審核商品 | 審核團隊 |
| manager | 上架銷售 | 銷售團隊 |
| user | 只讀 | 客戶端查看 |

### 平台支持
- Facebook Marketplace
- Threads
- 蝦皮
- 可擴展更多平台

---

## 📊 儀表板快速查看

### 首頁 (Dashboard)
- **總商品數** - 系統中所有商品
- **待審核** - 需要人工確認的
- **已批准** - 可以上架的
- **已銷售** - 成功交易的

### 銷售統計
- **總銷售額** - 所有已銷售商品的收入
- **平台分佈** - 各平台銷售比例
- **平均價格** - 商品平均售價
- **趨勢圖** - 銷售走勢

---

## ⚙️ 配置檢查清單

### E 組配置 (e_group/src/config.py)
- [ ] GOOGLE_API_KEY - Google Drive API
- [ ] SUPABASE_URL - Supabase 專案 URL
- [ ] SUPABASE_SERVICE_KEY - Supabase 服務密鑰
- [ ] OPENAI_API_KEY - OpenAI API
- [ ] TELEGRAM_BOT_TOKEN - Telegram 機器人
- [ ] TELEGRAM_CHAT_ID - Telegram 通知群組

### 後端配置 (.env)
- [ ] PORT - API 服務埠 (預設 3001)
- [ ] JWT_SECRET - 用戶認證密鑰
- [ ] SUPABASE_* - Supabase 連接資訊

### 前端配置 (frontend/.env.local)
- [ ] NEXT_PUBLIC_API_URL - 後端 API 地址

---

## 🆘 快速故障排查

### 問題: 無法登入
```bash
# 檢查：
# 1. 後端是否啟動 (http://localhost:3001/health)
# 2. 用戶是否存在（在資料庫中）
# 3. 密碼是否正確
```

### 問題: 商品無法識別
```bash
# 檢查：
# 1. OPENAI_API_KEY 是否有效
# 2. 帳戶額度是否充足
# 3. 圖片是否清晰
# 4. 查看 e_group/logs/ 中的詳細日誌
```

### 問題: Telegram 消息未收到
```bash
# 檢查：
# 1. TELEGRAM_BOT_TOKEN 是否正確
# 2. TELEGRAM_CHAT_ID 是否正確
# 3. 運行 python test_telegram.py 測試
```

### 問題: 資料庫連接失敗
```bash
# 檢查：
# 1. SUPABASE_URL 和 SERVICE_KEY 是否正確
# 2. Supabase 專案是否在線
# 3. 表是否已建立（執行 supabase_schema.sql）
```

---

## 📱 手機檢查

### 支持的設備
- ✅ 桌面版 (Chrome, Firefox, Safari)
- ✅ 平板 (iPad, Android tablet)
- ⚠️ 手機 (未優化，可用)

### 推薦使用
- 最少解析度: 1024x768
- 推薦螢幕: 1366x768 以上
- 瀏覽器: 最新版本

---

## 🔔 通知設置

### Telegram 告警
E 組會自動發送以下通知：
1. **入倉完成** - 處理了多少商品
2. **待審核清單** - 需要人工確認的商品
3. **錯誤警告** - 系統異常提醒

### Web 通知
登入後會在頁面顯示：
- 新訂單提醒
- 商品狀態變更
- 系統告警

---

## 📈 進階功能

### 批量操作
- 批量上架商品
- 批量審核
- 批量更新價格

### 統計分析
- 按分類統計
- 按平台統計
- 按日期趨勢分析
- 價格分佈分析

### 導出功能
- 導出商品清單 (CSV)
- 導出銷售統計 (Excel)
- 導出日報告

---

## 💡 最佳實踐

### 商品審核
1. 檢查圖片清晰度
2. 確認商品名稱準確
3. 驗證估價合理性
4. 確認分類正確

### 定價策略
- 根據市場行情調整
- 考慮商品狀況
- 參考競品價格
- 使用 AI 建議作參考

### 上架管理
- 優先上架高價值商品
- 為不同平台製作不同文案
- 定期更新商品信息
- 監控銷售表現

### 用戶管理
- 定期審計權限
- 記錄所有操作
- 及時移除無效用戶
- 按角色分工

---

## 📚 更多資源

- **完整文檔**: 閱讀 `PROJECT_STRUCTURE.md`
- **部署指南**: 查看 `DEPLOYMENT.md`
- **API 文檔**: 進入 `backend/README.md`
- **E 組說明**: 查看 `e_group/README.md`

---

## 🎓 學習路徑

### 初級使用者
1. 完成本快速指南 ✓
2. 試用 Web 平台 (5分)
3. 進行一次完整工作流 (15分)

### 進階使用者
1. 查閱完整架構文檔
2. 自訂 E 組配置
3. 設置定時任務 (cron)
4. 集成額外的平台

### 開發者
1. 閱讀 API 文檔
2. 修改和擴展代碼
3. 建立新的 API 端點
4. 部署到生產環境

---

**開始探索 E 組系統吧！** 🚀

有任何問題，查閱相應的模組 README 或聯繫技術支援。
