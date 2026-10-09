-- 002_jobs.sql — 交易函式與 outbox（規劃書 06、07、16 章；模組 02）
--
-- 這些函式是唯一允許改動庫存與付款事實的入口。
-- 應用程式不得以多個獨立語句模擬交易一致性。

BEGIN;

-- ---------------------------------------------------------------- 建單

-- 建立訂單：明細、庫存保留、付款嘗試與 outbox 在同一交易完成。
-- 多 SKU 按固定 SKU 順序鎖定庫存，避免兩張組合訂單形成相反鎖定順序。
-- 回傳既有訂單時不重複扣庫存（idempotency_key 唯一）。
CREATE OR REPLACE FUNCTION jp_create_order(
  p_order_code        text,
  p_customer_id       uuid,
  p_quote_id          uuid,
  p_idempotency_key   text,
  p_terms_version     text,
  p_lines             jsonb,   -- [{sku, quantity, unit_price_twd, supply_mode, snapshot}]
  p_shipping_twd      integer,
  p_discount_twd      integer,
  p_reservation_minutes integer,
  p_outbox_topic      text
) RETURNS TABLE (order_id uuid, order_code text, total_twd integer, created boolean)
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing      orders%ROWTYPE;
  v_order_id      uuid;
  v_subtotal      integer := 0;
  v_total         integer;
  v_line          jsonb;
  v_sku_id        uuid;
  v_sku           text;
  v_qty           integer;
  v_unit          integer;
  v_mode          text;
  v_available     integer;
  v_quota_left    integer;
  v_sorted        jsonb;
