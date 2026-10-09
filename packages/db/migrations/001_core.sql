-- 001_core.sql — 核心交易模型（規劃書 06、07、14、16 章；模組 02）
--
-- 原則：
-- 1. 所有金額為整數最小單位（TWD 分、JPY 円），不使用浮點數。
-- 2. 訂單建立、明細、庫存保留、付款事件與 outbox 在同一交易完成。
-- 3. 多 SKU 按固定 SKU 順序鎖定庫存，避免相反鎖定順序造成死鎖。
-- 4. 外部平臺交易唯一；同一訂單的不同重送通知不得重複出貨。
-- 5. 退款 request_key 冪等，並發退款鎖定可退餘額。
-- 6. 現貨、預購配額與詢價分開；預購不得扣現貨庫存。
--
-- 本檔為版本化 migration，不取代正式權限設定；角色由 003_roles.sql 建立。

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version        text PRIMARY KEY,
  applied_at     timestamptz NOT NULL DEFAULT now(),
  checksum       text NOT NULL
);

-- ---------------------------------------------------------------- 商品與來源

CREATE TABLE IF NOT EXISTS products (
  product_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code    text NOT NULL UNIQUE,
  title_zh        text NOT NULL,
  title_ja        text,
  category        text NOT NULL,
  origin          text NOT NULL DEFAULT 'UNKNOWN' CHECK (origin IN ('JP', 'OTHER', 'UNKNOWN')),
  source_tags     text[] NOT NULL DEFAULT '{}',
  published_version_id uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_versions (
  version_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  version_no      integer NOT NULL,
  snapshot        jsonb NOT NULL,
  published_at    timestamptz,
  published_by    text,
  UNIQUE (product_id, version_no)
);

CREATE TABLE IF NOT EXISTS skus (
  sku_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  sku             text NOT NULL UNIQUE,
  jan             text,
  spec            text,
  units_per_pack  integer NOT NULL DEFAULT 1 CHECK (units_per_pack > 0),
  -- 已核准臺幣售價（最小單位整數）；來源已含加價，不得重複加價。
  sale_twd        integer CHECK (sale_twd IS NULL OR sale_twd >= 0),
  cost_jpy        integer CHECK (cost_jpy IS NULL OR cost_jpy >= 0),
  weight_g        integer CHECK (weight_g IS NULL OR weight_g > 0),
  dimensions      text,
  supply_mode     text NOT NULL DEFAULT 'inquiry' CHECK (supply_mode IN ('in_stock', 'preorder', 'inquiry')),
  source_url      text,
  asset_id        text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS skus_product_idx ON skus (product_id);
CREATE INDEX IF NOT EXISTS skus_jan_idx ON skus (jan) WHERE jan IS NOT NULL;

CREATE TABLE IF NOT EXISTS product_compliance (
  sku_id          uuid PRIMARY KEY REFERENCES skus(sku_id) ON DELETE CASCADE,
  approved        boolean NOT NULL DEFAULT false,
  approved_by     text,
  approved_at     timestamptz,
  conditions      text,
  notes           text
);

CREATE TABLE IF NOT EXISTS source_snapshots (
  snapshot_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       text NOT NULL,
  source_version  text NOT NULL,
  snapshot_hash   text NOT NULL,
  row_count       integer NOT NULL CHECK (row_count >= 0),
  captured_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, snapshot_hash)
);

CREATE TABLE IF NOT EXISTS sync_runs (
  run_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       text NOT NULL,
  trigger         text NOT NULL CHECK (trigger IN ('schedule', 'manual')),
  status          text NOT NULL CHECK (status IN ('running', 'succeeded', 'blocked', 'failed')),
  snapshot_id     uuid REFERENCES source_snapshots(snapshot_id),
  blocked_reason  text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz
);

CREATE TABLE IF NOT EXISTS catalog_drafts (
  draft_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id     uuid NOT NULL REFERENCES source_snapshots(snapshot_id) ON DELETE CASCADE,
  sku             text NOT NULL,
  change_kind     text NOT NULL CHECK (change_kind IN ('new', 'updated', 'unchanged', 'missing')),
  payload         jsonb NOT NULL,
  review_status   text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected', 'needs_review')),
  review_reason   text,
  reviewed_by     text,
  reviewed_at     timestamptz,
  UNIQUE (snapshot_id, sku)
);

-- ---------------------------------------------------------------- 庫存

CREATE TABLE IF NOT EXISTS inventory (
  sku_id          uuid PRIMARY KEY REFERENCES skus(sku_id) ON DELETE CASCADE,
  on_hand         integer NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reserved        integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  -- 預購配額與現貨分開；預購不得扣現貨庫存。
  preorder_quota  integer NOT NULL DEFAULT 0 CHECK (preorder_quota >= 0),
  preorder_used   integer NOT NULL DEFAULT 0 CHECK (preorder_used >= 0),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_reserved_within_on_hand CHECK (reserved <= on_hand),
  CONSTRAINT inventory_preorder_within_quota CHECK (preorder_used <= preorder_quota)
);

CREATE TABLE IF NOT EXISTS inventory_lots (
  lot_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id          uuid NOT NULL REFERENCES skus(sku_id) ON DELETE CASCADE,
  lot_code        text NOT NULL,
  quantity        integer NOT NULL CHECK (quantity >= 0),
  expires_on      date,
  received_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sku_id, lot_code)
);

