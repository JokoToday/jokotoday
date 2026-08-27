/*
  JOKO TODAY — Loyalty / Rewards v2 earning lifecycle

  Depends on 20260825172000_loyalty_v2_foundation.sql.

  Target behavior:
  - the legacy insert-time award is cut over atomically with the opening ledger;
  - online/preorder points are calculated at order creation but become spendable
    only when pickup/completion is confirmed;
  - paid/completed walk-in purchases earn immediately;
  - cancellation reverses points only if that order was actually awarded;
  - all post-cutover balance changes use loyalty_point_events atomically;
  - existing positive-point orders are marked as legacy-awarded so they can
    never be awarded twice at pickup.
*/

-- -----------------------------------------------------------------------------
-- Atomic cutover
-- -----------------------------------------------------------------------------
-- The foundation migration creates the new schema and may initially snapshot an
-- opening balance. Rebuild that opening snapshot here while blocking every
-- legacy path that can mutate orders/customers/point events. This closes the
-- migration-order race where an order or cancellation between migrations could
-- otherwise make the opening ledger stale.

LOCK TABLE public.orders, public.customers, public.loyalty_point_events
  IN SHARE ROW EXCLUSIVE MODE;

-- Stop legacy insert-time balance crediting before the final opening snapshot.
-- The BEFORE INSERT calculator remains and continues to snapshot prospective
-- points on the order.
DROP TRIGGER IF EXISTS orders_update_customer_loyalty ON public.orders;

-- Remove only the provisional opening rows written by the foundation migration.
-- Preserve any real ledger events that may have been created through an Admin
-- RPC before this cutover transaction.
DELETE FROM public.loyalty_point_events
WHERE event_type = 'migration_opening_balance';

-- Every positive-point order that exists at this exact cutover moment was
-- created under the legacy award-at-insert model (or is a completed walk-in), so
-- it has already affected the cached balance. Mark it as awarded to prevent a
-- later pickup action from awarding it again.
UPDATE public.orders
SET loyalty_points_awarded_at = COALESCE(loyalty_points_awarded_at, created_at, now())
WHERE customer_id IS NOT NULL
  AND COALESCE(loyalty_points_earned, 0) > 0
  AND loyalty_points_awarded_at IS NULL;

-- Reconcile the ledger to the exact cached balance at cutover. Normally there
-- are no non-opening v2 events yet; subtracting any that do exist makes this
-- robust if an authorized Admin adjustment occurred between migrations.
WITH existing_events AS (
  SELECT customer_id, COALESCE(SUM(points_delta), 0)::integer AS existing_delta
  FROM public.loyalty_point_events
  GROUP BY customer_id
), opening AS (
  SELECT
    c.id AS customer_id,
    COALESCE(c.loyalty_points, 0)::integer AS current_balance,
    (COALESCE(c.loyalty_points, 0) - COALESCE(e.existing_delta, 0))::integer AS opening_delta
  FROM public.customers c
  LEFT JOIN existing_events e ON e.customer_id = c.id
)
INSERT INTO public.loyalty_point_events (
  customer_id,
  event_type,
  points_delta,
  balance_after,
  reason,
  metadata,
  created_at
)
SELECT
  o.customer_id,
  'migration_opening_balance',
  o.opening_delta,
  o.current_balance,
  'Opening balance at Loyalty v2 atomic cutover',
  jsonb_build_object('cutover_balance', o.current_balance),
  now()
FROM opening o
WHERE o.opening_delta <> 0
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Pickup confirmation: award once, at completion/pickup.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.confirm_order_pickup(p_order_id uuid)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_customer_id uuid;
  v_existing_earn_at timestamptz;
