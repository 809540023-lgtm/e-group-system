# 華亮分會 App - 完整版

一個為女性企業家社團建立的綜合應用平台，包含會員管理、活動組織、商機匹配和社區分享功能。

## 📱 應用功能

### 用戶應用 (User App)
- **首頁**: 最新消息、熱門商機、商機快訊
- **找姐妹**: 會員目錄、行業和地區篩選、聯繫方式
- **商機匹配**: 需求紅卡、優惠綠卡、熱門商機
- **生活分享**: 會員動態、月份分組、互動點讚
- **消息與活動**: 最新公告、即將活動、過去活動回顧

### 管理後台 (Admin Panel)
- **儀表板**: 統計數據一覽
- **會員管理**: 新增、編輯、刪除會員
- **活動管理**: 建立和管理活動
- **消息管理**: 發佈公告和新聞
- **商機管理**: 管理紅卡需求和綠卡優惠

## 🏗️ 項目結構

```
hualiang-app/
├── frontend/                 # 用戶應用 (React)
│   ├── src/
│   │   ├── pages/           # 頁面組件
│   │   ├── components/      # 可複用組件
│   │   ├── data/            # 模擬數據
│   │   └── utils/           # 工具函數
│   ├── package.json
│   └── vite.config.js
├── admin/                    # 管理後台 (React)
│   ├── src/
│   │   ├── pages/           # 管理頁面
│   │   ├── components/      # 管理組件
│   │   └── utils/           # 工具函數
│   └── package.json
├── backend/                  # 後端 API (Flask)
│   ├── app.py              # 主應用
│   ├── models.py           # 數據模型
│   ├── routes.py           # API 路由
│   ├── seed_data.py        # 數據初始化
│   ├── config.py           # 配置文件
│   ├── requirements.txt    # 依賴
│   └── .env.example        # 環境配置示例
└── README.md               # 本文件
```

## 🚀 快速開始

### 前置要求
- Python 3.8+
- Node.js 16+
- npm 或 yarn

### 1. 後端設置

```bash
# 進入後端目錄
cd backend

# 創建虛擬環境
python -m venv venv

# 啟動虛擬環境
# macOS/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# 安裝依賴
pip install -r requirements.txt

# 複製環境配置
cp .env.example .env

# 初始化數據庫（自動執行）
python app.py
```

後端將在 `http://localhost:5000` 運行

### 2. 前端應用設置

```bash
# 進入前端目錄
cd frontend

# 安裝依賴
npm install

# 啟動開發服務器
npm run dev
```

前端將在 `http://localhost:5173` 運行

### 3. 管理後台設置

```bash
# 進入管理目錄
cd admin

# 安裝依賴
npm install

# 啟動開發服務器
npm run dev
```

管理後台將在 `http://localhost:5174` 運行

## 📊 API 端點

### 會員 API
- `GET /api/members` - 獲取所有會員
- `GET /api/members/<id>` - 獲取特定會員
- `GET /api/members/search?industry=&region=` - 搜索會員
- `POST /api/members` - 新增會員

### 活動 API
- `GET /api/events/upcoming` - 獲取即將舉行的活動
- `GET /api/events/past` - 獲取過去的活動
- `GET /api/events/<id>` - 獲取特定活動
- `POST /api/events` - 新增活動

### 消息 API
- `GET /api/news` - 獲取所有消息
- `GET /api/news/<id>` - 獲取特定消息
- `POST /api/news` - 新增消息

### 商機 API
- `GET /api/business/red-cards` - 獲取需求卡
- `GET /api/business/green-cards` - 獲取優惠卡
- `GET /api/business/hot-opportunities` - 獲取熱門商機
- `POST /api/business/cards` - 新增商機卡

### 生活分享 API
- `GET /api/gallery/posts` - 獲取所有分享
- `GET /api/gallery/posts/<month>` - 按月份獲取分享
- `POST /api/gallery/posts` - 新增分享

## 🗄️ 數據庫

應用使用 SQLite 數據庫（默認），包含以下表：

- **members** - 會員信息
- **events** - 活動信息
- **news** - 消息和公告
- **business_cards** - 商機卡片（紅卡/綠卡）
- **life_posts** - 生活分享

首次啟動時會自動創建表並填入示例數據。

## 🔧 配置

編輯 `backend/.env` 文件配置：

```env
FLASK_ENV=development
FLASK_DEBUG=True
DATABASE_URL=sqlite:///hualiang.db
SECRET_KEY=your-secret-key-here
```

## 📦 生產部署

### 前端打包
```bash
cd frontend
npm run build
# 輸出文件在 dist/ 目錄
```

### 後端部署
使用 Gunicorn：
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:create_app()
```

## 🎨 界面特性

- 響應式設計，適配所有設備
- Tailwind CSS 樣式
- Lucide React 圖標
- 平滑的頁面轉換

## 📝 數據範例

應用預設包含以下數據：
- 8 位會員（不同行業）
- 2 場即將舉行的活動
- 3 條最新消息
- 3 個商機卡片（紅卡 + 綠卡）
- 6 個生活分享

## 🛠️ 技術棧

### 前端
- React 18
- React Router v6
- Vite
- Tailwind CSS
- Axios
- Lucide React

### 後端
- Flask 2.3
- SQLAlchemy
- Flask-CORS
- Python 3.8+

## 📱 瀏覽器支援

- Chrome (最新)
- Firefox (最新)
- Safari (最新)
- Edge (最新)

## 🔐 安全建議

1. 在生產環境中更改 `SECRET_KEY`
2. 設置環境變量而不是硬編碼配置
3. 實施用戶認證和授權
4. 使用 HTTPS
5. 定期更新依賴

## 📞 支持

如有問題或建議，請聯繫開發團隊。

## 📄 許可

本項目專為華亮分會設計開發。

---

**最後更新**: 2025年3月
**版本**: 1.0.0