BEGIN
  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'ORDER_EMPTY: 訂單必須至少一筆明細';
  END IF;

  -- 冪等：同一鍵重試回傳既有訂單，不重複扣庫存。
  SELECT * INTO v_existing FROM orders o WHERE o.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN QUERY SELECT v_existing.order_id, v_existing.order_code, v_existing.total_twd, false;
    RETURN;
  END IF;

  -- 固定 SKU 鎖定順序：先依 sku 文字排序，再逐列鎖定。
  SELECT jsonb_agg(elem ORDER BY elem->>'sku') INTO v_sorted FROM jsonb_array_elements(p_lines) AS elem;

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_sorted) LOOP
    v_sku  := v_line->>'sku';
    v_qty  := (v_line->>'quantity')::integer;
    v_unit := (v_line->>'unit_price_twd')::integer;
    v_mode := COALESCE(v_line->>'supply_mode', 'inquiry');

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'ORDER_INVALID_QUANTITY: SKU % 數量必須為正整數', v_sku;
    END IF;
    IF v_unit IS NULL OR v_unit < 0 THEN
      RAISE EXCEPTION 'ORDER_INVALID_PRICE: SKU % 單價必須為非負整數', v_sku;
    END IF;

    SELECT s.sku_id INTO v_sku_id FROM skus s WHERE s.sku = v_sku FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ORDER_UNKNOWN_SKU: 找不到 SKU %', v_sku;
    END IF;

    -- 鎖定庫存列；同一交易內依固定順序取得，避免死鎖。
    PERFORM 1 FROM inventory i WHERE i.sku_id = v_sku_id FOR UPDATE;

    IF v_mode = 'in_stock' THEN
      SELECT i.on_hand - i.reserved INTO v_available FROM inventory i WHERE i.sku_id = v_sku_id;
      IF v_available IS NULL OR v_available < v_qty THEN
        RAISE EXCEPTION 'ORDER_INSUFFICIENT_STOCK: SKU % 可售量不足（需要 %，可用 %）', v_sku, v_qty, COALESCE(v_available, 0);
      END IF;
    ELSIF v_mode = 'preorder' THEN
      -- 預購不得扣現貨庫存，只檢查配額。
      SELECT i.preorder_quota - i.preorder_used INTO v_quota_left FROM inventory i WHERE i.sku_id = v_sku_id;
      IF v_quota_left IS NULL OR v_quota_left < v_qty THEN
        RAISE EXCEPTION 'ORDER_INSUFFICIENT_QUOTA: SKU % 預購配額不足（需要 %，可用 %）', v_sku, v_qty, COALESCE(v_quota_left, 0);
      END IF;
    ELSIF v_mode = 'inquiry' THEN
      RAISE EXCEPTION 'ORDER_INQUIRY_REQUIRES_QUOTE: SKU % 為詢價品，不得直接收款', v_sku;
    ELSE
      RAISE EXCEPTION 'ORDER_INVALID_SUPPLY_MODE: SKU % 供貨模式 % 無效', v_sku, v_mode;
    END IF;

    v_subtotal := v_subtotal + v_unit * v_qty;
  END LOOP;

  v_total := v_subtotal + COALESCE(p_shipping_twd, 0) - COALESCE(p_discount_twd, 0);
  IF v_total < 0 THEN
    RAISE EXCEPTION 'ORDER_NEGATIVE_TOTAL: 總額不得為負';
  END IF;

  INSERT INTO orders (
    order_code, customer_id, quote_id, idempotency_key, status, payment_status, shipment_status,
    subtotal_twd, shipping_twd, discount_twd, total_twd, terms_version
  ) VALUES (
    p_order_code, p_customer_id, p_quote_id, p_idempotency_key, 'pending_payment', 'unpaid', 'not_shipped',
    v_subtotal, COALESCE(p_shipping_twd, 0), COALESCE(p_discount_twd, 0), v_total, p_terms_version
  ) RETURNING orders.order_id INTO v_order_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_sorted) LOOP
    v_sku  := v_line->>'sku';
    v_qty  := (v_line->>'quantity')::integer;
    v_unit := (v_line->>'unit_price_twd')::integer;
    v_mode := COALESCE(v_line->>'supply_mode', 'inquiry');

    SELECT s.sku_id INTO v_sku_id FROM skus s WHERE s.sku = v_sku;

    INSERT INTO order_lines (
      order_id, sku_id, sku, product_version_id, quantity, unit_price_twd, line_total_twd, supply_mode, snapshot
    ) VALUES (
      v_order_id, v_sku_id, v_sku,
      NULLIF(v_line->>'product_version_id', '')::uuid,
      v_qty, v_unit, v_unit * v_qty, v_mode,
      COALESCE(v_line->'snapshot', '{}'::jsonb)
    );

    INSERT INTO inventory_reservations (order_id, sku_id, quantity, supply_mode, status, expires_at)
    VALUES (v_order_id, v_sku_id, v_qty, v_mode, 'held', now() + make_interval(mins => p_reservation_minutes));

    IF v_mode = 'in_stock' THEN
      UPDATE inventory SET reserved = reserved + v_qty, updated_at = now() WHERE sku_id = v_sku_id;
      INSERT INTO inventory_movements (sku_id, delta, reason, reference_id)
      VALUES (v_sku_id, -v_qty, 'reserve', v_order_id::text);
    ELSE
      UPDATE inventory SET preorder_used = preorder_used + v_qty, updated_at = now() WHERE sku_id = v_sku_id;
    END IF;
  END LOOP;

  IF p_quote_id IS NOT NULL THEN
    UPDATE quotes SET consumed_order_id = v_order_id WHERE quote_id = p_quote_id AND consumed_order_id IS NULL;
  END IF;

  INSERT INTO outbox_jobs (topic, payload, idempotency_key)
  VALUES (
    p_outbox_topic,
    jsonb_build_object('order_id', v_order_id, 'order_code', p_order_code, 'total_twd', v_total),
    'order_created:' || p_idempotency_key
  );

  INSERT INTO audit_events (actor_kind, actor_id, action, subject_kind, subject_id, detail)
  VALUES ('system', NULL, 'order_created', 'order', v_order_id::text,
          jsonb_build_object('total_twd', v_total, 'lines', jsonb_array_length(v_sorted)));

  RETURN QUERY SELECT v_order_id, p_order_code, v_total, true;
