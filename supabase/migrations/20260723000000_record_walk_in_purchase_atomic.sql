/*
  Record a walk-in purchase and award loyalty points atomically.
  The unique order reference makes retries idempotent.
*/
CREATE OR REPLACE FUNCTION public.record_walk_in_purchase(
  p_customer_id uuid,
  p_amount numeric,
  p_order_number text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer customers%ROWTYPE;
  v_existing_order orders%ROWTYPE;
  v_multiplier numeric;
  v_points_earned integer;
  v_updated_balance integer;
  v_order_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Purchase amount must be greater than zero';
  END IF;

  IF p_order_number IS NULL OR p_order_number !~ '^WI-[A-Za-z0-9-]+$' THEN
    RAISE EXCEPTION 'Invalid walk-in purchase reference';
  END IF;

  SELECT *
  INTO v_existing_order
  FROM orders
  WHERE order_number = p_order_number;

  IF FOUND THEN
    IF v_existing_order.customer_id IS DISTINCT FROM p_customer_id
       OR v_existing_order.total_amount IS DISTINCT FROM p_amount
       OR v_existing_order.purchase_type IS DISTINCT FROM 'walk_in' THEN
      RAISE EXCEPTION 'Walk-in purchase reference conflict';
    END IF;

    SELECT COALESCE(loyalty_points, 0)
    INTO v_updated_balance
    FROM customers
    WHERE id = p_customer_id;

    RETURN jsonb_build_object(
      'order_id', v_existing_order.id,
      'order_number', v_existing_order.order_number,
      'amount', v_existing_order.total_amount,
      'points_earned', COALESCE(v_existing_order.loyalty_points_earned, 0),
      'updated_balance', v_updated_balance
    );
  END IF;

  SELECT *
  INTO v_customer
  FROM customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  SELECT COALESCE(multiplier, 0.5)
  INTO v_multiplier
  FROM loyalty_settings
  WHERE purchase_type = 'walk_in';

  v_multiplier := COALESCE(v_multiplier, 0.5);
  v_points_earned := ROUND(p_amount * v_multiplier);

  INSERT INTO orders (
    customer_id,
    purchase_type,
    walk_in_amount,
    staff_id,
    order_number,
    order_items,
    total_amount,
    status,
    payment_status,
    customer_name,
    customer_phone,
    customer_email,
    loyalty_multiplier,
    loyalty_points_earned,
    created_at
  )
  VALUES (
    v_customer.id,
    'walk_in',
    p_amount,
    auth.uid(),
    p_order_number,
    '[]'::jsonb,
    p_amount,
    'completed',
    'paid',
    v_customer.name,
    v_customer.phone,
    v_customer.email,
    v_multiplier,
    v_points_earned,
    now()
  )
  RETURNING id INTO v_order_id;

  UPDATE customers
  SET loyalty_points = COALESCE(loyalty_points, 0) + v_points_earned
  WHERE id = v_customer.id
  RETURNING loyalty_points INTO v_updated_balance;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', p_order_number,
    'amount', p_amount,
    'points_earned', v_points_earned,
    'updated_balance', v_updated_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_walk_in_purchase(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_walk_in_purchase(uuid, numeric, text) TO anon, authenticated;