BEGIN
  IF NOT public.is_staff_or_admin() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;

  -- Canonical lock order for customer orders is customer -> order. This matches
  -- cancellation/redemption and prevents pickup/cancellation deadlocks.
  SELECT o.customer_id
  INTO v_customer_id
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_customer_id IS NOT NULL THEN
    PERFORM 1
    FROM public.customers c
    WHERE c.id = v_customer_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Customer record not found'; END IF;
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.customer_id IS DISTINCT FROM v_customer_id THEN
    RAISE EXCEPTION 'Order customer changed while confirming pickup; retry';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled orders cannot be picked up';
  END IF;

  -- If a row is already picked_up/completed but lacks an award marker (for
  -- example after an interrupted/manual legacy transition), reconcile the
  -- loyalty award idempotently instead of returning before it can be repaired.
  IF v_order.status NOT IN ('picked_up', 'completed') THEN
    UPDATE public.orders
    SET
      status = 'picked_up',
      picked_up_at = COALESCE(picked_up_at, now()),
      staff_id = COALESCE(staff_id, auth.uid())
    WHERE id = p_order_id
    RETURNING * INTO v_order;
  END IF;

  IF v_order.customer_id IS NOT NULL
     AND COALESCE(v_order.loyalty_points_earned, 0) > 0
     AND v_order.loyalty_points_awarded_at IS NULL THEN

    SELECT e.created_at
    INTO v_existing_earn_at
    FROM public.loyalty_point_events e
    WHERE e.order_id = v_order.id
      AND e.event_type = 'earn'
    LIMIT 1;

    IF v_existing_earn_at IS NULL THEN
      PERFORM public.apply_loyalty_points_delta_v2(
        v_order.customer_id,
        v_order.loyalty_points_earned,
        'earn',
        v_order.id,
        NULL,
        auth.uid(),
        'Points awarded at pickup/completion',
        jsonb_build_object(
          'purchase_type', COALESCE(v_order.purchase_type, 'online'),
          'loyalty_rate', v_order.loyalty_multiplier
        )
      );
      v_existing_earn_at := now();
    END IF;

    UPDATE public.orders
    SET loyalty_points_awarded_at = COALESCE(v_existing_earn_at, now())
    WHERE id = v_order.id
    RETURNING * INTO v_order;
  END IF;

  RETURN NEXT v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_order_pickup(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_order_pickup(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- Walk-in: use canonical points-per-baht and ledger the immediate earn.
-- -----------------------------------------------------------------------------

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
  v_customer public.customers%ROWTYPE;
  v_existing_order public.orders%ROWTYPE;
  v_rate numeric;
  v_points_earned integer;
  v_updated_balance integer;
  v_order public.orders%ROWTYPE;
BEGIN
  IF NOT public.is_staff_or_admin() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Purchase amount must be greater than zero';
  END IF;

  IF p_order_number IS NULL OR p_order_number !~ '^WI-[A-Za-z0-9-]+$' THEN
    RAISE EXCEPTION 'Invalid walk-in purchase reference';
  END IF;

  SELECT *
  INTO v_existing_order
  FROM public.orders
  WHERE order_number = p_order_number;

  IF FOUND THEN
    IF v_existing_order.customer_id IS DISTINCT FROM p_customer_id
       OR v_existing_order.total_amount IS DISTINCT FROM p_amount
       OR v_existing_order.purchase_type IS DISTINCT FROM 'walk_in' THEN
      RAISE EXCEPTION 'Walk-in purchase reference conflict';
    END IF;

    SELECT COALESCE(loyalty_points, 0)
    INTO v_updated_balance
    FROM public.customers
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
  FROM public.customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  SELECT COALESCE(ls.points_per_baht, round(ls.points_percentage / 100.0, 5), 0)
  INTO v_rate
  FROM public.loyalty_settings ls
  WHERE ls.purchase_type = 'walk_in';

  v_rate := COALESCE(v_rate, 0);
  v_points_earned := round(p_amount * v_rate);

  INSERT INTO public.orders (
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
    v_rate,
    v_points_earned,
    now()
  )
  RETURNING * INTO v_order;

  IF v_points_earned > 0 THEN
    v_updated_balance := public.apply_loyalty_points_delta_v2(
      v_customer.id,
      v_points_earned,
      'earn',
      v_order.id,
      NULL,
      auth.uid(),
      'Points awarded for completed walk-in purchase',
      jsonb_build_object('purchase_type', 'walk_in', 'loyalty_rate', v_rate)
    );

    UPDATE public.orders
    SET loyalty_points_awarded_at = now()
    WHERE id = v_order.id
    RETURNING * INTO v_order;
  ELSE
    v_updated_balance := COALESCE(v_customer.loyalty_points, 0);
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'amount', v_order.total_amount,
    'points_earned', COALESCE(v_order.loyalty_points_earned, 0),
    'updated_balance', v_updated_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_walk_in_purchase(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_walk_in_purchase(uuid, numeric, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- Legacy online cancellation: preserve stock/cutoff behavior and reverse only
-- if the order was actually awarded.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_online_order_legacy_v1(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_customer public.customers%ROWTYPE;
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
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  IF p_order_id IS NULL THEN RAISE EXCEPTION 'Order id is required'; END IF;

  -- Canonical lock order is customer -> order. The internal helper also
  -- independently rejects v2 orders so the wrapper cannot be bypassed.
  SELECT * INTO v_customer FROM public.customers WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer record not found'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.customer_id IS DISTINCT FROM v_user_id THEN RAISE EXCEPTION 'You may only cancel your own order' USING ERRCODE = '42501'; END IF;
  IF COALESCE(v_order.purchase_type, 'online') <> 'online' THEN RAISE EXCEPTION 'Only online orders can be cancelled here'; END IF;
  IF v_order.pickup_date_id IS NOT NULL THEN
    RAISE EXCEPTION 'Pickup v2 orders cannot use the legacy cancellation helper' USING ERRCODE = 'P0001';
  END IF;
  IF v_order.status = 'cancelled' THEN RETURN to_jsonb(v_order); END IF;
  IF v_order.status NOT IN ('pending', 'confirmed') THEN RAISE EXCEPTION 'This order can no longer be cancelled'; END IF;
  IF COALESCE(v_order.payment_status, 'unpaid') <> 'unpaid' OR v_order.picked_up_at IS NOT NULL THEN RAISE EXCEPTION 'Paid or picked-up orders require staff assistance to cancel'; END IF;
  IF v_order.pickup_date IS NULL THEN RAISE EXCEPTION 'Order has no scheduled pickup date'; END IF;

  SELECT * INTO v_pickup
  FROM public.cms_pickup_days
  WHERE (label_en = v_order.pickup_day OR label = v_order.pickup_day)
    AND (v_order.pickup_location_id IS NULL OR location_id = v_order.pickup_location_id)
  ORDER BY sort_order, created_at
  LIMIT 1;
  IF NOT FOUND OR v_pickup.day_key IS NULL OR btrim(v_pickup.day_key) = '' THEN RAISE EXCEPTION 'Could not resolve the pickup day for this order'; END IF;

  SELECT * INTO v_rule
  FROM public.cancellation_cutoff_rules
  WHERE is_active = true AND pickup_label_en = COALESCE(v_pickup.label_en, v_order.pickup_day)
  ORDER BY sort_order, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
  LIMIT 1;

  IF FOUND THEN
    v_cutoff_weekday := CASE v_rule.cutoff_day
      WHEN 'Sunday' THEN 0 WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
      WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6 ELSE NULL END;
    IF v_cutoff_weekday IS NULL THEN RAISE EXCEPTION 'Invalid cancellation cutoff day configuration'; END IF;
    v_pickup_weekday := extract(dow FROM v_order.pickup_date)::integer;
    BEGIN
      v_cutoff_date := v_order.pickup_date - ((v_pickup_weekday - v_cutoff_weekday + 7) % 7);
      v_cutoff_at := v_cutoff_date::timestamp + v_rule.cutoff_time::time;
    EXCEPTION WHEN invalid_datetime_format THEN
      RAISE EXCEPTION 'Invalid cancellation cutoff time configuration';
    END;
  ELSE
    v_cutoff_at := (v_order.pickup_date - 1)::timestamp;
  END IF;

  IF v_now_bangkok >= v_cutoff_at THEN RAISE EXCEPTION 'Cancellation cutoff has passed for this order'; END IF;
  IF v_order.order_items IS NULL OR jsonb_typeof(v_order.order_items) <> 'array' THEN RAISE EXCEPTION 'Order item snapshot is invalid'; END IF;

  IF v_order.inventory_reserved THEN
    FOR v_item IN
      SELECT item.product_id, item.quantity
      FROM jsonb_to_recordset(v_order.order_items) AS item(product_id uuid, quantity integer)
      WHERE item.product_id IS NOT NULL AND item.quantity IS NOT NULL AND item.quantity > 0
      ORDER BY item.product_id
    LOOP
      SELECT * INTO v_product FROM public.cms_products WHERE id = v_item.product_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'A product from this order no longer exists'; END IF;
      v_stock := COALESCE(
        NULLIF(v_product.stock_by_day ->> v_pickup.day_key, '')::integer,
        NULLIF(v_product.stock_by_day ->> v_order.pickup_day, '')::integer,
        NULLIF(v_product.stock_by_day ->> replace(v_order.pickup_day, ' – ', ' - '), '')::integer,
        NULLIF(v_product.stock_by_day ->> replace(v_order.pickup_day, ' - ', ' – '), '')::integer,
        v_product.stock_remaining,
        0
      );
      UPDATE public.cms_products
      SET stock_by_day = jsonb_set(COALESCE(stock_by_day, '{}'::jsonb), ARRAY[v_pickup.day_key], to_jsonb(v_stock + v_item.quantity), true),
          updated_at = now()
      WHERE id = v_product.id;
    END LOOP;
  END IF;

  IF v_order.customer_id IS NOT NULL
     AND v_order.loyalty_points_awarded_at IS NOT NULL
     AND COALESCE(v_order.loyalty_points_earned, 0) > 0
     AND NOT EXISTS (
       SELECT 1 FROM public.loyalty_point_events e
       WHERE e.order_id = v_order.id AND e.event_type = 'reverse_earn'
     ) THEN
    PERFORM public.apply_loyalty_points_delta_v2(
      v_order.customer_id,
      -v_order.loyalty_points_earned,
      'reverse_earn',
      v_order.id,
      NULL,
      v_user_id,
      'Points reversed for customer cancellation',
      jsonb_build_object('purchase_type', 'online', 'flow', 'legacy')
    );
  END IF;

  UPDATE public.orders SET status = 'cancelled' WHERE id = v_order.id RETURNING * INTO v_order;
  RETURN to_jsonb(v_order);
END;
$$;

-- Internal helper: customers must use the guarded cancel_online_order wrapper.
REVOKE ALL ON FUNCTION public.cancel_online_order_legacy_v1(uuid) FROM PUBLIC, anon, authenticated;

-- Keep the existing legacy/v2 routing guard intact.
CREATE OR REPLACE FUNCTION public.cancel_online_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pickup_date_id uuid;
BEGIN
  IF p_order_id IS NOT NULL THEN
    SELECT o.pickup_date_id
    INTO v_pickup_date_id
    FROM public.orders o
    WHERE o.id = p_order_id;

    IF FOUND AND v_pickup_date_id IS NOT NULL THEN
      RAISE EXCEPTION
        'This order uses the v2 pickup inventory system; refresh the application before cancelling'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN public.cancel_online_order_legacy_v1(p_order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_online_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_online_order(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- Pickup v2 cancellation: preserve inventory-ledger behavior and reverse only
-- an actually-awarded earn. Customer EXECUTE remains dark.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_online_order_v2(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_customer public.customers%ROWTYPE;
  v_date public.pickup_dates%ROWTYPE;
  v_inventory public.product_date_inventory%ROWTYPE;
  v_item record;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  IF p_order_id IS NULL THEN RAISE EXCEPTION 'Order id is required'; END IF;

  SELECT * INTO v_customer FROM public.customers WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer record not found'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.customer_id IS DISTINCT FROM v_user_id THEN RAISE EXCEPTION 'You may only cancel your own order' USING ERRCODE = '42501'; END IF;
  IF COALESCE(v_order.purchase_type, 'online') <> 'online' THEN RAISE EXCEPTION 'Only online orders can be cancelled here'; END IF;
  IF v_order.pickup_date_id IS NULL THEN RAISE EXCEPTION 'Legacy order must be cancelled through the legacy cancellation flow'; END IF;
  IF v_order.status = 'cancelled' THEN RETURN to_jsonb(v_order); END IF;
  IF v_order.status NOT IN ('pending', 'confirmed') THEN RAISE EXCEPTION 'This order can no longer be cancelled'; END IF;
  IF COALESCE(v_order.payment_status, 'unpaid') <> 'unpaid' OR v_order.picked_up_at IS NOT NULL THEN RAISE EXCEPTION 'Paid or picked-up orders require staff assistance to cancel'; END IF;
  IF v_order.order_items IS NULL OR jsonb_typeof(v_order.order_items) <> 'array' THEN RAISE EXCEPTION 'Order item snapshot is invalid'; END IF;

  SELECT * INTO v_date FROM public.pickup_dates WHERE id = v_order.pickup_date_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order pickup date no longer exists'; END IF;
  IF now() >= v_date.cancellation_cutoff_at THEN RAISE EXCEPTION 'Cancellation cutoff has passed for this order'; END IF;

  IF v_order.inventory_reserved THEN
    FOR v_item IN
      SELECT item.product_id, item.quantity
      FROM jsonb_to_recordset(v_order.order_items) AS item(product_id uuid, quantity integer)
      WHERE item.product_id IS NOT NULL AND item.quantity IS NOT NULL AND item.quantity > 0
      ORDER BY item.product_id
    LOOP
      SELECT * INTO v_inventory
      FROM public.product_date_inventory
      WHERE pickup_date_id = v_order.pickup_date_id
        AND product_id = v_item.product_id
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Inventory record is missing for a product in this order'; END IF;
      IF v_inventory.reserved_quantity < v_item.quantity THEN RAISE EXCEPTION 'Inventory reservation ledger is inconsistent for this order'; END IF;

      UPDATE public.product_date_inventory
      SET reserved_quantity = reserved_quantity - v_item.quantity,
          updated_at = now()
      WHERE pickup_date_id = v_order.pickup_date_id
        AND product_id = v_item.product_id;

      INSERT INTO public.inventory_events (
        pickup_date_id, product_id, order_id, event_type,
        reserved_delta, actor_id, reason
      ) VALUES (
        v_order.pickup_date_id, v_item.product_id, v_order.id, 'release',
        -v_item.quantity, v_user_id, 'customer_cancellation'
      );
    END LOOP;
  END IF;

  IF v_order.loyalty_points_awarded_at IS NOT NULL
     AND COALESCE(v_order.loyalty_points_earned, 0) > 0
     AND NOT EXISTS (
       SELECT 1 FROM public.loyalty_point_events e
       WHERE e.order_id = v_order.id AND e.event_type = 'reverse_earn'
     ) THEN
    PERFORM public.apply_loyalty_points_delta_v2(
      v_order.customer_id,
      -v_order.loyalty_points_earned,
      'reverse_earn',
      v_order.id,
      NULL,
      v_user_id,
      'Points reversed for customer cancellation',
      jsonb_build_object('purchase_type', 'online', 'flow', 'pickup_v2')
    );
  END IF;

  UPDATE public.orders
  SET status = 'cancelled'
  WHERE id = v_order.id
  RETURNING * INTO v_order;

  RETURN to_jsonb(v_order);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_online_order_v2(uuid) FROM PUBLIC, anon, authenticated;

-- Preserve the explicit dark gate: no customer EXECUTE is granted for v2 create/cancel.
REVOKE ALL ON FUNCTION public.create_online_order_v2(text, uuid, uuid, jsonb, text)
FROM PUBLIC, anon, authenticated;