END;
$$;

-- ---------------------------------------------------------------- 付款

-- 套用已驗證付款事件：事件唯一鍵去重，成功時把保留轉為已售出。
-- 同一平臺交易重送不得重複扣庫存；不同交易號重複付同一訂單轉財務核對。
CREATE OR REPLACE FUNCTION jp_apply_payment_event(
  p_event_key         text,
  p_order_id          uuid,
  p_attempt_id        uuid,
  p_provider          text,
  p_provider_trade_no text,
  p_amount_twd        integer,
  p_success           boolean,
  p_simulated         boolean,
  p_paid_at           timestamptz,
  p_raw_payload       jsonb,
  p_outbox_topic      text
) RETURNS TABLE (applied boolean, duplicate boolean, needs_review boolean)
LANGUAGE plpgsql
AS $$
DECLARE
  v_order         orders%ROWTYPE;
  v_existing_txn  payment_transactions%ROWTYPE;
  v_res         inventory_reservations%ROWTYPE;
BEGIN
  -- 事件去重：同一 event_key 只處理一次。
  IF EXISTS (SELECT 1 FROM payment_events e WHERE e.event_key = p_event_key) THEN
    RETURN QUERY SELECT false, true, false;
    RETURN;
  END IF;

  SELECT * INTO v_order FROM orders o WHERE o.order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_UNKNOWN_ORDER: 找不到訂單 %', p_order_id;
  END IF;

  INSERT INTO payment_events (
    event_key, attempt_id, order_id, provider, provider_trade_no, amount_twd, success, simulated, raw_payload
  ) VALUES (
    p_event_key, p_attempt_id, p_order_id, p_provider, p_provider_trade_no, p_amount_twd, p_success, p_simulated, p_raw_payload
  );

  IF NOT p_success THEN
    UPDATE payment_attempts SET status = 'failed', updated_at = now() WHERE attempt_id = p_attempt_id;
    RETURN QUERY SELECT true, false, false;
    RETURN;
  END IF;

  -- 同一平臺交易已存在：不重複扣庫存。
  SELECT * INTO v_existing_txn FROM payment_transactions t
   WHERE t.provider = p_provider AND t.provider_trade_no = p_provider_trade_no;
  IF FOUND THEN
    RETURN QUERY SELECT false, true, false;
    RETURN;
  END IF;

  -- 已取消或已逾期的訂單收到成功付款：保留款項事實，進入待核對，不自動出貨。
  IF v_order.status = 'cancelled' THEN
    INSERT INTO payment_transactions (order_id, attempt_id, provider, provider_trade_no, amount_twd, status, paid_at)
    VALUES (p_order_id, p_attempt_id, p_provider, p_provider_trade_no, p_amount_twd, 'needs_review', p_paid_at);

    UPDATE orders SET payment_status = 'needs_review', updated_at = now() WHERE order_id = p_order_id;

    INSERT INTO outbox_jobs (topic, payload, idempotency_key)
    VALUES (p_outbox_topic,
            jsonb_build_object('order_id', p_order_id, 'reason', 'late_payment_after_cancel', 'amount_twd', p_amount_twd),
            'late_payment:' || p_event_key);

    RETURN QUERY SELECT true, false, true;
    RETURN;
  END IF;

  -- 金額不符：記錄事實並轉財務核對，不當成已收款。
  IF p_amount_twd <> v_order.total_twd - v_order.paid_twd THEN
    INSERT INTO payment_transactions (order_id, attempt_id, provider, provider_trade_no, amount_twd, status, paid_at)
    VALUES (p_order_id, p_attempt_id, p_provider, p_provider_trade_no, p_amount_twd, 'needs_review', p_paid_at);

    UPDATE orders SET payment_status = 'needs_review', updated_at = now() WHERE order_id = p_order_id;

    INSERT INTO outbox_jobs (topic, payload, idempotency_key)
    VALUES (p_outbox_topic,
            jsonb_build_object('order_id', p_order_id, 'reason', 'amount_mismatch',
                               'expected_twd', v_order.total_twd - v_order.paid_twd, 'received_twd', p_amount_twd),
            'amount_mismatch:' || p_event_key);

    RETURN QUERY SELECT true, false, true;
    RETURN;
  END IF;

  INSERT INTO payment_transactions (order_id, attempt_id, provider, provider_trade_no, amount_twd, status, paid_at)
  VALUES (p_order_id, p_attempt_id, p_provider, p_provider_trade_no, p_amount_twd, 'paid', p_paid_at);

  UPDATE payment_attempts SET status = 'paid', updated_at = now() WHERE attempt_id = p_attempt_id;

  -- 保留轉為已售出：現貨扣 on_hand 並釋放 reserved；預購扣配額。
  FOR v_res IN
    SELECT * FROM inventory_reservations r
     WHERE r.order_id = p_order_id AND r.status = 'held'
     ORDER BY r.sku_id
     FOR UPDATE
  LOOP
    IF v_res.supply_mode = 'in_stock' THEN
      UPDATE inventory
         SET on_hand = on_hand - v_res.quantity,
             reserved = reserved - v_res.quantity,
             updated_at = now()
       WHERE sku_id = v_res.sku_id;
      INSERT INTO inventory_movements (sku_id, delta, reason, reference_id)
      VALUES (v_res.sku_id, -v_res.quantity, 'sale', p_order_id::text);
    END IF;
    UPDATE inventory_reservations
       SET status = 'converted', released_at = now(), release_reason = 'payment_confirmed'
     WHERE reservation_id = v_res.reservation_id;
  END LOOP;

  UPDATE orders
     SET payment_status = 'paid',
         status = CASE WHEN status = 'pending_payment' THEN 'confirmed' ELSE status END,
         paid_twd = paid_twd + p_amount_twd,
         updated_at = now()
   WHERE order_id = p_order_id;

  INSERT INTO outbox_jobs (topic, payload, idempotency_key)
  VALUES (p_outbox_topic,
          jsonb_build_object('order_id', p_order_id, 'order_code', v_order.order_code, 'amount_twd', p_amount_twd),
          'payment_confirmed:' || p_event_key);

  RETURN QUERY SELECT true, false, false;
