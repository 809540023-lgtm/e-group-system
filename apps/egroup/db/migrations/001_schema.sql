-- 001_schema.sql — 雙北捷運健康餐食節點網路核心資料模型
-- 對應計畫書第十五章：供應商、SKU、批次、檢驗文件、站點、設備、溫度事件、
-- 庫存異動、訂單、付款退款、交付、召回、推薦歸因、服務結算及稽核事件。
--
-- 原則：
-- 1. 金額一律整數新台幣元。
-- 2. 訂單、明細、庫存保留、付款事件與稽核在同一個交易完成。
-- 3. 多 SKU 依固定順序鎖定批次，避免死鎖。
-- 4. 取貨碼只存 HMAC 雜湊，不存明文。
-- 5. 召回中商品不得透過任何管道銷售或交付。

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS customers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  phone          text UNIQUE,
  email          text UNIQUE,
  referral_code  text UNIQUE NOT NULL,
  referred_by    uuid REFERENCES customers(id),
  points         integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  allergens      text[] NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  food_business_reg_no  text,
  haccp_status          text NOT NULL DEFAULT 'pending'
                        CHECK (haccp_status IN ('pending','verified','not_required','expired')),
  insurance_expires_on  date,
  recall_contact        text,
  status                text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','suspended','terminated')),
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                text UNIQUE NOT NULL,
  name                text NOT NULL,
  type                text NOT NULL CHECK (type IN ('A','B','C','D')),
  address             text NOT NULL,
  mrt_line            text,
  mrt_station         text,
  walk_minutes        integer CHECK (walk_minutes IS NULL OR walk_minutes >= 0),
  corridor            text,
  status              text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','paused','closed')),
  capacity            integer NOT NULL DEFAULT 100 CHECK (capacity >= 0),
  opening_hours       text,
  contact             text,
  demand_score        integer NOT NULL DEFAULT 0 CHECK (demand_score BETWEEN 0 AND 30),
  cost_score          integer NOT NULL DEFAULT 0 CHECK (cost_score BETWEEN 0 AND 20),
  cold_chain_score    integer NOT NULL DEFAULT 0 CHECK (cold_chain_score BETWEEN 0 AND 20),
  replenishment_score integer NOT NULL DEFAULT 0 CHECK (replenishment_score BETWEEN 0 AND 15),
  competition_score   integer NOT NULL DEFAULT 0 CHECK (competition_score BETWEEN 0 AND 15),
  food_safety_pass    boolean NOT NULL DEFAULT false,
  venue_pass          boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text UNIQUE NOT NULL,
  password_hash  text NOT NULL,
  role           text NOT NULL CHECK (role IN ('customer','supplier','station','admin')),
  display_name   text NOT NULL,
  customer_id    uuid REFERENCES customers(id),
  supplier_id    uuid REFERENCES suppliers(id),
  station_id     uuid REFERENCES stations(id),
  active         boolean NOT NULL DEFAULT true,
  session_epoch  integer NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (role = 'customer' AND customer_id IS NOT NULL) OR
    (role = 'supplier' AND supplier_id IS NOT NULL) OR
    (role = 'station'  AND station_id  IS NOT NULL) OR
    (role = 'admin')
  )
);

