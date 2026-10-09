# 14_chatgpt_ads ChatGPT Ads 官方整合

任務目標：ChatGPT Ads 官方整合

依賴：12_marketing_content, 08_payments

閱讀規劃書章節：12, 13, 15

可改檔案範圍：packages/integrations/openai-ads/, apps/web/src/app/admin/, apps/worker/, packages/db/, test/openai-ads/, docs/handoffs/

按 developers.openai.com/ads 的官方文件接 Advertiser API，使用 OPENAI_ADS_API_KEY，不使用一般模型 key。先只讀 ad_account 取得帳號、幣別、時區、review 和 serving 條件，再用 geo_lookup/search 查目標臺灣是否在當前可用市場。沒有資格或地區不可選就保留 disabled，不改成任意其他國家。

完成 capability、campaign/ad_group/ad 草稿、商品 feed、conversion、insights 與狀態查詢介面。資源先 paused，create 重試按支援的官方 Idempotency-Key 儲存，同一操作不得生成多資源。預算以官方 micros 單位和帳號幣別轉換，不把臺幣值直接當美元。

按官方 Pixel/CAPI payload 實作事件及量測同意，Purchase 只來自可計收入的已收款訂單，確認重送去重與 serving問題。自然搜尋設定、商品資料與廣告分開。驗收官方帳號測試、草稿預覽、地區、幣別、簽核範圍與報表；不能宣稱上線保證投放或自然推薦。