END;
$$;

-- ---------------------------------------------------------------- 退款

-- 退款申請：request_key 冪等，並發退款鎖定可退餘額。
CREATE OR REPLACE FUNCTION jp_request_refund(
  p_order_id      uuid,
  p_request_key   text,
  p_amount_twd    integer,
  p_reason        text,
  p_requested_by  text
) RETURNS TABLE (refund_id uuid, created boolean, available_twd integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_order     orders%ROWTYPE;
  v_pending   integer;
  v_available integer;
  v_refund_id uuid;
BEGIN
  IF p_amount_twd IS NULL OR p_amount_twd <= 0 THEN
    RAISE EXCEPTION 'REFUND_INVALID_AMOUNT: 退款金額必須為正整數';
  END IF;

  -- 冪等：同一 request_key 回傳既有申請。
  SELECT r.refund_id INTO v_refund_id FROM refund_requests r WHERE r.request_key = p_request_key;
  IF FOUND THEN
    SELECT o.paid_twd - o.refunded_twd INTO v_available FROM orders o WHERE o.order_id = p_order_id;
    RETURN QUERY SELECT v_refund_id, false, COALESCE(v_available, 0);
    RETURN;
  END IF;

  -- 鎖定訂單列，序列化並發退款。
  SELECT * INTO v_order FROM orders o WHERE o.order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REFUND_UNKNOWN_ORDER: 找不到訂單 %', p_order_id;
  END IF;

  SELECT COALESCE(SUM(r.amount_twd), 0) INTO v_pending
    FROM refund_requests r
   WHERE r.order_id = p_order_id AND r.status IN ('requested', 'approved', 'sent');

  v_available := v_order.paid_twd - v_order.refunded_twd - v_pending;

  IF p_amount_twd > v_available THEN
    RAISE EXCEPTION 'REFUND_EXCEEDS_AVAILABLE: 可退餘額不足（可退 %，申請 %）', v_available, p_amount_twd;
  END IF;

  INSERT INTO refund_requests (order_id, request_key, amount_twd, reason, status)
  VALUES (p_order_id, p_request_key, p_amount_twd, p_reason, 'requested')
  RETURNING refund_requests.refund_id INTO v_refund_id;

  INSERT INTO audit_events (actor_kind, actor_id, action, subject_kind, subject_id, detail)
  VALUES ('staff', p_requested_by, 'refund_requested', 'order', p_order_id::text,
          jsonb_build_object('amount_twd', p_amount_twd, 'reason', p_reason));

  RETURN QUERY SELECT v_refund_id, true, v_available - p_amount_twd;
END;
$$;

-- 退款完成：確認後才更新帳務；已出貨訂單的財務異常不抹掉物流進度。
CREATE OR REPLACE FUNCTION jp_complete_refund(
  p_refund_id         uuid,
  p_provider_refund_no text,
  p_outbox_topic      text
) RETURNS TABLE (completed boolean, order_id uuid, refunded_twd integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_refund refund_requests%ROWTYPE;
  v_order  orders%ROWTYPE;
BEGIN
  SELECT * INTO v_refund FROM refund_requests r WHERE r.refund_id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REFUND_UNKNOWN: 找不到退款申請 %', p_refund_id;
  END IF;

  IF v_refund.status = 'completed' THEN
    SELECT * INTO v_order FROM orders o WHERE o.order_id = v_refund.order_id;
    RETURN QUERY SELECT false, v_refund.order_id, v_order.refunded_twd;
    RETURN;
  END IF;

  UPDATE refund_requests
     SET status = 'completed', provider_refund_no = p_provider_refund_no, updated_at = now()
   WHERE refund_id = p_refund_id;

  UPDATE orders
     SET refunded_twd = refunded_twd + v_refund.amount_twd,
         payment_status = CASE
           WHEN refunded_twd + v_refund.amount_twd >= paid_twd THEN 'refunded'
           ELSE 'partially_refunded'
         END,
         updated_at = now()
   WHERE order_id = v_refund.order_id
  RETURNING * INTO v_order;

  INSERT INTO outbox_jobs (topic, payload, idempotency_key)
  VALUES (p_outbox_topic,
          jsonb_build_object('order_id', v_refund.order_id, 'refund_id', p_refund_id, 'amount_twd', v_refund.amount_twd),
          'refund_completed:' || p_refund_id::text);

  RETURN QUERY SELECT true, v_refund.order_id, v_order.refunded_twd;
END;
$$;

-- ---------------------------------------------------------------- 逾期釋放

-- 釋放逾期保留。逾期前先確認金流是否可能已完成：有 needs_review 付款事件的訂單不釋放。
CREATE OR REPLACE FUNCTION jp_release_expired_reservations(
  p_limit integer DEFAULT 200
) RETURNS TABLE (released_count integer, skipped_count integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_res       inventory_reservations%ROWTYPE;
  v_released  integer := 0;
  v_skipped   integer := 0;
  v_has_pay   boolean;
BEGIN
  FOR v_res IN
    SELECT * FROM inventory_reservations r
     WHERE r.status = 'held' AND r.expires_at <= now()
     ORDER BY r.expires_at
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  LOOP
    -- 逾期釋放前先檢查金流是否可能已完成。
    SELECT EXISTS (
      SELECT 1 FROM payment_events e
       WHERE e.order_id = v_res.order_id AND e.success
    ) INTO v_has_pay;

    IF v_has_pay THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF v_res.supply_mode = 'in_stock' THEN
      UPDATE inventory SET reserved = reserved - v_res.quantity, updated_at = now() WHERE sku_id = v_res.sku_id;
      INSERT INTO inventory_movements (sku_id, delta, reason, reference_id)
      VALUES (v_res.sku_id, v_res.quantity, 'release', v_res.order_id::text);
    ELSE
      UPDATE inventory SET preorder_used = preorder_used - v_res.quantity, updated_at = now() WHERE sku_id = v_res.sku_id;
    END IF;

    UPDATE inventory_reservations
       SET status = 'expired', released_at = now(), release_reason = 'ttl_expired'
     WHERE reservation_id = v_res.reservation_id;

    v_released := v_released + 1;
  END LOOP;

  RETURN QUERY SELECT v_released, v_skipped;
END;
$$;

-- ---------------------------------------------------------------- outbox

-- 認領 outbox 工作：租約 + SKIP LOCKED，崩潰後可由其他 worker 接手。
CREATE OR REPLACE FUNCTION jp_claim_outbox_jobs(
  p_worker_id     text,
  p_limit         integer DEFAULT 20,
  p_lease_seconds integer DEFAULT 120
) RETURNS SETOF outbox_jobs
LANGUAGE plpgsql
AS $$
BEGIN
  -- 先回收逾期租約。
  UPDATE outbox_jobs
     SET status = 'pending', lease_owner = NULL, lease_expires_at = NULL, updated_at = now()
   WHERE status = 'leased' AND lease_expires_at <= now();

  RETURN QUERY
  WITH claimed AS (
    SELECT j.job_id FROM outbox_jobs j
     WHERE j.status = 'pending' AND j.available_at <= now()
     ORDER BY j.available_at
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  )
  UPDATE outbox_jobs j
     SET status = 'leased',
         lease_owner = p_worker_id,
         lease_expires_at = now() + make_interval(secs => p_lease_seconds),
         attempts = j.attempts + 1,
         updated_at = now()
    FROM claimed c
   WHERE j.job_id = c.job_id
  RETURNING j.*;
END;
$$;

-- 完成或失敗 outbox 工作；重試達上限送失敗佇列，不無限重試。
CREATE OR REPLACE FUNCTION jp_finish_outbox_job(
  p_job_id    uuid,
  p_succeeded boolean,
  p_error     text DEFAULT NULL
) RETURNS TABLE (status text, attempts integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_job outbox_jobs%ROWTYPE;
  v_next timestamptz;
BEGIN
  SELECT * INTO v_job FROM outbox_jobs j WHERE j.job_id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OUTBOX_UNKNOWN_JOB: 找不到工作 %', p_job_id;
  END IF;

  IF p_succeeded THEN
    UPDATE outbox_jobs
       SET status = 'succeeded', lease_owner = NULL, lease_expires_at = NULL, last_error = NULL, updated_at = now()
     WHERE job_id = p_job_id
    RETURNING * INTO v_job;
  ELSIF v_job.attempts >= v_job.max_attempts THEN
    UPDATE outbox_jobs
       SET status = 'dead', lease_owner = NULL, lease_expires_at = NULL, last_error = p_error, updated_at = now()
     WHERE job_id = p_job_id
    RETURNING * INTO v_job;
  ELSE
    -- 指數退避，上限 30 分鐘。
    v_next := now() + make_interval(secs => LEAST(1800, (2 ^ v_job.attempts)::integer));
    UPDATE outbox_jobs
       SET status = 'pending', lease_owner = NULL, lease_expires_at = NULL,
           available_at = v_next, last_error = p_error, updated_at = now()
     WHERE job_id = p_job_id
    RETURNING * INTO v_job;
  END IF;

  RETURN QUERY SELECT v_job.status, v_job.attempts;
END;
$$;

COMMIT;