CREATE TABLE IF NOT EXISTS products (
  sku                    text PRIMARY KEY,
  name                   text NOT NULL,
  category               text NOT NULL,
  description            text NOT NULL DEFAULT '',
  supplier_id            uuid NOT NULL REFERENCES suppliers(id),
  price_twd              integer NOT NULL CHECK (price_twd >= 0),
  cost_twd               integer NOT NULL CHECK (cost_twd >= 0),
  weight_g               integer NOT NULL CHECK (weight_g > 0),
  calories               integer NOT NULL CHECK (calories >= 0),
  protein_g              numeric(6,1) NOT NULL CHECK (protein_g >= 0),
  fat_g                  numeric(6,1) NOT NULL CHECK (fat_g >= 0),
  saturated_fat_g        numeric(6,1) CHECK (saturated_fat_g IS NULL OR saturated_fat_g >= 0),
  carbs_g                numeric(6,1) NOT NULL CHECK (carbs_g >= 0),
  sugar_g                numeric(6,1) CHECK (sugar_g IS NULL OR sugar_g >= 0),
  sodium_mg              integer NOT NULL CHECK (sodium_mg >= 0),
  allergens              text[] NOT NULL DEFAULT '{}',
  storage                text NOT NULL CHECK (storage IN ('frozen','chilled','ambient')),
  shelf_life_days        integer NOT NULL CHECK (shelf_life_days > 0),
  heating_instructions   text NOT NULL,
  claims                 text[] NOT NULL DEFAULT '{}',
  status                 text NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','active','suspended','recalled')),
  nutrition_reviewed_by  text,
  nutrition_reviewed_at  timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS batches (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku                text NOT NULL REFERENCES products(sku),
  supplier_id        uuid NOT NULL REFERENCES suppliers(id),
  lot_no             text NOT NULL,
  produced_on        date NOT NULL,
  expires_on         date NOT NULL,
  quantity_received  integer NOT NULL CHECK (quantity_received >= 0),
  quantity_available integer NOT NULL CHECK (quantity_available >= 0),
  quantity_reserved  integer NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
  status             text NOT NULL DEFAULT 'available'
                     CHECK (status IN ('available','quarantined','recalled','depleted')),
  received_temp_c    numeric(5,1),
  station_id         uuid REFERENCES stations(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sku, lot_no),
  CHECK (expires_on >= produced_on),
  CHECK (quantity_reserved <= quantity_available)
);

CREATE TABLE IF NOT EXISTS inspection_docs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id     uuid NOT NULL REFERENCES batches(id),
  doc_type     text NOT NULL,
  file_name    text NOT NULL,
  file_hash    text NOT NULL,
  issued_on    date NOT NULL,
  valid_until  date,
  scope        text NOT NULL,
  uploaded_by  text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id    uuid NOT NULL REFERENCES batches(id),
  station_id  uuid REFERENCES stations(id),
  type        text NOT NULL CHECK (type IN ('receive','reserve','release','deliver','return','quarantine','scrap','adjust','transfer')),
  quantity    integer NOT NULL,
  ref_type    text,
  ref_id      text,
  actor       text NOT NULL,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS equipment (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_no              text UNIQUE NOT NULL,
  type                  text NOT NULL,
  station_id            uuid REFERENCES stations(id),
  serial_no             text NOT NULL,
  owner                 text NOT NULL,
  purchase_date         date,
  purchase_price_twd    integer CHECK (purchase_price_twd IS NULL OR purchase_price_twd >= 0),
  insurance_policy      text,
  insurance_expires_on  date,
  last_calibrated_at    date,
  next_maintenance_on   date,
  status                text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','maintenance','retired','lost')),
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leases (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id      uuid NOT NULL REFERENCES equipment(id),
  lessor            text NOT NULL,
  lessee            text NOT NULL,
  monthly_rent_twd  integer NOT NULL CHECK (monthly_rent_twd >= 0),
  start_date        date NOT NULL,
  end_date          date,
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','ended','defaulted')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id  uuid NOT NULL REFERENCES equipment(id),
  type          text NOT NULL,
  performed_on  date NOT NULL,
  cost_twd      integer NOT NULL DEFAULT 0 CHECK (cost_twd >= 0),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS temperature_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id        uuid NOT NULL REFERENCES stations(id),
  equipment_id      uuid REFERENCES equipment(id),
  batch_id          uuid REFERENCES batches(id),
  temp_c            numeric(5,1) NOT NULL,
  duration_minutes  integer NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
  status            text NOT NULL CHECK (status IN ('ok','warning','breach')),
  action            text NOT NULL,
  actor             text NOT NULL,
  recorded_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no                text UNIQUE NOT NULL,
  customer_id             uuid NOT NULL REFERENCES customers(id),
  station_id              uuid NOT NULL REFERENCES stations(id),
  status                  text NOT NULL DEFAULT 'pending_payment'
                          CHECK (status IN ('pending_payment','paid','preparing','ready','delivered','cancelled','refunded')),
  subtotal_twd            integer NOT NULL CHECK (subtotal_twd >= 0),
  delivery_fee_twd        integer NOT NULL DEFAULT 0 CHECK (delivery_fee_twd >= 0),
  station_fee_twd         integer NOT NULL DEFAULT 0 CHECK (station_fee_twd >= 0),
  total_twd               integer NOT NULL CHECK (total_twd >= 0),
  pickup_code_hash        text NOT NULL,
  pickup_code_expires_at  timestamptz NOT NULL,
  pickup_code_used_at     timestamptz,
  payment_status          text NOT NULL DEFAULT 'unpaid'
                          CHECK (payment_status IN ('unpaid','paid','partially_refunded','refunded')),
  referral_code           text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sku             text NOT NULL REFERENCES products(sku),
  batch_id        uuid NOT NULL REFERENCES batches(id),
  quantity        integer NOT NULL CHECK (quantity > 0),
  unit_price_twd  integer NOT NULL CHECK (unit_price_twd >= 0),
  line_total_twd  integer NOT NULL CHECK (line_total_twd >= 0)
);

CREATE TABLE IF NOT EXISTS payments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid NOT NULL REFERENCES orders(id),
  provider          text NOT NULL,
  provider_txn_id   text,
  amount_twd        integer NOT NULL CHECK (amount_twd > 0),
  status            text NOT NULL CHECK (status IN ('pending','succeeded','failed','refunded')),
  idempotency_key   text UNIQUE NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refunds (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid NOT NULL REFERENCES orders(id),
  payment_id        uuid REFERENCES payments(id),
  amount_twd        integer NOT NULL CHECK (amount_twd > 0),
  reason            text NOT NULL,
  status            text NOT NULL CHECK (status IN ('requested','approved','completed','rejected')),
  idempotency_key   text UNIQUE NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deliveries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid UNIQUE NOT NULL REFERENCES orders(id),
  station_id        uuid NOT NULL REFERENCES stations(id),
  delivered_at      timestamptz NOT NULL DEFAULT now(),
  delivered_by      text NOT NULL,
  method            text NOT NULL CHECK (method IN ('scan','manual')),
  client_event_id   text UNIQUE,
  note              text
);

CREATE TABLE IF NOT EXISTS heating_records (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid REFERENCES orders(id),
  station_id        uuid NOT NULL REFERENCES stations(id),
  sku               text NOT NULL,
  equipment_id      uuid REFERENCES equipment(id),
  duration_seconds  integer NOT NULL CHECK (duration_seconds > 0),
  core_temp_c       numeric(5,1),
  operator          text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recalls (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku         text NOT NULL REFERENCES products(sku),
  batch_id    uuid REFERENCES batches(id),
  reason      text NOT NULL,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  started_at  timestamptz NOT NULL DEFAULT now(),
  closed_at   timestamptz,
  created_by  text NOT NULL
);

CREATE TABLE IF NOT EXISTS recall_notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recall_id    uuid NOT NULL REFERENCES recalls(id),
  order_id     uuid REFERENCES orders(id),
  customer_id  uuid REFERENCES customers(id),
  channel      text NOT NULL,
  status       text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  sent_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referrals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_customer_id  uuid NOT NULL REFERENCES customers(id),
  referee_customer_id   uuid NOT NULL REFERENCES customers(id),
  order_id              uuid NOT NULL REFERENCES orders(id),
  reward_twd            integer NOT NULL CHECK (reward_twd >= 0),
  status                text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','reversed','rejected')),
  reason                text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id)
);

CREATE TABLE IF NOT EXISTS service_settlements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id        uuid NOT NULL REFERENCES stations(id),
  period_start      date NOT NULL,
  period_end        date NOT NULL,
  delivered_count   integer NOT NULL CHECK (delivered_count >= 0),
  service_fee_twd   integer NOT NULL CHECK (service_fee_twd >= 0),
  quality_bonus_twd integer NOT NULL DEFAULT 0 CHECK (quality_bonus_twd >= 0),
  deductions_twd    integer NOT NULL DEFAULT 0 CHECK (deductions_twd >= 0),
  net_twd           integer NOT NULL,
  status            text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','paid')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (station_id, period_start, period_end),
  CHECK (period_end >= period_start)
);

