# E 組完整系統架構

## 📁 項目結構

```
nostalgic-jackson/
├── .env                          # 環境變數（根目錄）
├── e_group/                      # E 組核心系統
│   ├── src/
│   │   ├── config.py            # 配置管理
│   │   ├── main.py              # 主程序
│   │   ├── supabase_init.py      # Supabase 初始化
│   │   ├── supabase_schema.sql   # 完整資料庫結構
│   │   ├── google_drive_scanner.py    # Google Drive 掃描
│   │   ├── image_processor.py    # 圖片分組
│   │   ├── ai_recognizer.py      # AI 商品辨識
│   │   ├── price_estimator.py    # 估價引擎
│   │   ├── marketing_generator.py # 行銷文生成
│   │   └── telegram_notifier.py   # Telegram 通知
│   ├── logs/                     # 日誌檔案
│   ├── requirements.txt
│   └── README.md
│
├── backend/                      # Node.js/Express 後端
│   ├── src/
│   │   ├── server.js            # 主服務器
│   │   ├── middleware/
│   │   │   └── auth.js          # 認證中間件
│   │   ├── routes/
│   │   │   ├── auth.js          # 認證路由
│   │   │   ├── inventory.js      # 商品管理
│   │   │   ├── platform.js       # 平台上架
│   │   │   ├── sales.js          # 銷售追蹤
│   │   │   ├── users.js          # 用戶管理
│   │   │   └── dashboard.js      # 統計儀表板
│   │   ├── services/
│   │   │   └── supabase.js       # Supabase 客戶端
│   │   ├── utils/
│   │   │   └── logger.js         # 日誌系統
│   │   └── logs/
│   ├── package.json
│   ├── .env.example
│   └── README.md
│
├── frontend/                     # Next.js 前端
│   ├── app/
│   │   ├── layout.tsx            # 根佈局
│   │   ├── auth/
│   │   │   └── login/page.tsx    # 登入頁面
│   │   ├── dashboard/
│   │   │   └── page.tsx          # 儀表板主頁
│   │   ├── inventory/
│   │   │   └── page.tsx          # 商品管理頁面
│   │   ├── platform/             # 平台上架頁面
│   │   ├── sales/                # 銷售追蹤頁面
│   │   └── users/                # 用戶管理頁面
│   ├── components/               # 可復用元件
│   ├── lib/                      # 工具函數
│   ├── styles/                   # 樣式文件
│   ├── public/                   # 靜態資源
│   ├── package.json
│   ├── next.config.js
│   ├── .env.example
│   └── tsconfig.json
│
└── README.md                     # 項目説明
```

## 🚀 快速開始

### 1. 環境變數配置

在根目錄的 `.env` 中設置：
```env
# Google
GOOGLE_API_KEY=your_key
GOOGLE_DRIVE_FOLDER_ID=agai2_new

# Supabase
SUPABASE_URL=your_url
SUPABASE_SERVICE_KEY=your_key
DATABASE_PASSWORD=your_password

# OpenAI
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4o-mini

# Telegram
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id

# 後端
PORT=3001
JWT_SECRET=your_secret
```

### 2. 安裝依賴

```bash
# E 組
cd e_group
pip install -r requirements.txt

# 後端
cd ../backend
npm install

# 前端
cd ../frontend
npm install
```

### 3. 初始化資料庫

在 Supabase 中執行 `e_group/src/supabase_schema.sql` 建立所有表

### 4. 啟動服務

```bash
# E 組（處理入倉建檔）
cd e_group
python src/main.py

# 後端（API 服務）
cd backend
npm run dev

# 前端（Web UI）
cd frontend
npm run dev
```

## 📊 系統模組說明

### E 組 (Python)
負責已購入商品的自動化入倉建檔：
- 掃描 Google Drive agai2_new 資料夾
- 自動分組圖片
- AI 識別商品信息
- 估算建議售價
- 生成行銷文案
- 存儲到 Supabase
- 標記需要人工複核的商品

**觸發方式：** 手動運行或定時任務（cron）

### 後端 API (Node.js/Express)
RESTful API 服務，負責：
- **認證模組** - 用戶註冊、登入、JWT 驗證
- **商品管理** - 查看、編輯、批量審核
- **平台上架** - 批量上架、狀態管理
- **銷售追蹤** - 訂單管理、收款追蹤
- **用戶管理** - 角色、權限、多用戶支持
- **統計儀表板** - 實時數據、趨勢分析、告警

**API 端點：**
```
POST   /api/auth/register         - 註冊
POST   /api/auth/login            - 登入
GET    /api/inventory             - 商品列表
PATCH  /api/inventory/:id/review  - 審核商品
POST   /api/platform/list         - 批量上架
GET    /api/sales/orders          - 銷售訂單
GET    /api/dashboard/overview    - 儀表板概覽
```

