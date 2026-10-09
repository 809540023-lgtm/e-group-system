# 13_meta_ads Facebook Instagram 廣告與轉換

任務目標：Facebook Instagram 廣告與轉換

依賴：12_marketing_content, 08_payments

閱讀規劃書章節：12, 13, 15, 17

可改檔案範圍：packages/integrations/meta/, apps/web/src/app/admin/, apps/worker/, packages/db/, test/meta/, docs/handoffs/

核對 Meta 當日 Marketing API、Graph 版本、商業資產、粉專、IG 專業帳號、廣告帳號、dataset、商品目錄與應用程式審查。版本和資產 ID 配置化，token 只在服務端。先提供 Business Suite 人工草稿和報表匯入，再接可用 API，不猜 endpoints 或 permissions。

平臺 adapter 支援能力查詢、paused draft、素材、feed、只讀報表及按政策啟用/暫停。FB 和 IG 共用內部 campaign，但儲存各 placement 及素材。每個資源儲存內外 ID、預算幣別、daily/month limit、可用版本與 serving 狀態。

量測從 canonical order_paid outbox 和顧客同意轉事件。若 Pixel/CAPI 雙送，按官方規則實作 event_name、event_id 等去重並驗證後臺。平臺歸因與網站收入分開。驗收拒絕同意、訊息重送、錯幣別、超預算、失效 token、無庫存與受影響素材。沒有真實 API 資格時狀態明確 integration_pending。