CREATE TABLE IF NOT EXISTS settlement_orders (
  settlement_id  uuid NOT NULL REFERENCES service_settlements(id) ON DELETE CASCADE,
  order_id       uuid NOT NULL REFERENCES orders(id),
  PRIMARY KEY (settlement_id, order_id),
  UNIQUE (order_id)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id           bigserial PRIMARY KEY,
  actor_type   text NOT NULL,
  actor_id     text NOT NULL,
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    text NOT NULL,
  before_json  jsonb,
  after_json   jsonb,
  reason       text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS offline_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_event_id  text UNIQUE NOT NULL,
  station_id       uuid NOT NULL REFERENCES stations(id),
  type             text NOT NULL,
  payload          jsonb NOT NULL,
  received_at      timestamptz NOT NULL DEFAULT now(),
  processed_at     timestamptz,
  result           text
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  uuid REFERENCES customers(id),
  order_id     uuid REFERENCES orders(id),
  subject      text NOT NULL,
  body         text NOT NULL,
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  draft_reply  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id    uuid NOT NULL REFERENCES stations(id),
  staff_name    text NOT NULL,
  module        text NOT NULL,
  completed_at  timestamptz,
  score         integer CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id    uuid NOT NULL REFERENCES suppliers(id),
  sku            text NOT NULL REFERENCES products(sku),
  quantity       integer NOT NULL CHECK (quantity > 0),
  unit_cost_twd  integer NOT NULL CHECK (unit_cost_twd >= 0),
  status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ordered','received','cancelled')),
  expected_on    date,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shipments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id       uuid NOT NULL REFERENCES suppliers(id),
  station_id        uuid NOT NULL REFERENCES stations(id),
  batch_id          uuid NOT NULL REFERENCES batches(id),
  quantity          integer NOT NULL CHECK (quantity > 0),
  status            text NOT NULL DEFAULT 'in_transit' CHECK (status IN ('in_transit','received','rejected')),
  dispatched_at     timestamptz NOT NULL DEFAULT now(),
  received_at       timestamptz,
  received_temp_c   numeric(5,1),
  note              text
);

CREATE TABLE IF NOT EXISTS supplier_exceptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id  uuid NOT NULL REFERENCES suppliers(id),
  batch_id     uuid REFERENCES batches(id),
  type         text NOT NULL,
  description  text NOT NULL,
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open','responded','closed')),
  response     text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key            text PRIMARY KEY,
  scope          text NOT NULL,
  response_json  jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_batches_sku_expiry ON batches(sku, expires_on);
CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_station ON orders(station_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_batch ON inventory_movements(batch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_temperature_events_station ON temperature_events(station_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recalls_status ON recalls(status);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

COMMIT;
