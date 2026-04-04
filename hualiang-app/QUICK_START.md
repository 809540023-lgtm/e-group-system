# 🚀 華亮分會 App - 快速開始 (5 分鐘)

## 一鍵啟動 (簡版)

### macOS/Linux

```bash
# 1. 啟動後端
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python app.py &

# 2. 啟動前端
cd ../frontend
npm install && npm run dev &

# 3. 啟動管理後台
cd ../admin
npm install && npm run dev &

# 4. 打開瀏覽器
# 用戶應用: http://localhost:5173
# 管理後台: http://localhost:5174
# API: http://localhost:5000/api
```

### Windows

```cmd
# 1. 啟動後端
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py

# 新開終端窗口

# 2. 啟動前端
cd frontend
npm install
npm run dev

# 新開終端窗口

# 3. 啟動管理後台
cd admin
npm install
npm run dev
```

## 📱 訪問地址

| 應用 | 地址 | 功能 |
|------|------|------|
| 用戶應用 | http://localhost:5173 | 會員、活動、商機、分享 |
| 管理後台 | http://localhost:5174 | 數據管理和統計 |
| API | http://localhost:5000/api | 後端接口 |

## 🎯 主要功能演示

### 用戶應用
1. **首頁** - 查看消息和熱門商機
2. **找姐妹** - 按行業/地區查找會員
3. **商機** - 瀏覽需求卡和優惠卡
4. **生活** - 查看會員分享和動態
5. **消息** - 了解活動和公告

### 管理後台
1. **儀表板** - 查看統計數據
2. **會員管理** - 新增編輯會員
3. **活動管理** - 建立活動
4. **消息管理** - 發佈公告
5. **商機管理** - 管理商機卡片

## 📝 預設測試數據

### 會員
- 王美玲 (花藝)
- 陳雅芳 (芳療)
- 李淑華 (會計)
- 吳秀琴 (美容)

### 活動
- 3月例會 - 會姐交流茶會
- 4月春遊 - 陽明山賞花

### 商機
- 紅卡: 尋找婚禮場地、需要網站設計師、咖啡豆供應商
- 綠卡: 舒壓療程折扣、醫美團購、保健品優惠

## 🔧 常用命令

```bash
# 後端
python app.py              # 啟動開發服務器
python -m pip install -r requirements.txt  # 安裝依賴

# 前端
npm run dev               # 開發模式
npm run build             # 生產構建
npm run preview           # 預覽構建結果

# 管理後台
npm run dev               # 開發模式
npm run build             # 生產構建
```

## 💾 數據庫

首次啟動時自動創建 SQLite 數據庫 `hualiang.db`，包含所有示例數據。

查看數據庫:
```bash
sqlite3 backend/hualiang.db
sqlite> .tables
sqlite> SELECT * FROM members LIMIT 5;
```

## 🔐 登錄信息

當前版本無登錄要求，所有數據對所有用戶可見。

## ⚠️ 常見問題

**Q: 埠口被佔用**
```bash
# macOS/Linux - 查看佔用埠口的進程
lsof -i :5173
# 終止進程
kill -9 <PID>

# Windows
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

**Q: 模塊未找到**
```bash
# 重新安裝依賴
pip install -r requirements.txt --force-reinstall
npm install --force
```

**Q: API 無法連接**
- 確認後端已啟動 (python app.py)
- 檢查埠口 5000 是否可用
- 查看終端是否有錯誤信息

## 📚 文檔

- [完整 README](./README.md) - 詳細功能說明
- [部署指南](./DEPLOYMENT.md) - 生產環境部署
- [API 文檔](./API.md) - API 端點詳細說明

## 🎓 下一步

1. 在管理後台添加自己的數據
2. 自定義品牌顏色和配置
3. 集成實際數據庫
4. 添加用戶認證功能
5. 部署到生產環境

## 📞 需要幫助？

查看各目錄的 README 文件或聯繫開發團隊。

---

**提示**: 如遇問題，可清除 node_modules 並重新安裝: `rm -rf node_modules && npm install`

祝你使用愉快！ 🎉
