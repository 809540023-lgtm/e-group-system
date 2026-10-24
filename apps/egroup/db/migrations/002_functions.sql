-- 002_functions.sql — 交易函式
-- 所有會改變庫存、付款、交付、召回、推薦與結算的操作都必須走這些函式，
-- 以確保同一交易、固定鎖定順序與稽核紀錄。

BEGIN;

CREATE OR REPLACE FUNCTION eg_audit(
  p_actor_type text,
  p_actor_id text,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_before jsonb,
  p_after jsonb,
  p_reason text DEFAULT NULL
) RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO audit_events(actor_type, actor_id, action, entity_type, entity_id, before_json, after_json, reason)
  VALUES (p_actor_type, p_actor_id, p_action, p_entity_type, p_entity_id, p_before, p_after, p_reason);
$$;

-- 建立訂單：鎖定批次、保留庫存、寫入明細與稽核，全部在同一交易。
CREATE OR REPLACE FUNCTION eg_create_order(
  p_customer_id uuid,
  p_station_id uuid,
  p_lines jsonb,
  p_delivery_fee integer,
  p_station_fee integer,
  p_pickup_hash text,
  p_pickup_expires timestamptz,
  p_referral_code text,
  p_idempotency_key text,
  p_actor text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing jsonb;
  v_order_id uuid;
  v_order_no text;
  v_subtotal integer := 0;
  v_total integer;
  v_line record;
  v_batch record;
  v_product record;
  v_need integer;
  v_take integer;
  v_available integer;
  v_skus text[];
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT response_json INTO v_existing FROM idempotency_keys WHERE key = p_idempotency_key;
    IF FOUND THEN
      RETURN v_existing;
    END IF;
  END IF;

  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'ORDER_EMPTY';
  END IF;

  PERFORM 1 FROM stations WHERE id = p_station_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STATION_UNAVAILABLE';
  END IF;

  SELECT array_agg(DISTINCT x.sku ORDER BY x.sku)
    INTO v_skus
    FROM jsonb_to_recordset(p_lines) AS x(sku text, quantity integer);

  -- 固定 SKU 順序鎖定，避免相反順序死鎖。
  PERFORM 1
    FROM batches b
   WHERE b.sku = ANY(v_skus)
     AND b.status = 'available'
     AND b.expires_on >= current_date
   ORDER BY b.sku, b.expires_on
   FOR UPDATE;

  v_order_no := 'EG' || to_char(now(), 'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

  INSERT INTO orders(
    order_no, customer_id, station_id, subtotal_twd, delivery_fee_twd,
    station_fee_twd, total_twd, pickup_code_hash, pickup_code_expires_at, referral_code
  ) VALUES (
    v_order_no, p_customer_id, p_station_id, 0, p_delivery_fee,
    p_station_fee, 0, p_pickup_hash, p_pickup_expires, p_referral_code
  ) RETURNING id INTO v_order_id;

  FOR v_line IN
    SELECT x.sku, x.quantity
      FROM jsonb_to_recordset(p_lines) AS x(sku text, quantity integer)
     ORDER BY x.sku
  LOOP
    IF v_line.quantity IS NULL OR v_line.quantity <= 0 THEN
      RAISE EXCEPTION 'ORDER_QUANTITY_INVALID:%', v_line.sku;
    END IF;

    SELECT * INTO v_product FROM products WHERE sku = v_line.sku;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRODUCT_NOT_FOUND:%', v_line.sku;
    END IF;
    IF v_product.status <> 'active' THEN
      RAISE EXCEPTION 'PRODUCT_NOT_ACTIVE:%', v_line.sku;
    END IF;
    IF EXISTS (SELECT 1 FROM recalls r WHERE r.status = 'open' AND r.sku = v_line.sku) THEN
      RAISE EXCEPTION 'RECALL_BLOCKED:%', v_line.sku;
    END IF;

    v_need := v_line.quantity;
    FOR v_batch IN
      SELECT * FROM batches b
       WHERE b.sku = v_line.sku
         AND b.status = 'available'
         AND b.expires_on >= current_date
       ORDER BY b.expires_on, b.created_at
    LOOP
      EXIT WHEN v_need <= 0;
      v_available := v_batch.quantity_available - v_batch.quantity_reserved;
      IF v_available <= 0 THEN
        CONTINUE;
      END IF;
      v_take := LEAST(v_available, v_need);

      UPDATE batches
         SET quantity_reserved = quantity_reserved + v_take
       WHERE id = v_batch.id;

      INSERT INTO order_items(order_id, sku, batch_id, quantity, unit_price_twd, line_total_twd)
      VALUES (v_order_id, v_line.sku, v_batch.id, v_take, v_product.price_twd, v_product.price_twd * v_take);

      INSERT INTO inventory_movements(batch_id, station_id, type, quantity, ref_type, ref_id, actor)
      VALUES (v_batch.id, p_station_id, 'reserve', v_take, 'order', v_order_id::text, p_actor);

      v_subtotal := v_subtotal + v_product.price_twd * v_take;
      v_need := v_need - v_take;
    END LOOP;

    IF v_need > 0 THEN
      RAISE EXCEPTION 'OUT_OF_STOCK:%', v_line.sku;
    END IF;
  END LOOP;

  v_total := v_subtotal + p_delivery_fee + p_station_fee;
  UPDATE orders SET subtotal_twd = v_subtotal, total_twd = v_total WHERE id = v_order_id;

  PERFORM eg_audit(
    'customer', p_customer_id::text, 'order.create', 'order', v_order_id::text,
    NULL, jsonb_build_object('order_no', v_order_no, 'total_twd', v_total), NULL
  );

  v_existing := jsonb_build_object(
    'order_id', v_order_id,
    'order_no', v_order_no,
    'subtotal_twd', v_subtotal,
    'total_twd', v_total
  );

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO idempotency_keys(key, scope, response_json)
    VALUES (p_idempotency_key, 'create_order', v_existing);
  END IF;

  RETURN v_existing;
END;
$$;

-- 付款：冪等；同一 idempotency_key 重送不得重複收款。
CREATE OR REPLACE FUNCTION eg_pay_order(
  p_order_id uuid,
  p_provider text,
  p_txn_id text,
  p_idempotency_key text,
  p_actor text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_order orders;
  v_payment payments;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;
  IF v_order.payment_status = 'paid' THEN
    RETURN jsonb_build_object('status', 'already_paid', 'order_id', p_order_id);
  END IF;
  IF v_order.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'ORDER_NOT_PAYABLE';
  END IF;

  INSERT INTO payments(order_id, provider, provider_txn_id, amount_twd, status, idempotency_key)
  VALUES (p_order_id, p_provider, p_txn_id, v_order.total_twd, 'succeeded', p_idempotency_key)
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING * INTO v_payment;

  IF v_payment.id IS NULL THEN
    SELECT * INTO v_payment FROM payments WHERE idempotency_key = p_idempotency_key;
    RETURN jsonb_build_object('status', 'duplicate', 'payment_id', v_payment.id);
  END IF;

  UPDATE orders
     SET status = 'paid', payment_status = 'paid', updated_at = now()
   WHERE id = p_order_id;

  PERFORM eg_audit(
    'system', p_actor, 'order.pay', 'order', p_order_id::text,
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', 'paid', 'payment_id', v_payment.id), NULL
  );

  RETURN jsonb_build_object('status', 'paid', 'payment_id', v_payment.id);
END;
$$;

-- 交付：取貨碼一次性、召回阻擋、離線事件去重。
CREATE OR REPLACE FUNCTION eg_deliver_order(
  p_order_id uuid,
  p_code text,
  p_secret text,
  p_actor text,
  p_client_event_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_order orders;
  v_delivery deliveries;
  v_item record;
  v_recalled boolean;
BEGIN
  IF p_client_event_id IS NOT NULL THEN
    SELECT * INTO v_delivery FROM deliveries WHERE client_event_id = p_client_event_id;
    IF FOUND THEN
      RETURN jsonb_build_object('status', 'duplicate', 'delivery_id', v_delivery.id);
    END IF;
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;
  IF v_order.pickup_code_used_at IS NOT NULL THEN
    RAISE EXCEPTION 'PICKUP_CODE_USED';
  END IF;
  IF v_order.pickup_code_expires_at < now() THEN
    RAISE EXCEPTION 'PICKUP_CODE_EXPIRED';
  END IF;
  IF v_order.status NOT IN ('ready', 'preparing') THEN
    RAISE EXCEPTION 'ORDER_NOT_DELIVERABLE';
  END IF;
  IF encode(hmac(p_code, p_secret, 'sha256'), 'hex') <> v_order.pickup_code_hash THEN
    RAISE EXCEPTION 'PICKUP_CODE_INVALID';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM recalls r
      JOIN order_items oi ON oi.sku = r.sku
     WHERE oi.order_id = p_order_id
       AND r.status = 'open'
  ) INTO v_recalled;
  IF v_recalled THEN
    RAISE EXCEPTION 'RECALL_BLOCKED';
  END IF;

  UPDATE orders
     SET status = 'delivered', pickup_code_used_at = now(), updated_at = now()
   WHERE id = p_order_id;

  INSERT INTO deliveries(order_id, station_id, delivered_by, method, client_event_id)
  VALUES (p_order_id, v_order.station_id, p_actor, 'scan', p_client_event_id)
  RETURNING * INTO v_delivery;

  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    UPDATE batches
       SET quantity_reserved = quantity_reserved - v_item.quantity,
           quantity_available = quantity_available - v_item.quantity,
           status = CASE
                      WHEN quantity_available - v_item.quantity <= 0 THEN 'depleted'
                      ELSE status
                    END
     WHERE id = v_item.batch_id;

    INSERT INTO inventory_movements(batch_id, station_id, type, quantity, ref_type, ref_id, actor)
    VALUES (v_item.batch_id, v_order.station_id, 'deliver', v_item.quantity, 'order', p_order_id::text, p_actor);
  END LOOP;

  PERFORM eg_audit(
    'station', p_actor, 'order.deliver', 'order', p_order_id::text,
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', 'delivered'), NULL
  );

  RETURN jsonb_build_object('status', 'delivered', 'delivery_id', v_delivery.id);
END;
$$;

-- 退款：冪等、不得超過可退餘額、未交付則釋放保留、已發推薦獎勵扣回。
CREATE OR REPLACE FUNCTION eg_refund_order(
  p_order_id uuid,
  p_amount integer,
  p_reason text,
  p_idempotency_key text,
  p_actor text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_order orders;
  v_refunded integer;
  v_refund refunds;
  v_item record;
  v_new_status text;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;
  IF v_order.payment_status NOT IN ('paid', 'partially_refunded') THEN
    RAISE EXCEPTION 'ORDER_NOT_REFUNDABLE';
  END IF;

  SELECT COALESCE(SUM(amount_twd), 0) INTO v_refunded
    FROM refunds
   WHERE order_id = p_order_id AND status IN ('approved', 'completed');

  IF p_amount <= 0 OR v_refunded + p_amount > v_order.total_twd THEN
    RAISE EXCEPTION 'REFUND_EXCEEDS_PAID';
  END IF;

  INSERT INTO refunds(order_id, amount_twd, reason, status, idempotency_key)
  VALUES (p_order_id, p_amount, p_reason, 'completed', p_idempotency_key)
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING * INTO v_refund;

  IF v_refund.id IS NULL THEN
    SELECT * INTO v_refund FROM refunds WHERE idempotency_key = p_idempotency_key;
    RETURN jsonb_build_object('status', 'duplicate', 'refund_id', v_refund.id);
  END IF;

  IF v_refunded + p_amount >= v_order.total_twd THEN
    v_new_status := 'refunded';
    UPDATE orders SET payment_status = 'refunded', status = 'refunded', updated_at = now() WHERE id = p_order_id;
  ELSE
    v_new_status := 'partially_refunded';
    UPDATE orders SET payment_status = 'partially_refunded', updated_at = now() WHERE id = p_order_id;
  END IF;

  IF v_order.status <> 'delivered' THEN
    FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
      UPDATE batches
         SET quantity_reserved = GREATEST(0, quantity_reserved - v_item.quantity)
       WHERE id = v_item.batch_id;
      INSERT INTO inventory_movements(batch_id, station_id, type, quantity, ref_type, ref_id, actor)
      VALUES (v_item.batch_id, v_order.station_id, 'release', v_item.quantity, 'refund', p_order_id::text, p_actor);
    END LOOP;
  END IF;

  UPDATE referrals
     SET status = 'reversed', reason = '訂單退款'
   WHERE order_id = p_order_id AND status = 'approved';

  PERFORM eg_audit(
    'admin', p_actor, 'order.refund', 'order', p_order_id::text,
    jsonb_build_object('payment_status', v_order.payment_status),
    jsonb_build_object('refund_twd', p_amount, 'payment_status', v_new_status), p_reason
  );

  RETURN jsonb_build_object('status', 'refunded', 'refund_id', v_refund.id, 'amount_twd', p_amount);
END;
$$;

-- 召回：停賣、鎖批、建立受影響訂單通知。
CREATE OR REPLACE FUNCTION eg_recall_batch(
  p_batch_id uuid,
  p_reason text,
  p_actor text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_batch batches;
  v_recall recalls;
  v_order record;
BEGIN
  SELECT * INTO v_batch FROM batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BATCH_NOT_FOUND';
  END IF;

  INSERT INTO recalls(sku, batch_id, reason, created_by)
  VALUES (v_batch.sku, p_batch_id, p_reason, p_actor)
  RETURNING * INTO v_recall;

  UPDATE batches SET status = 'recalled' WHERE id = p_batch_id;
  UPDATE products SET status = 'recalled', updated_at = now() WHERE sku = v_batch.sku;

  FOR v_order IN
    SELECT DISTINCT o.id, o.customer_id
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
     WHERE oi.batch_id = p_batch_id
       AND o.status NOT IN ('cancelled', 'refunded')
  LOOP
    INSERT INTO recall_notifications(recall_id, order_id, customer_id, channel)
    VALUES (v_recall.id, v_order.id, v_order.customer_id, 'line');
  END LOOP;

  PERFORM eg_audit(
    'admin', p_actor, 'recall.open', 'batch', p_batch_id::text,
    jsonb_build_object('status', v_batch.status),
    jsonb_build_object('status', 'recalled', 'recall_id', v_recall.id), p_reason
  );

  RETURN jsonb_build_object('recall_id', v_recall.id, 'sku', v_batch.sku, 'batch_id', p_batch_id);
END;
$$;

CREATE OR REPLACE FUNCTION eg_close_recall(
  p_recall_id uuid,
  p_actor text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_recall recalls;
  v_pending integer;
BEGIN
  SELECT * INTO v_recall FROM recalls WHERE id = p_recall_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RECALL_NOT_FOUND';
  END IF;

  SELECT COUNT(*) INTO v_pending
    FROM recall_notifications
   WHERE recall_id = p_recall_id AND status <> 'sent';
  IF v_pending > 0 THEN
    RAISE EXCEPTION 'RECALL_NOTIFICATIONS_PENDING:%', v_pending;
  END IF;

  UPDATE recalls SET status = 'closed', closed_at = now() WHERE id = p_recall_id;

  PERFORM eg_audit(
    'admin', p_actor, 'recall.close', 'recall', p_recall_id::text,
    jsonb_build_object('status', 'open'), jsonb_build_object('status', 'closed'), NULL
  );

  RETURN jsonb_build_object('status', 'closed');
END;
$$;

-- 收貨：更新批次可售量並記錄溫度。
CREATE OR REPLACE FUNCTION eg_receive_shipment(
  p_shipment_id uuid,
  p_temp numeric,
  p_actor text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_ship shipments;
BEGIN
  SELECT * INTO v_ship FROM shipments WHERE id = p_shipment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHIPMENT_NOT_FOUND';
  END IF;
  IF v_ship.status <> 'in_transit' THEN
    RAISE EXCEPTION 'SHIPMENT_NOT_IN_TRANSIT';
  END IF;

  UPDATE shipments
     SET status = 'received', received_at = now(), received_temp_c = p_temp
   WHERE id = p_shipment_id;

  UPDATE batches
     SET quantity_available = quantity_available + v_ship.quantity
   WHERE id = v_ship.batch_id;

  INSERT INTO inventory_movements(batch_id, station_id, type, quantity, ref_type, ref_id, actor)
  VALUES (v_ship.batch_id, v_ship.station_id, 'receive', v_ship.quantity, 'shipment', p_shipment_id::text, p_actor);

  PERFORM eg_audit(
    'station', p_actor, 'shipment.receive', 'shipment', p_shipment_id::text,
    jsonb_build_object('status', 'in_transit'),
    jsonb_build_object('status', 'received', 'temp_c', p_temp), NULL
  );

  RETURN jsonb_build_object('status', 'received');
END;
$$;

-- 溫度事件：超標即隔離批次。
CREATE OR REPLACE FUNCTION eg_log_temperature(
  p_station_id uuid,
  p_batch_id uuid,
  p_temp numeric,
  p_duration integer,
  p_status text,
  p_action text,
  p_actor text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_event temperature_events;
BEGIN
  INSERT INTO temperature_events(station_id, batch_id, temp_c, duration_minutes, status, action, actor)
  VALUES (p_station_id, p_batch_id, p_temp, p_duration, p_status, p_action, p_actor)
  RETURNING * INTO v_event;

  IF p_status = 'breach' AND p_batch_id IS NOT NULL THEN
    UPDATE batches SET status = 'quarantined' WHERE id = p_batch_id AND status = 'available';
    INSERT INTO inventory_movements(batch_id, station_id, type, quantity, ref_type, ref_id, actor, note)
    VALUES (p_batch_id, p_station_id, 'quarantine', 0, 'temperature', v_event.id::text, p_actor, p_action);
  END IF;

  PERFORM eg_audit(
    'station', p_actor, 'temperature.log', 'temperature_event', v_event.id::text,
    NULL, jsonb_build_object('status', p_status, 'temp_c', p_temp), p_action
  );

  RETURN jsonb_build_object('event_id', v_event.id, 'status', p_status);
END;
$$;

-- 站點結算：同一訂單不得重複計酬。
CREATE OR REPLACE FUNCTION eg_settle_station(
  p_station_id uuid,
  p_start date,
  p_end date,
  p_fee integer,
  p_bonus integer,
  p_deductions jsonb,
  p_actor text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_settlement service_settlements;
  v_count integer;
  v_deductions integer;
  v_order record;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM orders o
   WHERE o.station_id = p_station_id
     AND o.status = 'delivered'
     AND o.created_at::date BETWEEN p_start AND p_end
     AND NOT EXISTS (SELECT 1 FROM settlement_orders so WHERE so.order_id = o.id);

  SELECT COALESCE(SUM((d->>'amount_twd')::integer), 0)
    INTO v_deductions
    FROM jsonb_array_elements(COALESCE(p_deductions, '[]'::jsonb)) d;

  INSERT INTO service_settlements(
    station_id, period_start, period_end, delivered_count,
    service_fee_twd, quality_bonus_twd, deductions_twd, net_twd
  ) VALUES (
    p_station_id, p_start, p_end, v_count,
    v_count * p_fee, p_bonus, v_deductions, v_count * p_fee + p_bonus - v_deductions
  ) RETURNING * INTO v_settlement;

  FOR v_order IN
    SELECT o.id
      FROM orders o
     WHERE o.station_id = p_station_id
       AND o.status = 'delivered'
       AND o.created_at::date BETWEEN p_start AND p_end
       AND NOT EXISTS (SELECT 1 FROM settlement_orders so WHERE so.order_id = o.id)
  LOOP
    INSERT INTO settlement_orders(settlement_id, order_id) VALUES (v_settlement.id, v_order.id);
  END LOOP;

  PERFORM eg_audit(
    'admin', p_actor, 'settlement.create', 'service_settlement', v_settlement.id::text,
    NULL, jsonb_build_object('net_twd', v_settlement.net_twd, 'delivered_count', v_count), NULL
  );

  RETURN jsonb_build_object('settlement_id', v_settlement.id, 'delivered_count', v_count, 'net_twd', v_settlement.net_twd);
END;
$$;

-- 推薦歸因：單層、不得自薦、被推薦人僅一次歸因。
CREATE OR REPLACE FUNCTION eg_apply_referral(
  p_order_id uuid,
  p_referral_code text,
  p_reward integer,
  p_actor text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_order orders;
  v_referrer customers;
  v_referee customers;
  v_referral referrals;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  SELECT * INTO v_referrer FROM customers WHERE referral_code = p_referral_code;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REFERRAL_CODE_NOT_FOUND';
  END IF;

  SELECT * INTO v_referee FROM customers WHERE id = v_order.customer_id;
  IF v_referrer.id = v_referee.id THEN
    RAISE EXCEPTION 'SELF_REFERRAL';
  END IF;
  IF v_referee.referred_by IS NOT NULL THEN
    RAISE EXCEPTION 'REFEREE_ALREADY_ATTRIBUTED';
  END IF;

  INSERT INTO referrals(referrer_customer_id, referee_customer_id, order_id, reward_twd)
  VALUES (v_referrer.id, v_referee.id, p_order_id, p_reward)
  RETURNING * INTO v_referral;

  UPDATE customers SET referred_by = v_referrer.id WHERE id = v_referee.id;

  PERFORM eg_audit(
    'customer', p_actor, 'referral.apply', 'referral', v_referral.id::text,
    NULL, jsonb_build_object('reward_twd', p_reward), NULL
  );

  RETURN jsonb_build_object('referral_id', v_referral.id, 'status', 'pending');
END;
$$;

CREATE OR REPLACE FUNCTION eg_approve_referral(
  p_referral_id uuid,
  p_actor text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_ref referrals;
  v_order orders;
BEGIN
  SELECT * INTO v_ref FROM referrals WHERE id = p_referral_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REFERRAL_NOT_FOUND';
  END IF;
  IF v_ref.status <> 'pending' THEN
    RAISE EXCEPTION 'REFERRAL_NOT_PENDING';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = v_ref.order_id;
  IF v_order.status <> 'delivered' THEN
    RAISE EXCEPTION 'REFERRAL_ORDER_NOT_DELIVERED';
  END IF;
  IF v_order.payment_status = 'refunded' THEN
    RAISE EXCEPTION 'REFERRAL_ORDER_REFUNDED';
  END IF;

  UPDATE referrals SET status = 'approved' WHERE id = p_referral_id;
  UPDATE customers SET points = points + v_ref.reward_twd WHERE id = v_ref.referrer_customer_id;

  PERFORM eg_audit(
    'admin', p_actor, 'referral.approve', 'referral', p_referral_id::text,
    jsonb_build_object('status', 'pending'), jsonb_build_object('status', 'approved'), NULL
  );

  RETURN jsonb_build_object('status', 'approved', 'reward_twd', v_ref.reward_twd);
END;
$$;

CREATE OR REPLACE FUNCTION eg_reverse_referral(
  p_referral_id uuid,
  p_actor text,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_ref referrals;
BEGIN
  SELECT * INTO v_ref FROM referrals WHERE id = p_referral_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REFERRAL_NOT_FOUND';
  END IF;
  IF v_ref.status <> 'approved' THEN
    RAISE EXCEPTION 'REFERRAL_NOT_APPROVED';
  END IF;

  UPDATE referrals SET status = 'reversed', reason = p_reason WHERE id = p_referral_id;
  UPDATE customers SET points = GREATEST(0, points - v_ref.reward_twd) WHERE id = v_ref.referrer_customer_id;

  PERFORM eg_audit(
    'admin', p_actor, 'referral.reverse', 'referral', p_referral_id::text,
    jsonb_build_object('status', 'approved'), jsonb_build_object('status', 'reversed'), p_reason
  );

  RETURN jsonb_build_object('status', 'reversed');
END;
$$;

-- 離線事件補送：client_event_id 去重，處理後標記。
CREATE OR REPLACE FUNCTION eg_process_offline_event(
  p_client_event_id text,
  p_station_id uuid,
  p_type text,
  p_payload jsonb,
  p_actor text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_event offline_events;
BEGIN
  INSERT INTO offline_events(client_event_id, station_id, type, payload)
  VALUES (p_client_event_id, p_station_id, p_type, p_payload)
  ON CONFLICT (client_event_id) DO NOTHING
  RETURNING * INTO v_event;

  IF v_event.id IS NULL THEN
    SELECT * INTO v_event FROM offline_events WHERE client_event_id = p_client_event_id;
    RETURN jsonb_build_object('status', 'duplicate', 'event_id', v_event.id);
  END IF;

  IF p_type = 'deliver' THEN
    PERFORM eg_deliver_order(
      (p_payload->>'order_id')::uuid,
      p_payload->>'code',
      p_payload->>'secret',
      p_actor,
      p_client_event_id
    );
  ELSIF p_type = 'temperature' THEN
    PERFORM eg_log_temperature(
      p_station_id,
      NULLIF(p_payload->>'batch_id', '')::uuid,
      (p_payload->>'temp_c')::numeric,
      COALESCE((p_payload->>'duration_minutes')::integer, 0),
      p_payload->>'status',
      COALESCE(p_payload->>'action', '離線補送'),
      p_actor
    );
  END IF;

  UPDATE offline_events SET processed_at = now(), result = 'processed' WHERE id = v_event.id;
  RETURN jsonb_build_object('status', 'processed', 'event_id', v_event.id);
END;
$$;

COMMIT;
