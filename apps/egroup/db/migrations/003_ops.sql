-- 003_ops.sql — 站點與供應商營運交易
-- 將「標記可取貨、批次隔離、加熱紀錄、建立出貨單」等跨表動作集中於交易函式，
-- 確保每次狀態變更都留下稽核紀錄。

BEGIN;

CREATE OR REPLACE FUNCTION eg_mark_order_ready(
  p_order_id uuid,
  p_actor text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_order orders;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;
  IF v_order.status NOT IN ('paid', 'preparing') THEN
    RAISE EXCEPTION 'ORDER_NOT_PREPARABLE';
  END IF;

  UPDATE orders SET status = 'ready', updated_at = now() WHERE id = p_order_id;

  PERFORM eg_audit(
    'station', p_actor, 'order.ready', 'order', p_order_id::text,
    jsonb_build_object('status', v_order.status), jsonb_build_object('status', 'ready'), NULL
  );

  RETURN jsonb_build_object('status', 'ready');
END;
$$;

CREATE OR REPLACE FUNCTION eg_quarantine_batch(
  p_batch_id uuid,
  p_reason text,
  p_actor text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_batch batches;
BEGIN
  SELECT * INTO v_batch FROM batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BATCH_NOT_FOUND';
  END IF;
  IF v_batch.status = 'recalled' THEN
    RAISE EXCEPTION 'BATCH_ALREADY_RECALLED';
  END IF;

  UPDATE batches SET status = 'quarantined' WHERE id = p_batch_id;

  INSERT INTO inventory_movements(batch_id, station_id, type, quantity, ref_type, ref_id, actor, note)
  VALUES (p_batch_id, v_batch.station_id, 'quarantine', v_batch.quantity_available, 'batch', p_batch_id::text, p_actor, p_reason);

  PERFORM eg_audit(
    'station', p_actor, 'batch.quarantine', 'batch', p_batch_id::text,
    jsonb_build_object('status', v_batch.status), jsonb_build_object('status', 'quarantined'), p_reason
  );

  RETURN jsonb_build_object('status', 'quarantined');
END;
$$;

CREATE OR REPLACE FUNCTION eg_release_quarantine(
  p_batch_id uuid,
  p_actor text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_batch batches;
BEGIN
  SELECT * INTO v_batch FROM batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BATCH_NOT_FOUND';
  END IF;
  IF v_batch.status <> 'quarantined' THEN
    RAISE EXCEPTION 'BATCH_NOT_QUARANTINED';
  END IF;

  UPDATE batches SET status = 'available' WHERE id = p_batch_id;

  PERFORM eg_audit(
    'station', p_actor, 'batch.release', 'batch', p_batch_id::text,
    jsonb_build_object('status', 'quarantined'), jsonb_build_object('status', 'available'), NULL
  );

  RETURN jsonb_build_object('status', 'available');
END;
$$;

CREATE OR REPLACE FUNCTION eg_record_heating(
  p_order_id uuid,
  p_station_id uuid,
  p_sku text,
  p_equipment_id uuid,
  p_duration_seconds integer,
  p_core_temp numeric,
  p_operator text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_duration_seconds <= 0 THEN
    RAISE EXCEPTION 'HEATING_DURATION_INVALID';
  END IF;

  INSERT INTO heating_records(order_id, station_id, sku, equipment_id, duration_seconds, core_temp_c, operator)
  VALUES (p_order_id, p_station_id, p_sku, p_equipment_id, p_duration_seconds, p_core_temp, p_operator)
  RETURNING id INTO v_id;

  PERFORM eg_audit(
    'station', p_operator, 'heating.record', 'heating_record', v_id::text,
    NULL, jsonb_build_object('sku', p_sku, 'duration_seconds', p_duration_seconds, 'core_temp_c', p_core_temp), NULL
  );

  RETURN jsonb_build_object('heating_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION eg_create_shipment(
  p_supplier_id uuid,
  p_station_id uuid,
  p_batch_id uuid,
  p_quantity integer,
  p_note text,
  p_actor text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_batch batches;
  v_id uuid;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'SHIPMENT_QUANTITY_INVALID';
  END IF;

  SELECT * INTO v_batch FROM batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BATCH_NOT_FOUND';
  END IF;
  IF v_batch.supplier_id <> p_supplier_id THEN
    RAISE EXCEPTION 'SHIPMENT_SUPPLIER_MISMATCH';
  END IF;
  IF v_batch.status <> 'available' THEN
    RAISE EXCEPTION 'BATCH_NOT_AVAILABLE';
  END IF;
  IF p_quantity > v_batch.quantity_available - v_batch.quantity_reserved THEN
    RAISE EXCEPTION 'SHIPMENT_EXCEEDS_STOCK';
  END IF;

  INSERT INTO shipments(supplier_id, station_id, batch_id, quantity, status, note)
  VALUES (p_supplier_id, p_station_id, p_batch_id, p_quantity, 'in_transit', p_note)
  RETURNING id INTO v_id;

  PERFORM eg_audit(
    'supplier', p_actor, 'shipment.create', 'shipment', v_id::text,
    NULL, jsonb_build_object('batch_id', p_batch_id, 'quantity', p_quantity), NULL
  );

  RETURN jsonb_build_object('shipment_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION eg_respond_exception(
  p_exception_id uuid,
  p_response text,
  p_actor text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_exception supplier_exceptions;
BEGIN
  SELECT * INTO v_exception FROM supplier_exceptions WHERE id = p_exception_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EXCEPTION_NOT_FOUND';
  END IF;
  IF v_exception.status = 'closed' THEN
    RAISE EXCEPTION 'EXCEPTION_ALREADY_CLOSED';
  END IF;

  UPDATE supplier_exceptions
     SET response = p_response, status = 'responded'
   WHERE id = p_exception_id;

  PERFORM eg_audit(
    'supplier', p_actor, 'exception.respond', 'supplier_exception', p_exception_id::text,
    jsonb_build_object('status', v_exception.status), jsonb_build_object('status', 'responded'), p_response
  );

  RETURN jsonb_build_object('status', 'responded');
END;
$$;

COMMIT;
