-- 008_payment_idempotency.sql — 付款冪等的判定順序
-- 原本 eg_pay_order 先看訂單是否已付款，再看 idempotency_key，
-- 導致「同一請求的網路重送」與「另一筆新的付款嘗試」都回報 already_paid，
-- 無法區分。改為先查 idempotency_key：重送回 duplicate，新嘗試才回 already_paid。

BEGIN;

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

  -- 先判定是否為同一請求的重送，才不會把重送回報成新的付款嘗試。
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_payment FROM payments WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object('status', 'duplicate', 'payment_id', v_payment.id);
    END IF;
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

COMMIT;