### 前端 (Next.js/React)
Web 管理平台，提供：
- 用戶認證（登入/註冊）
- 商品審核界面
- 批量上架管理
- 銷售追蹤儀表板
- 統計圖表和分析
- 用戶和權限管理
- 實時告警通知

**主要頁面：**
- `/auth/login` - 登入
- `/dashboard` - 首頁儀表板
- `/inventory` - 商品管理
- `/platform` - 上架管理
- `/sales` - 銷售追蹤
- `/users` - 用戶管理

## 🔐 認證和授權

### 角色系統 (RBAC)
- **admin** - 完全權限，可管理用戶和角色
- **reviewer** - 可審核商品
- **manager** - 可上架和追蹤銷售
- **user** - 基本查看權限

### JWT Token
- 有效期：24 小時
- 存儲在瀏覽器 localStorage
- 每次 API 請求必須在 Authorization header 中傳遞

## 📈 資料流程

### 入倉流程
```
Google Drive agai2_new
    ↓
E 組掃描和分組
    ↓
AI 識別和估價
    ↓
生成行銷文案
    ↓
存儲到 Supabase
    ↓
Telegram 通知
```

### 審核流程
```
待審核商品 (pending)
    ↓
管理員在 Web UI 中審核
    ↓
批准 (approved) 或 拒絕 (rejected)
    ↓
更新庫存狀態
```

### 上架流程
```
已批准商品 (approved)
    ↓
選擇平台（FB、Threads、Shopee 等）
    ↓
批量上架
    ↓
監控在線狀態
    ↓
銷售時標記為已售 (sold)
```

## 🗄️ 資料庫表

### 主要表
- **users** - 系統用戶
- **roles** - 角色定義
- **inventory_items** - 商品主檔
- **inventory_item_images** - 商品圖片
- **inventory_marketing_assets** - 行銷文素材
- **platform_listings** - 平台上架記錄
- **sales_orders** - 銷售訂單
- **inventory_logs** - 商品變更日誌
- **system_alerts** - 系統告警
- **daily_stats** - 每日統計快照

## 🔔 通知系統

### Telegram 通知
- 入倉完成摘要
- 待審核商品提醒
- 系統錯誤警告
- 銷售提醒

### Web 通知
- 頁面內實時告警
- 新訂單提醒
- 狀態變更提醒

## 📊 統計和監控

### Dashboard 數據
- 商品統計（總數、待審核、已批准、已售）
- 銷售統計（收入、平均價格、按平台統計）
- 庫存趨勢（按日期）
- 分類分佈
- 價格分佈範圍
- 系統告警清單

### 可導出報告
- 日銷售統計
- 商品狀況報告
- 平台表現分析
- 用戶活動日誌

## 🔧 配置和自訂

### E 組配置 (config.py)
```python
E_GROUP_CONFIG = {
    'min_images_per_product': 2,        # 最少圖片數
    'max_images_per_product': 4,        # 最多圖片數
    'min_confidence_threshold': 0.65,   # 信心度閾值
    'price_buffer_ratio': 0.15,         # 價格緩衝比率
}
```

### API 配置
- 分頁大小: 每頁 20 筆
- API 超時: 30 秒
- 日誌級別: info/debug

## 🚨 故障排查

### E 組常見問題
- **找不到 Google Drive 資料夾** - 檢查 folder_id
- **AI 識別失敗** - 確認 OpenAI 額度充足
- **Telegram 消息未發送** - 驗證 bot token 和 chat id

### 後端 API 問題
- **CORS 錯誤** - 檢查前端 URL 配置
- **認證失敗** - 驗證 JWT_SECRET
- **Supabase 連接失敗** - 確認 URL 和 key

### 前端問題
- **無法登入** - 檢查 localStorage 和 API 連接
- **頁面加載慢** - 查看網絡請求和 API 響應時間
- **資料不更新** - 驗證 token 有效期

## 📚 進一步開發

### 待開發功能
1. 多種支付方式集成
2. 自動同步到多個平台
3. 庫存自動扣減
4. 高級篩選和搜索
5. 批量導入和導出
6. 郵件通知系統
7. 行銷文案 A/B 測試
8. 積分和會員系統

### 擴展建議
- 集成物流 API
- 實現即時聊天
- 添加進階分析
- 支持商品批量編輯
- 建立商品模板系統

## 📖 API 文檔

### 認證
```bash
# 登入
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# 回應
{
  "user": {...},
  "token": "eyJhbGc..."
}
```

### 商品查詢
```bash
curl -X GET "http://localhost:3001/api/inventory?page=1&status=pending" \
  -H "Authorization: Bearer {token}"
```

更多詳見各模組的 README.md

## 📞 支持

- GitHub Issues: 報告 bug
- 文檔: 各模組 README.md
- Telegram: 系統通知和告警

---

**最後更新:** 2026-04-03
**版本:** 1.0.0
