/*
  Record an order's actual pickup time without changing its scheduled pickup date.
  Repeated calls for an already completed order return the existing row unchanged.
*/

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS picked_up_at timestamptz;

CREATE OR REPLACE FUNCTION public.confirm_order_pickup(p_order_id uuid)
RETURNS SETOF orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
BEGIN
  SELECT *
  INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled orders cannot be picked up';
  END IF;

  IF v_order.status IN ('picked_up', 'completed') THEN
    RETURN NEXT v_order;
    RETURN;
  END IF;

  UPDATE orders
  SET
    status = 'picked_up',
    picked_up_at = COALESCE(picked_up_at, now()),
    staff_id = COALESCE(staff_id, auth.uid())
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  RETURN NEXT v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_order_pickup(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.confirm_order_pickup(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.confirm_order_pickup(uuid) IS
  'Idempotently marks a non-cancelled order picked_up and records its actual pickup time.';
