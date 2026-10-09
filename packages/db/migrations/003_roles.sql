-- 003_roles.sql — 最小權限角色（規劃書 17、18 章；模組 02、18）
--
-- 公開 API 不得使用管理帳號。web、worker、reporter 各自最小權限。
-- 密碼由部署流程以 ALTER ROLE ... PASSWORD 設定，不寫在本檔。

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jp_web') THEN
    CREATE ROLE jp_web LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jp_worker') THEN
    CREATE ROLE jp_worker LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jp_reporter') THEN
    CREATE ROLE jp_reporter LOGIN;
  END IF;
END
$$;

-- 三個角色都不得建立資料庫或角色。
ALTER ROLE jp_web NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
ALTER ROLE jp_worker NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
ALTER ROLE jp_reporter NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO jp_web, jp_worker, jp_reporter;

-- ---------------------------------------------------------------- jp_web
-- 前臺與後臺 API：可讀商品、建單、讀自己的訂單、寫客服與稽核。
-- 不得直接改 payment_transactions、settlements、audit_events。

GRANT SELECT ON products, product_versions, skus, product_compliance, inventory TO jp_web;
GRANT SELECT, INSERT, UPDATE ON customers, customer_private, addresses, consents TO jp_web;
GRANT SELECT, INSERT, UPDATE ON orders, order_lines, quotes, payment_attempts TO jp_web;
GRANT SELECT, INSERT ON payment_events TO jp_web;
GRANT SELECT ON payment_transactions, refund_requests, settlements TO jp_web;
GRANT SELECT, INSERT, UPDATE ON support_tickets, ticket_messages, return_requests TO jp_web;
GRANT SELECT ON shipments, shipment_items, tracking_events, customs_tasks TO jp_web;
GRANT SELECT ON staff, staff_permissions TO jp_web;
GRANT SELECT, INSERT, UPDATE ON staff_sessions TO jp_web;
GRANT SELECT, INSERT, UPDATE ON work_tasks TO jp_web;
GRANT SELECT ON creatives, campaigns, platform_resources, ad_metrics TO jp_web;
GRANT SELECT, INSERT, UPDATE ON ai_tasks, review_decisions TO jp_web;
GRANT SELECT, INSERT ON audit_events TO jp_web;
GRANT SELECT, INSERT ON outbox_jobs TO jp_web;
GRANT SELECT, INSERT ON action_approvals TO jp_web;
GRANT SELECT ON schema_migrations TO jp_web;

-- 交易函式：web 只能建單與申請退款，不能直接套用付款事件。
GRANT EXECUTE ON FUNCTION jp_create_order(text, uuid, uuid, text, text, jsonb, integer, integer, integer, text) TO jp_web;
GRANT EXECUTE ON FUNCTION jp_request_refund(uuid, text, integer, text, text) TO jp_web;

-- ---------------------------------------------------------------- jp_worker
-- 排程與 outbox：可套用付款事件、完成退款、釋放逾期保留、認領工作。

GRANT SELECT ON products, product_versions, skus, product_compliance TO jp_worker;
GRANT SELECT, INSERT, UPDATE ON inventory, inventory_lots, inventory_reservations, inventory_movements TO jp_worker;
GRANT SELECT, INSERT, UPDATE ON orders, order_lines, quotes, payment_attempts TO jp_worker;
GRANT SELECT, INSERT, UPDATE ON payment_events, payment_transactions, refund_requests, settlements TO jp_worker;
GRANT SELECT, INSERT, UPDATE ON shipments, shipment_items, tracking_events, customs_tasks TO jp_worker;
GRANT SELECT, INSERT, UPDATE ON source_snapshots, sync_runs, catalog_drafts TO jp_worker;
GRANT SELECT, INSERT, UPDATE ON suppliers, supplier_quotes, purchase_orders, purchase_lines, receipts, receipt_lines TO jp_worker;
GRANT SELECT, INSERT, UPDATE ON outbox_jobs TO jp_worker;
GRANT SELECT, INSERT, UPDATE ON ai_tasks, ai_runs, ai_usage TO jp_worker;
GRANT SELECT, INSERT, UPDATE ON conversion_deliveries, ad_metrics TO jp_worker;
GRANT SELECT, INSERT ON audit_events TO jp_worker;
GRANT SELECT ON staff, staff_permissions TO jp_worker;
GRANT SELECT, INSERT, UPDATE ON work_tasks, support_tickets, ticket_messages TO jp_worker;
GRANT SELECT ON schema_migrations TO jp_worker;

GRANT EXECUTE ON FUNCTION jp_apply_payment_event(text, uuid, uuid, text, text, integer, boolean, boolean, timestamptz, jsonb, text) TO jp_worker;
GRANT EXECUTE ON FUNCTION jp_complete_refund(uuid, text, text) TO jp_worker;
GRANT EXECUTE ON FUNCTION jp_release_expired_reservations(integer) TO jp_worker;
GRANT EXECUTE ON FUNCTION jp_claim_outbox_jobs(text, integer, integer) TO jp_worker;
GRANT EXECUTE ON FUNCTION jp_finish_outbox_job(uuid, boolean, text) TO jp_worker;

-- ---------------------------------------------------------------- jp_reporter
-- 報表：只讀，且不得讀取 customer_private 與 addresses 的敏感欄位。

GRANT SELECT ON products, product_versions, skus, inventory TO jp_reporter;
GRANT SELECT ON orders, order_lines, quotes TO jp_reporter;
GRANT SELECT ON payment_transactions, refund_requests, settlements TO jp_reporter;
GRANT SELECT ON shipments, shipment_items, tracking_events TO jp_reporter;
GRANT SELECT ON purchase_orders, purchase_lines, receipts, receipt_lines, supplier_quotes, suppliers TO jp_reporter;
GRANT SELECT ON creatives, campaigns, platform_resources, ad_metrics, conversion_deliveries TO jp_reporter;
GRANT SELECT ON ai_tasks, ai_runs, ai_usage TO jp_reporter;
GRANT SELECT ON work_tasks, support_tickets TO jp_reporter;
GRANT SELECT ON audit_events TO jp_reporter;
GRANT SELECT ON schema_migrations TO jp_reporter;

-- 報表角色不得讀取敏感個資表。
REVOKE ALL ON customer_private, addresses FROM jp_reporter;

-- ---------------------------------------------------------------- 預設權限
-- 之後新增的表不自動開放，必須在 migration 明確授權。

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM jp_web, jp_worker, jp_reporter;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM jp_web, jp_worker, jp_reporter;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO jp_web, jp_worker;

COMMIT;
