-- 005_kpi.sql — 績效指標所需的資料欄位
-- 計畫書第十七章以「訂單準時備妥率」為驗收指標，因此訂單必須有承諾備妥時間。
-- 承諾時間依站型給定前置時間：C 型（加熱組餐）最短，D 型（區域補給）最長。

BEGIN;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS promised_ready_at timestamptz;

UPDATE orders
   SET promised_ready_at = created_at + interval '4 hours'
 WHERE promised_ready_at IS NULL;

ALTER TABLE orders ALTER COLUMN promised_ready_at SET DEFAULT (now() + interval '4 hours');
ALTER TABLE orders ALTER COLUMN promised_ready_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS orders_promised_ready_at_idx ON orders(promised_ready_at);
CREATE INDEX IF NOT EXISTS audit_events_action_entity_idx ON audit_events(action, entity_id);

CREATE OR REPLACE FUNCTION eg_station_lead_time(p_type text)
RETURNS interval
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_type
           WHEN 'C' THEN interval '2 hours'
           WHEN 'A' THEN interval '4 hours'
           WHEN 'B' THEN interval '6 hours'
           WHEN 'D' THEN interval '8 hours'
           ELSE interval '4 hours'
         END;
$$;

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
  v_station stations;
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

  SELECT * INTO v_station FROM stations WHERE id = p_station_id AND status = 'active';
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
    station_fee_twd, total_twd, pickup_code_hash, pickup_code_expires_at,
    referral_code, promised_ready_at
  ) VALUES (
    v_order_no, p_customer_id, p_station_id, 0, p_delivery_fee,
    p_station_fee, 0, p_pickup_hash, p_pickup_expires,
    p_referral_code, now() + eg_station_lead_time(v_station.type)
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
    -- 召回優先於商品狀態：召回中的商品一律以 RECALL_BLOCKED 回報。
    IF EXISTS (SELECT 1 FROM recalls r WHERE r.status = 'open' AND r.sku = v_line.sku) THEN
      RAISE EXCEPTION 'RECALL_BLOCKED:%', v_line.sku;
    END IF;
    IF v_product.status <> 'active' THEN
      RAISE EXCEPTION 'PRODUCT_NOT_ACTIVE:%', v_line.sku;
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

COMMIT;
