# E 組 - 已購入商品入倉建檔系統

## 系統概述

E 組是針對已購入的二手商品進行自動化入倉建檔的完整系統。

**功能模組：**
1. **Google Drive 掃描** - 自動掃描 agai2_new 資料夾
2. **圖片分組** - 根據檔名和時間自動分組
3. **AI 商品辨識** - 使用 OpenAI Vision 識別商品信息
4. **商品估價** - 根據狀況估算建議售價
5. **行銷文生成** - 自動生成 FB、Threads 文案
6. **資料落庫** - 寫入 Supabase 資料庫
7. **Telegram 通知** - 實時進度通知
8. **人工複核標記** - 自動標記需要人工確認的商品

## 安裝

```bash
cd e_group
pip install -r requirements.txt
```

## 配置

編輯 `.env` 文件，設置以下環境變數：

```env
GOOGLE_API_KEY=your_key
GOOGLE_DRIVE_FOLDER_ID=agai2_new
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
OPENAI_API_KEY=your_openai_key
TELEGRAM_BOT_TOKEN=your_telegram_token
TELEGRAM_CHAT_ID=your_chat_id
```

## 使用

### 運行完整流程

```bash
python src/main.py
```

### 初始化 Supabase 表

```python
from src.supabase_init import SupabaseManager

manager = SupabaseManager()
manager.init_tables()
```

### 測試 Telegram 連接

```python
from src.telegram_notifier import TelegramNotifier

notifier = TelegramNotifier()
notifier.test_connection()
```

## 資料結構

### inventory_items - 商品主檔
- id: UUID
- warehouse_date: 入倉日期
- product_name: 商品名稱
- normalized_product_name: 標準化商品名
- brand: 品牌
- model: 型號
- category: 商品分類
- condition_summary: 狀況描述
- suggested_price: 建議售價
- min_price: 最低售價
- suggested_platforms: 推薦平台 (JSON)
- confidence: 識別信心度 (0-1)
- needs_review: 是否需要人工複核

### inventory_item_images - 商品圖片
- id: UUID
- inventory_item_id: 商品 ID (FK)
- image_name: 圖片檔名
- image_url: 圖片 URL
- image_order: 圖片順序

### inventory_marketing_assets - 行銷文素材
- id: UUID
- inventory_item_id: 商品 ID (FK)
- listing_title: 商品標題
- short_description: 簡短描述
- facebook_post: FB 文案
- threads_post: Threads 文案
- hashtags: 標籤 (JSON)
- seo_keywords: SEO 關鍵字 (JSON)

## 流程詳解

### 1. Google Drive 掃描
- 掃描 `agai2_new` 根資料夾
- 找出最新的日期資料夾 (YYYYMMDD 格式)
- 列出該資料夾內所有圖片

### 2. 圖片分組
- 優先按檔名分組 (例如: 四門冰箱_1.jpg, 四門冰箱_2.jpg)
- 備選按上傳時間分組 (5 分鐘內視為同組)
- 每組 2-4 張圖片

### 3. AI 識別
- 調用 OpenAI Vision 識別商品
- 輸出: 商品名、品牌、型號、分類、狀況、信心度

### 4. 商品估價
- 根據分類設定基礎價格
- 根據狀況分數調整 (0.2 - 1.0 倍)
- 建議上架平台
- 判斷是否適合快速出清

### 5. 行銷文生成
- 生成吸引人的商品標題
- 生成簡短描述 (50-80 字)
- 生成 FB 貼文 (親切口吻)
- 生成 Threads 文案 (隨性風格)
- 生成相關標籤和 SEO 關鍵字

### 6. 資料落庫
- 建立商品主檔
- 建立圖片記錄
- 建立行銷文記錄

### 7. 人工複核標記
以下情況標記為 `needs_review = true`:
- 信心度 < 0.65
- 無法判斷品牌或型號
- 圖片少於 2 張
- 商品狀況分數 < 40
- 需要維修

### 8. Telegram 通知
- 完成摘要: 總計、成功、失敗、待複核數
- 待複核清單: 需要人工確認的商品列表
- 錯誤通知: 系統錯誤即時提醒

## 日誌

日誌存放在 `logs/` 目錄，格式：
```
e_group_YYYYMMDD_HHMMSS.log
```

## 返回狀態

- `success`: 流程正常完成
- `failed`: 發生錯誤或無圖片

## 注意事項

1. **API 金鑰安全**: 不要在代碼中硬寫密鑰，使用環境變數
2. **Google Drive Folder ID**: 需要確認 agai2_new 資料夾的正確 ID
3. **Supabase 表**: 首次運行前需要確保表已建立
4. **OpenAI 額度**: 確保帳戶有足夠的 API 額度
5. **Telegram Bot**: 需要配置機器人並獲得 Chat ID

## 故障排查

### 找不到 Google Drive 資料夾
- 檢查 `GOOGLE_DRIVE_FOLDER_ID` 是否正確
- 確認 Google API Key 有效

### Supabase 連接失敗
- 檢查 `SUPABASE_URL` 和 `SUPABASE_SERVICE_KEY`
- 確認資料庫表已建立

### AI 識別失敗
- 檢查 `OPENAI_API_KEY` 是否有效
- 檢查帳戶額度是否充足
- 檢查圖片 URL 是否可訪問

### Telegram 通知未收到
- 檢查 `TELEGRAM_BOT_TOKEN` 和 `TELEGRAM_CHAT_ID`
- 運行 `notifier.test_connection()` 測試
