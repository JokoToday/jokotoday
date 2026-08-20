/*
  Cancel an authenticated customer's online order atomically.

  Cancellation preserves the order row for history, restores inventory to the
  canonical pickup-day stock key, and reverses the loyalty award in the same
  transaction.
*/

CREATE OR REPLACE FUNCTION public.cancel_online_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_pickup public.cms_pickup_days%ROWTYPE;
  v_rule public.cancellation_cutoff_rules%ROWTYPE;
  v_product public.cms_products%ROWTYPE;
  v_item record;

  v_now_bangkok timestamp := timezone('Asia/Bangkok', now());
  v_cutoff_date date;
  v_cutoff_at timestamp;
  v_cutoff_weekday integer;
  v_pickup_weekday integer;
  v_stock integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Order id is required';
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.customer_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'You may only cancel your own order' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(v_order.purchase_type, 'online') <> 'online' THEN
    RAISE EXCEPTION 'Only online orders can be cancelled here';
  END IF;

  -- Idempotent retry: a previously successful cancellation returns the same row
  -- without restoring stock or reversing loyalty a second time.
  IF v_order.status = 'cancelled' THEN
    RETURN to_jsonb(v_order);
  END IF;

  IF v_order.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'This order can no longer be cancelled';
  END IF;

  IF COALESCE(v_order.payment_status, 'unpaid') <> 'unpaid'
     OR v_order.picked_up_at IS NOT NULL THEN
    RAISE EXCEPTION 'Paid or picked-up orders require staff assistance to cancel';
  END IF;

  IF v_order.pickup_date IS NULL THEN
    RAISE EXCEPTION 'Order has no scheduled pickup date';
  END IF;

  -- Resolve the canonical pickup day used for inventory restoration.
  SELECT *
  INTO v_pickup
  FROM public.cms_pickup_days
  WHERE (
      label_en = v_order.pickup_day
      OR label = v_order.pickup_day
    )
    AND (
      v_order.pickup_location_id IS NULL
      OR location_id = v_order.pickup_location_id
    )
  ORDER BY sort_order, created_at
  LIMIT 1;

  IF NOT FOUND OR v_pickup.day_key IS NULL OR btrim(v_pickup.day_key) = '' THEN
    RAISE EXCEPTION 'Could not resolve the pickup day for this order';
  END IF;

  -- Prefer a configured cancellation rule when one exists. Production has no
  -- rows today, so the fallback preserves the current customer-facing rule:
  -- cancellation closes at 00:00 on the day before pickup.
  SELECT *
  INTO v_rule
  FROM public.cancellation_cutoff_rules
  WHERE is_active = true
    AND pickup_label_en = COALESCE(v_pickup.label_en, v_order.pickup_day)
  ORDER BY sort_order, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
  LIMIT 1;

  IF FOUND THEN
    v_cutoff_weekday := CASE v_rule.cutoff_day
      WHEN 'Sunday' THEN 0
      WHEN 'Monday' THEN 1
      WHEN 'Tuesday' THEN 2
      WHEN 'Wednesday' THEN 3
      WHEN 'Thursday' THEN 4
      WHEN 'Friday' THEN 5
      WHEN 'Saturday' THEN 6
      ELSE NULL
    END;

    IF v_cutoff_weekday IS NULL THEN
      RAISE EXCEPTION 'Invalid cancellation cutoff day configuration';
    END IF;

    v_pickup_weekday := extract(dow FROM v_order.pickup_date)::integer;

    BEGIN
      v_cutoff_date := v_order.pickup_date
        - ((v_pickup_weekday - v_cutoff_weekday + 7) % 7);
      v_cutoff_at := v_cutoff_date::timestamp + v_rule.cutoff_time::time;
    EXCEPTION WHEN invalid_datetime_format THEN
      RAISE EXCEPTION 'Invalid cancellation cutoff time configuration';
    END;
  ELSE
    v_cutoff_at := (v_order.pickup_date - 1)::timestamp;
  END IF;

  IF v_now_bangkok >= v_cutoff_at THEN
    RAISE EXCEPTION 'Cancellation cutoff has passed for this order';
  END IF;

  IF v_order.order_items IS NULL OR jsonb_typeof(v_order.order_items) <> 'array' THEN
    RAISE EXCEPTION 'Order item snapshot is invalid';
  END IF;

  -- Lock products in deterministic order to avoid deadlocks when cancellations
  -- overlap with checkout or another cancellation.
  FOR v_item IN
    SELECT item.product_id, item.quantity
    FROM jsonb_to_recordset(v_order.order_items)
      AS item(product_id uuid, quantity integer)
    WHERE item.product_id IS NOT NULL
      AND item.quantity IS NOT NULL
      AND item.quantity > 0
    ORDER BY item.product_id
  LOOP
    SELECT *
    INTO v_product
    FROM public.cms_products
    WHERE id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'A product from this order no longer exists';
    END IF;

    v_stock := COALESCE(
      NULLIF(v_product.stock_by_day ->> v_pickup.day_key, '')::integer,
      NULLIF(v_product.stock_by_day ->> v_order.pickup_day, '')::integer,
      NULLIF(v_product.stock_by_day ->> replace(v_order.pickup_day, ' – ', ' - '), '')::integer,
      NULLIF(v_product.stock_by_day ->> replace(v_order.pickup_day, ' - ', ' – '), '')::integer,
      v_product.stock_remaining,
      0
    );

    UPDATE public.cms_products
    SET
      stock_by_day = jsonb_set(
        COALESCE(stock_by_day, '{}'::jsonb),
        ARRAY[v_pickup.day_key],
        to_jsonb(v_stock + v_item.quantity),
        true
      ),
      updated_at = now()
    WHERE id = v_product.id;
  END LOOP;

  -- Reverse only the loyalty award that this order originally granted.
  -- Clamp at zero to avoid a negative balance if historic/manual adjustments
  -- have already reduced the customer's balance.
  IF v_order.customer_id IS NOT NULL
     AND COALESCE(v_order.loyalty_points_earned, 0) > 0 THEN
    UPDATE public.customers
    SET loyalty_points = GREATEST(
      COALESCE(loyalty_points, 0) - COALESCE(v_order.loyalty_points_earned, 0),
      0
    )
    WHERE id = v_order.customer_id;
  END IF;

  UPDATE public.orders
  SET status = 'cancelled'
  WHERE id = v_order.id
  RETURNING * INTO v_order;

  RETURN to_jsonb(v_order);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_online_order(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_online_order(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_online_order(uuid) TO authenticated;

COMMENT ON FUNCTION public.cancel_online_order(uuid) IS
  'Atomically cancels the authenticated customer''s eligible online order, restores canonical inventory, reverses loyalty, and preserves the order as cancelled history.';
