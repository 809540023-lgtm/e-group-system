-- 011_indexes.sql — 查詢熱路徑補強索引
--
-- 1. accounts 以 lower(email) 查詢（登入、註冊重複檢查），
--    一般 UNIQUE(email) 索引無法命中函式查詢，需建立函式索引。
-- 2. products 依供應商篩選（供應商後台商品列表）。
-- 3. batches 以「可售且未過期」聚合庫存，補上部分索引降低掃描量。

BEGIN;

CREATE INDEX IF NOT EXISTS idx_accounts_email_lower ON accounts (lower(email));

CREATE INDEX IF NOT EXISTS idx_products_supplier ON products (supplier_id, status);

CREATE INDEX IF NOT EXISTS idx_batches_available
  ON batches (sku, expires_on)
  WHERE status = 'available';

COMMIT;
