# 04_google_sync Google 來源與商品同步

任務目標：Google 來源與商品同步

依賴：02_database, 03_auth

閱讀規劃書章節：02, 03, 04

可改檔案範圍：apps/worker/, apps/web/src/app/admin/, packages/integrations/google/, packages/domain/catalog/, packages/db/, test/sync/, docs/handoffs/

支援 Google Sheets ApprovedCatalog 批次讀取，以及 Drive 指定版本的 XLSX 解析 adapter。先建立既有中文欄位 mapping，成本、原價、已核准臺幣售價分開。圖片可用 Drive asset ID，不將限制存取的分享頁 URL 直接當公開圖。Google 使用最小權限服務帳號或 workload identity。

實作正規化、SKU 和規格查重、JAN 前導零、內容 hash、整批 snapshot、preview、審核、發布與來源鎖。不能覆蓋庫存、促銷、合規狀態或 SEO；已核准售價不重複加價。來源缺列只通知，明確 archive 才提出下架；空表、截斷或錯列阻擋整批。超門檻變價送審。

每天台北 06:00 與手動觸發共用一套 worker job，重試退避並去重。來源失效保留正式版。驗收涵蓋錯欄位、同批重跑、重排、缺列、空表、重複 SKU、讀一半、限流及兩次同時發布；真實 Google 憑證缺失時完成 adapter contract 與 fixtures，保留 integration_pending。