CREATE TABLE IF NOT EXISTS inventory_reservations (
  reservation_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL,
  sku_id          uuid NOT NULL REFERENCES skus(sku_id),
  quantity        integer NOT NULL CHECK (quantity > 0),
  supply_mode     text NOT NULL CHECK (supply_mode IN ('in_stock', 'preorder', 'inquiry')),
  status          text NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'converted', 'released', 'expired')),
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  released_at     timestamptz,
  release_reason  text
);

CREATE INDEX IF NOT EXISTS inventory_reservations_order_idx ON inventory_reservations (order_id);
CREATE INDEX IF NOT EXISTS inventory_reservations_expiry_idx ON inventory_reservations (status, expires_at);

CREATE TABLE IF NOT EXISTS inventory_movements (
  movement_id     bigserial PRIMARY KEY,
  sku_id          uuid NOT NULL REFERENCES skus(sku_id),
  delta           integer NOT NULL,
  reason          text NOT NULL CHECK (reason IN ('receipt', 'sale', 'reserve', 'release', 'adjustment', 'return')),
  reference_id    text,
  occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_movements_sku_idx ON inventory_movements (sku_id, occurred_at DESC);

-- ---------------------------------------------------------------- 顧客與員工

CREATE TABLE IF NOT EXISTS customers (
  customer_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name    text NOT NULL,
  line_user_id    text UNIQUE,
  email           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  disabled_at     timestamptz
);

-- 敏感資料獨立限制存取；僅 jp_web 具備必要欄位權限。
CREATE TABLE IF NOT EXISTS customer_private (
  customer_id     uuid PRIMARY KEY REFERENCES customers(customer_id) ON DELETE CASCADE,
  phone           text,
  id_number_enc   bytea,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS addresses (
  address_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     uuid NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  recipient_name  text NOT NULL,
  phone           text NOT NULL,
  city            text NOT NULL,
  district        text,
  line1           text NOT NULL,
  postal_code     text,
  is_default      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consents (
  customer_id     uuid PRIMARY KEY REFERENCES customers(customer_id) ON DELETE CASCADE,
  service_consent boolean NOT NULL DEFAULT false,
  marketing_consent boolean NOT NULL DEFAULT false,
  measurement_consent boolean NOT NULL DEFAULT false,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff (
  staff_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL UNIQUE,
  display_name    text NOT NULL,
  role            text NOT NULL CHECK (role IN ('owner', 'catalog', 'marketing', 'support', 'finance', 'logistics')),
  active          boolean NOT NULL DEFAULT true,
  mfa_enabled     boolean NOT NULL DEFAULT false,
  invited_at      timestamptz,
  deactivated_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_permissions (
  staff_id        uuid NOT NULL REFERENCES staff(staff_id) ON DELETE CASCADE,
  permission      text NOT NULL,
  granted_by      text NOT NULL,
  granted_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, permission)
);

CREATE TABLE IF NOT EXISTS staff_sessions (
  session_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        uuid NOT NULL REFERENCES staff(staff_id) ON DELETE CASCADE,
  issued_at       timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  revoked_at      timestamptz,
  revoked_reason  text
);

CREATE INDEX IF NOT EXISTS staff_sessions_active_idx ON staff_sessions (staff_id, expires_at) WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------- 報價與訂單

CREATE TABLE IF NOT EXISTS quotes (
  quote_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_hash      text NOT NULL UNIQUE,
  customer_id     uuid REFERENCES customers(customer_id),
  currency        text NOT NULL DEFAULT 'TWD' CHECK (currency = 'TWD'),
  subtotal_twd    integer NOT NULL CHECK (subtotal_twd >= 0),
  shipping_twd    integer NOT NULL CHECK (shipping_twd >= 0),
  discount_twd    integer NOT NULL DEFAULT 0 CHECK (discount_twd >= 0),
  total_twd       integer NOT NULL CHECK (total_twd >= 0),
  terms_version   text NOT NULL,
  lines           jsonb NOT NULL,
  shipping_choice jsonb,
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  consumed_order_id uuid
);

CREATE INDEX IF NOT EXISTS quotes_expiry_idx ON quotes (expires_at) WHERE consumed_order_id IS NULL;

CREATE TABLE IF NOT EXISTS orders (
  order_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code      text NOT NULL UNIQUE,
  customer_id     uuid REFERENCES customers(customer_id),
  quote_id        uuid REFERENCES quotes(quote_id),
  -- 冪等鍵：同一報價重試最多一張有效訂單。
  idempotency_key text NOT NULL UNIQUE,
  status          text NOT NULL DEFAULT 'pending_payment'
                  CHECK (status IN ('pending_payment', 'confirmed', 'procuring', 'ready_to_ship', 'cancelled', 'exception')),
  payment_status  text NOT NULL DEFAULT 'unpaid'
                  CHECK (payment_status IN ('unpaid', 'processing', 'paid', 'partially_refunded', 'refunded', 'needs_review')),
  shipment_status text NOT NULL DEFAULT 'not_shipped'
                  CHECK (shipment_status IN ('not_shipped', 'shipped', 'customs', 'in_transit_tw', 'delivered', 'delivery_exception')),
  currency        text NOT NULL DEFAULT 'TWD' CHECK (currency = 'TWD'),
  subtotal_twd    integer NOT NULL CHECK (subtotal_twd >= 0),
  shipping_twd    integer NOT NULL CHECK (shipping_twd >= 0),
  discount_twd    integer NOT NULL DEFAULT 0 CHECK (discount_twd >= 0),
  total_twd       integer NOT NULL CHECK (total_twd >= 0),
  paid_twd        integer NOT NULL DEFAULT 0 CHECK (paid_twd >= 0),
  refunded_twd    integer NOT NULL DEFAULT 0 CHECK (refunded_twd >= 0),
  terms_version   text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_refund_within_paid CHECK (refunded_twd <= paid_twd)
);

CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status, created_at DESC);

CREATE TABLE IF NOT EXISTS order_lines (
  line_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  sku_id          uuid NOT NULL REFERENCES skus(sku_id),
  sku             text NOT NULL,
  product_version_id uuid,
  quantity        integer NOT NULL CHECK (quantity > 0),
  unit_price_twd  integer NOT NULL CHECK (unit_price_twd >= 0),
  line_total_twd  integer NOT NULL CHECK (line_total_twd >= 0),
  supply_mode     text NOT NULL CHECK (supply_mode IN ('in_stock', 'preorder', 'inquiry')),
  -- 成交快照：歷史訂單不因商品改版而變動。
  snapshot        jsonb NOT NULL,
  UNIQUE (order_id, sku)
);

CREATE INDEX IF NOT EXISTS order_lines_order_idx ON order_lines (order_id);

-- ---------------------------------------------------------------- 金流

CREATE TABLE IF NOT EXISTS provider_accounts (
  account_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        text NOT NULL CHECK (provider IN ('ecpay', 'mock')),
  merchant_id     text NOT NULL,
  environment     text NOT NULL CHECK (environment IN ('stage', 'production')),
  active          boolean NOT NULL DEFAULT true,
  UNIQUE (provider, merchant_id, environment)
);

CREATE TABLE IF NOT EXISTS payment_attempts (
  attempt_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  provider        text NOT NULL CHECK (provider IN ('ecpay', 'mock')),
  merchant_trade_no text NOT NULL UNIQUE,
  amount_twd      integer NOT NULL CHECK (amount_twd > 0),
  choose_payment  text NOT NULL CHECK (choose_payment IN ('Credit', 'ATM', 'CVS', 'ALL')),
  status          text NOT NULL DEFAULT 'created'
                  CHECK (status IN ('created', 'redirected', 'paid', 'failed', 'expired', 'cancelled')),
  idempotency_key text NOT NULL UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_attempts_order_idx ON payment_attempts (order_id);

CREATE TABLE IF NOT EXISTS payment_events (
  event_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 事件唯一鍵：同一平臺交易重送不得重複扣庫存。
  event_key       text NOT NULL UNIQUE,
  attempt_id      uuid REFERENCES payment_attempts(attempt_id),
  order_id        uuid REFERENCES orders(order_id),
  provider        text NOT NULL,
  provider_trade_no text,
  amount_twd      integer NOT NULL,
  success         boolean NOT NULL,
  simulated       boolean NOT NULL DEFAULT false,
  raw_payload     jsonb NOT NULL,
  received_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_events_order_idx ON payment_events (order_id, received_at DESC);

CREATE TABLE IF NOT EXISTS payment_transactions (
  transaction_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES orders(order_id),
  attempt_id      uuid REFERENCES payment_attempts(attempt_id),
  provider        text NOT NULL,
  -- 平臺交易唯一：不同交易號重複付同一訂單轉財務核對。
  provider_trade_no text NOT NULL,
  amount_twd      integer NOT NULL CHECK (amount_twd > 0),
  fee_twd         integer NOT NULL DEFAULT 0 CHECK (fee_twd >= 0),
  settled_twd     integer NOT NULL DEFAULT 0,
  status          text NOT NULL CHECK (status IN ('paid', 'refunded', 'partially_refunded', 'needs_review')),
  paid_at         timestamptz NOT NULL,
  UNIQUE (provider, provider_trade_no)
);

CREATE TABLE IF NOT EXISTS refund_requests (
  refund_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES orders(order_id),
  transaction_id  uuid REFERENCES payment_transactions(transaction_id),
  -- 冪等鍵：同一退款意圖重試不得產生第二筆退款。
  request_key     text NOT NULL UNIQUE,
  amount_twd      integer NOT NULL CHECK (amount_twd > 0),
  reason          text NOT NULL,
  status          text NOT NULL DEFAULT 'requested'
                  CHECK (status IN ('requested', 'approved', 'sent', 'completed', 'failed', 'unknown', 'rejected')),
  approved_by     text,
  provider_refund_no text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS refund_requests_order_idx ON refund_requests (order_id);

CREATE TABLE IF NOT EXISTS settlements (
  settlement_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        text NOT NULL,
  settlement_date date NOT NULL,
  amount_twd      integer NOT NULL,
  fee_twd         integer NOT NULL DEFAULT 0,
  bank_reference  text,
  reconciled      boolean NOT NULL DEFAULT false,
  UNIQUE (provider, settlement_date, bank_reference)
);

-- ---------------------------------------------------------------- 採購與物流

CREATE TABLE IF NOT EXISTS suppliers (
  supplier_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL UNIQUE,
  country         text NOT NULL DEFAULT 'JP',
  contact         text,
  payment_terms   text,
  active          boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS supplier_quotes (
  supplier_quote_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     uuid NOT NULL REFERENCES suppliers(supplier_id) ON DELETE CASCADE,
  sku_id          uuid NOT NULL REFERENCES skus(sku_id),
  unit_price_jpy  integer NOT NULL CHECK (unit_price_jpy >= 0),
  moq             integer NOT NULL DEFAULT 1 CHECK (moq > 0),
  tax_jpy         integer NOT NULL DEFAULT 0 CHECK (tax_jpy >= 0),
  local_shipping_jpy integer NOT NULL DEFAULT 0 CHECK (local_shipping_jpy >= 0),
  remaining_shelf_life_days integer,
  lead_time_days  integer,
  valid_until     date,
  quoted_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  purchase_order_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_code         text NOT NULL UNIQUE,
  supplier_id     uuid NOT NULL REFERENCES suppliers(supplier_id),
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'submitted', 'confirmed', 'shipped', 'received', 'cancelled')),
  currency        text NOT NULL DEFAULT 'JPY' CHECK (currency = 'JPY'),
  total_jpy       integer NOT NULL DEFAULT 0 CHECK (total_jpy >= 0),
  fx_rate         numeric(12, 6),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_lines (
  purchase_line_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(purchase_order_id) ON DELETE CASCADE,
  sku_id          uuid NOT NULL REFERENCES skus(sku_id),
  quantity        integer NOT NULL CHECK (quantity > 0),
  unit_price_jpy  integer NOT NULL CHECK (unit_price_jpy >= 0),
  -- 可追原訂單：預購需求彙總後仍能回推。
  source_order_ids uuid[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS receipts (
  receipt_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(purchase_order_id),
  received_at     timestamptz NOT NULL DEFAULT now(),
  evidence_url    text,
  notes           text,
  UNIQUE (purchase_order_id, received_at)
);

CREATE TABLE IF NOT EXISTS receipt_lines (
  receipt_line_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id      uuid NOT NULL REFERENCES receipts(receipt_id) ON DELETE CASCADE,
  purchase_line_id uuid NOT NULL REFERENCES purchase_lines(purchase_line_id),
  received_qty    integer NOT NULL CHECK (received_qty >= 0),
  lot_code        text,
  expires_on      date,
  damaged_qty     integer NOT NULL DEFAULT 0 CHECK (damaged_qty >= 0),
  UNIQUE (receipt_id, purchase_line_id)
);

CREATE TABLE IF NOT EXISTS shipments (
  shipment_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_code   text NOT NULL UNIQUE,
  channel         text NOT NULL CHECK (channel IN ('tw_stock', 'jp_consolidation', 'jp_direct', 'inquiry')),
  status          text NOT NULL DEFAULT 'packing'
                  CHECK (status IN ('packing', 'shipped', 'customs', 'in_transit_tw', 'delivered', 'exception', 'returned')),
  tracking_no     text,
  carrier         text,
  rate_card_version text,
  fee_twd         integer NOT NULL DEFAULT 0 CHECK (fee_twd >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shipment_items (
  shipment_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id     uuid NOT NULL REFERENCES shipments(shipment_id) ON DELETE CASCADE,
  order_line_id   uuid NOT NULL REFERENCES order_lines(line_id),
  quantity        integer NOT NULL CHECK (quantity > 0),
  -- 一筆明細可分多次出貨，分配數量守恆。
  UNIQUE (shipment_id, order_line_id)
);

CREATE TABLE IF NOT EXISTS tracking_events (
  tracking_event_id bigserial PRIMARY KEY,
  shipment_id     uuid NOT NULL REFERENCES shipments(shipment_id) ON DELETE CASCADE,
  status          text NOT NULL,
  location        text,
  note            text,
  occurred_at     timestamptz NOT NULL,
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  -- 原始追蹤紀錄不覆蓋：同一狀態同一時間只記一次。
  UNIQUE (shipment_id, status, occurred_at)
);

CREATE TABLE IF NOT EXISTS customs_tasks (
  customs_task_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id     uuid NOT NULL REFERENCES shipments(shipment_id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'submitted', 'cleared', 'held', 'rejected')),
  declared_value_twd integer NOT NULL DEFAULT 0 CHECK (declared_value_twd >= 0),
  ez_way_required boolean NOT NULL DEFAULT false,
  ez_way_confirmed boolean NOT NULL DEFAULT false,
  notes           text,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- 客服與員工工作

CREATE TABLE IF NOT EXISTS support_tickets (
  ticket_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code     text NOT NULL UNIQUE,
  customer_id     uuid REFERENCES customers(customer_id),
  order_id        uuid REFERENCES orders(order_id),
  category        text NOT NULL CHECK (category IN ('order', 'product', 'payment', 'shipping', 'return', 'other')),
  status          text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'pending_customer', 'pending_staff', 'resolved', 'closed')),
  assigned_role   text,
  assigned_staff_id uuid REFERENCES staff(staff_id),
  first_response_due_at timestamptz,
  first_responded_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON support_tickets (status, first_response_due_at);

CREATE TABLE IF NOT EXISTS ticket_messages (
  message_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       uuid NOT NULL REFERENCES support_tickets(ticket_id) ON DELETE CASCADE,
  author_kind     text NOT NULL CHECK (author_kind IN ('customer', 'staff', 'ai_draft', 'system')),
  author_id       text,
  body            text NOT NULL,
  cited_facts     jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS return_requests (
  return_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES orders(order_id),
  order_line_id   uuid REFERENCES order_lines(line_id),
  quantity        integer NOT NULL CHECK (quantity > 0),
  reason          text NOT NULL,
  status          text NOT NULL DEFAULT 'requested'
                  CHECK (status IN ('requested', 'approved', 'received', 'refunded', 'rejected')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_tasks (
  task_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  description     text NOT NULL,
  role            text NOT NULL,
  assignee_staff_id uuid REFERENCES staff(staff_id),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'in_progress', 'done', 'blocked', 'cancelled')),
  due_at          timestamptz,
  order_id        uuid REFERENCES orders(order_id),
  sku_id          uuid REFERENCES skus(sku_id),
  evidence        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_tasks_assignee_idx ON work_tasks (assignee_staff_id, status, due_at);

CREATE TABLE IF NOT EXISTS time_entries (
  entry_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        uuid NOT NULL REFERENCES staff(staff_id) ON DELETE CASCADE,
  started_at      timestamptz NOT NULL,
  ended_at        timestamptz,
  note            text
);

-- ---------------------------------------------------------------- 行銷與 AI

CREATE TABLE IF NOT EXISTS creatives (
  creative_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_version_id uuid REFERENCES product_versions(version_id),
  sku_id          uuid REFERENCES skus(sku_id),
  platform        text NOT NULL CHECK (platform IN ('facebook', 'instagram', 'chatgpt_ads', 'line', 'search')),
  headline        text NOT NULL,
  body            text NOT NULL,
  image_asset_id  text,
  image_rights    text NOT NULL DEFAULT 'unknown'
                  CHECK (image_rights IN ('owned', 'licensed', 'supplier_granted', 'unknown')),
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'needs_update', 'retired')),
  reviewed_by     text,
  valid_until     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaigns (
  campaign_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_name   text NOT NULL,
  objective       text NOT NULL,
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'paused', 'active', 'archived')),
  daily_budget_micros bigint NOT NULL DEFAULT 0 CHECK (daily_budget_micros >= 0),
  currency        text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_resources (
  resource_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
  platform        text NOT NULL,
  external_id     text,
  -- 同一操作不得生成多資源。
  idempotency_key text NOT NULL,
  serving_status  text NOT NULL DEFAULT 'paused',
  payload         jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, idempotency_key)
);

CREATE TABLE IF NOT EXISTS ad_metrics (
  metric_id       bigserial PRIMARY KEY,
  platform        text NOT NULL,
  metric_date     date NOT NULL,
  campaign_external_id text,
  spend_micros    bigint NOT NULL DEFAULT 0,
  currency        text NOT NULL,
  impressions     bigint NOT NULL DEFAULT 0,
  clicks          bigint NOT NULL DEFAULT 0,
  platform_attributed_purchases integer NOT NULL DEFAULT 0,
  platform_attributed_revenue_micros bigint NOT NULL DEFAULT 0,
  fx_rate         numeric(12, 6),
  UNIQUE (platform, metric_date, campaign_external_id)
);

CREATE TABLE IF NOT EXISTS conversion_deliveries (
  delivery_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform        text NOT NULL,
  event_name      text NOT NULL,
  -- 事件去重：Pixel/CAPI 雙送不得重複計數。
  event_id        text NOT NULL,
  order_id        uuid REFERENCES orders(order_id),
  consent_granted boolean NOT NULL,
  delivered       boolean NOT NULL DEFAULT false,
  response        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, event_name, event_id)
);

CREATE TABLE IF NOT EXISTS ai_tasks (
  task_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_key        text NOT NULL,
  mode            text NOT NULL CHECK (mode IN ('desktop_manual', 'api')),
  source_version  text NOT NULL,
  source_hash     text NOT NULL,
  changed_paths   text[] NOT NULL DEFAULT '{}',
  acceptance_cases text[] NOT NULL DEFAULT '{}',
  output_contract text NOT NULL,
  status          text NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued', 'dispatched', 'returned', 'validated', 'rejected', 'failed')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- 來源 hash 相同時重用已核准結果，不重複 OCR。
  UNIQUE (task_key, source_version, source_hash, output_contract)
);

CREATE TABLE IF NOT EXISTS ai_runs (
  run_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         uuid NOT NULL REFERENCES ai_tasks(task_id) ON DELETE CASCADE,
  model           text NOT NULL,
  input_tokens    integer NOT NULL DEFAULT 0,
  output_tokens   integer NOT NULL DEFAULT 0,
  cost_twd        integer NOT NULL DEFAULT 0,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz
);

CREATE TABLE IF NOT EXISTS ai_usage (
  usage_date      date PRIMARY KEY,
  spent_twd       integer NOT NULL DEFAULT 0 CHECK (spent_twd >= 0),
  reserved_twd    integer NOT NULL DEFAULT 0 CHECK (reserved_twd >= 0)
);

CREATE TABLE IF NOT EXISTS review_decisions (
  decision_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_kind    text NOT NULL,
  subject_id      text NOT NULL,
  decision        text NOT NULL CHECK (decision IN ('approved', 'rejected', 'needs_review')),
  reason          text,
  decided_by      text NOT NULL,
  decided_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- 執行控制

CREATE TABLE IF NOT EXISTS outbox_jobs (
  job_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic           text NOT NULL,
  payload         jsonb NOT NULL,
  -- 同一外部操作使用固定冪等鍵。
  idempotency_key text NOT NULL UNIQUE,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'leased', 'succeeded', 'failed', 'dead')),
  attempts        integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts    integer NOT NULL DEFAULT 8 CHECK (max_attempts > 0),
  available_at    timestamptz NOT NULL DEFAULT now(),
  lease_owner     text,
  lease_expires_at timestamptz,
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outbox_jobs_claim_idx ON outbox_jobs (status, available_at) WHERE status IN ('pending', 'leased');

CREATE TABLE IF NOT EXISTS action_approvals (
  approval_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_kind     text NOT NULL CHECK (action_kind IN ('publish', 'refund', 'budget_change', 'permission_change', 'deploy')),
  subject_id      text NOT NULL,
  requested_by    text NOT NULL,
  approved_by     text,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  payload_hash    text NOT NULL,
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  audit_id        bigserial PRIMARY KEY,
  actor_kind      text NOT NULL CHECK (actor_kind IN ('staff', 'customer', 'system', 'ai')),
  actor_id        text,
  action          text NOT NULL,
  subject_kind    text,
  subject_id      text,
  detail          jsonb,
  occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_subject_idx ON audit_events (subject_kind, subject_id, occurred_at DESC);

COMMIT;
