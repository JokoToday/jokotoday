/*
  Create online orders atomically from server-authoritative data.

  The browser may choose only:
    - an idempotency/order reference
    - a canonical pickup day key
    - product ids + quantities
    - optional notes

  Customer identity, customer snapshot, pickup date/location, product names,
  prices, total amount, loyalty points, and inventory mutations are derived
  inside PostgreSQL in one transaction.
*/

-- Existing trigger functions are SECURITY DEFINER. Pin their search path so
-- unqualified object names cannot be redirected through a caller-controlled path.
ALTER FUNCTION public.calculate_loyalty_points_on_order()
  SET search_path = public;

ALTER FUNCTION public.update_customer_loyalty_balance()
  SET search_path = public;

CREATE OR REPLACE FUNCTION public.create_online_order(
  p_order_number text,
  p_pickup_day_key text,
  p_items jsonb,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_customer public.customers%ROWTYPE;
  v_pickup public.cms_pickup_days%ROWTYPE;
  v_cutoff public.pickup_cutoff_rules%ROWTYPE;
  v_override public.pickup_overrides%ROWTYPE;
  v_existing public.orders%ROWTYPE;
  v_product public.cms_products%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_item record;

  v_now_bangkok timestamp := timezone('Asia/Bangkok', now());
  v_today_bangkok date;
  v_pickup_date date;
  v_cutoff_date date;
  v_cutoff_at timestamp;
  v_cutoff_weekday integer;
  v_cutoff_day text;
  v_cutoff_time text;

  v_item_count integer;
  v_distinct_item_count integer;
  v_invalid_item_count integer;
  v_stock integer;
  v_total numeric := 0;
  v_order_items jsonb := '[]'::jsonb;
  v_available_days jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_order_number IS NULL
     OR p_order_number !~ '^ORD-[0-9]{10,20}-[A-Z0-9]{4,12}$' THEN
    RAISE EXCEPTION 'Invalid order reference';
  END IF;

  IF p_pickup_day_key IS NULL OR btrim(p_pickup_day_key) = '' THEN
    RAISE EXCEPTION 'Pickup day is required';
  END IF;

  IF p_notes IS NOT NULL AND length(p_notes) > 2000 THEN
    RAISE EXCEPTION 'Order notes are too long';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Order items must be an array';
  END IF;

  v_item_count := jsonb_array_length(p_items);
  IF v_item_count < 1 OR v_item_count > 50 THEN
    RAISE EXCEPTION 'Order must contain between 1 and 50 items';
  END IF;

  SELECT
    count(DISTINCT item.product_id),
    count(*) FILTER (
      WHERE item.product_id IS NULL
         OR item.quantity IS NULL
         OR item.quantity < 1
         OR item.quantity > 99
    )
  INTO v_distinct_item_count, v_invalid_item_count
  FROM jsonb_to_recordset(p_items) AS item(product_id uuid, quantity integer);

  IF v_invalid_item_count > 0 THEN
    RAISE EXCEPTION 'Each order item requires a valid product and quantity from 1 to 99';
  END IF;

  IF v_distinct_item_count <> v_item_count THEN
    RAISE EXCEPTION 'Duplicate products are not allowed in one order request';
  END IF;

  -- Lock the synchronized customer row first. Besides validating the account,
  -- this serializes retries for one customer so the order reference is idempotent.
  SELECT *
  INTO v_customer
  FROM public.customers
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Completed customer profile required';
  END IF;

  IF COALESCE(v_customer.status, 'active') <> 'active' THEN
    RAISE EXCEPTION 'Customer account is not active';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.orders
  WHERE order_number = p_order_number;

  IF FOUND THEN
    IF v_existing.customer_id IS DISTINCT FROM v_user_id
       OR COALESCE(v_existing.purchase_type, 'online') <> 'online' THEN
      RAISE EXCEPTION 'Order reference conflict';
    END IF;

    RETURN to_jsonb(v_existing);
  END IF;

  SELECT *
  INTO v_pickup
  FROM public.cms_pickup_days
  WHERE day_key = p_pickup_day_key
    AND COALESCE(is_open, false) = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected pickup day is not available';
  END IF;

  IF v_pickup.location_id IS NULL THEN
    RAISE EXCEPTION 'Selected pickup day has no pickup location';
  END IF;

  -- pickup_cutoff_rules is the authoritative cutoff source.
  SELECT *
  INTO v_cutoff
  FROM public.pickup_cutoff_rules
  WHERE day_key = v_pickup.day_key
    AND COALESCE(is_active, false) = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active cutoff rule exists for the selected pickup day';
  END IF;

  v_today_bangkok := v_now_bangkok::date;
  v_pickup_date := v_today_bangkok
    + ((v_pickup.pickup_weekday - extract(dow FROM v_today_bangkok)::integer + 7) % 7);

  -- Apply the newest active special override for this exact scheduled pickup.
  SELECT *
  INTO v_override
  FROM public.pickup_overrides
  WHERE date = v_pickup_date
    AND pickup_day = v_cutoff.pickup_day
    AND location = v_cutoff.location
    AND COALESCE(is_active, false) = true
  ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
  LIMIT 1;

  IF FOUND AND v_override.override_type IN ('closed', 'sold_out') THEN
    RAISE EXCEPTION 'Selected pickup day is unavailable';
  END IF;

  IF FOUND AND v_override.override_type = 'custom_cutoff' THEN
    IF v_override.custom_cutoff_day IS NULL OR v_override.custom_cutoff_time IS NULL THEN
      RAISE EXCEPTION 'Invalid custom cutoff configuration';
    END IF;
    v_cutoff_day := v_override.custom_cutoff_day;
    v_cutoff_time := v_override.custom_cutoff_time;
  ELSE
    v_cutoff_day := v_cutoff.cutoff_day;
    v_cutoff_time := v_cutoff.cutoff_time;
  END IF;

  v_cutoff_weekday := CASE v_cutoff_day
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
    RAISE EXCEPTION 'Invalid cutoff day configuration';
  END IF;

  BEGIN
    v_cutoff_date := v_pickup_date
      - ((v_pickup.pickup_weekday - v_cutoff_weekday + 7) % 7);
    v_cutoff_at := v_cutoff_date::timestamp + v_cutoff_time::time;
  EXCEPTION WHEN invalid_datetime_format THEN
    RAISE EXCEPTION 'Invalid cutoff time configuration';
  END;

  IF v_now_bangkok >= v_cutoff_at THEN
    RAISE EXCEPTION 'Ordering cutoff has passed for the selected pickup day';
  END IF;

  -- Process products in deterministic id order so overlapping concurrent orders
  -- take row locks consistently. Any later failure rolls back every stock change.
  FOR v_item IN
    SELECT item.product_id, item.quantity
    FROM jsonb_to_recordset(p_items) AS item(product_id uuid, quantity integer)
    ORDER BY item.product_id
  LOOP
    SELECT *
    INTO v_product
    FROM public.cms_products
    WHERE id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'A selected product no longer exists';
    END IF;

    IF COALESCE(v_product.is_active, false) = false
       OR COALESCE(v_product.is_sold_out, false) = true THEN
      RAISE EXCEPTION 'Product % is not available', v_product.name_en;
    END IF;

    v_available_days := COALESCE(v_product.available_days, '[]'::jsonb);
    IF jsonb_typeof(v_available_days) <> 'array' THEN
      RAISE EXCEPTION 'Invalid availability configuration for product %', v_product.name_en;
    END IF;

    IF jsonb_array_length(v_available_days) > 0
       AND NOT (
         v_available_days ? v_pickup.day_key
         OR v_available_days ? v_pickup.label
         OR (v_pickup.label_en IS NOT NULL AND v_available_days ? v_pickup.label_en)
         OR v_available_days ? (v_cutoff.pickup_day || ' – ' || v_cutoff.location)
         OR v_available_days ? (v_cutoff.pickup_day || ' - ' || v_cutoff.location)
       ) THEN
      RAISE EXCEPTION 'Product % is not offered for the selected pickup day', v_product.name_en;
    END IF;

    -- Prefer the canonical day_key. Legacy label keys are read only as a
    -- compatibility fallback. Every successful order writes the canonical key.
    v_stock := COALESCE(
      NULLIF(v_product.stock_by_day ->> v_pickup.day_key, '')::integer,
      NULLIF(v_product.stock_by_day ->> v_pickup.label, '')::integer,
      NULLIF(v_product.stock_by_day ->> COALESCE(v_pickup.label_en, v_pickup.label), '')::integer,
      NULLIF(v_product.stock_by_day ->> (v_cutoff.pickup_day || ' – ' || v_cutoff.location), '')::integer,
      NULLIF(v_product.stock_by_day ->> (v_cutoff.pickup_day || ' - ' || v_cutoff.location), '')::integer,
      v_product.stock_remaining,
      0
    );

    IF v_stock < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_product.name_en;
    END IF;

    v_total := v_total + (v_product.price * v_item.quantity);
    v_order_items := v_order_items || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product.id,
        'product_name', v_product.name_en,
        'product_name_th', v_product.name_th,
        'product_name_zh', COALESCE(v_product.name_zh, ''),
        'quantity', v_item.quantity,
        'price_at_order', v_product.price
      )
    );

    UPDATE public.cms_products
    SET
      stock_by_day = jsonb_set(
        COALESCE(stock_by_day, '{}'::jsonb),
        ARRAY[v_pickup.day_key],
        to_jsonb(v_stock - v_item.quantity),
        true
      ),
      updated_at = now()
    WHERE id = v_product.id;
  END LOOP;

  INSERT INTO public.orders (
    customer_id,
    order_number,
    order_items,
    total_amount,
    pickup_location_id,
    pickup_date,
    status,
    payment_status,
    line_id,
    customer_name,
    customer_phone,
    customer_email,
    notes,
    pickup_day,
    purchase_type
  )
  VALUES (
    v_customer.id,
    p_order_number,
    v_order_items,
    v_total,
    v_pickup.location_id,
    v_pickup_date,
    'pending',
    'unpaid',
    v_customer.line_id,
    v_customer.name,
    v_customer.phone,
    v_customer.email,
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    COALESCE(v_pickup.label_en, v_pickup.label),
    'online'
  )
  RETURNING * INTO v_order;

  RETURN to_jsonb(v_order);
END;
$$;

REVOKE ALL ON FUNCTION public.create_online_order(text, text, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_online_order(text, text, jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_online_order(text, text, jsonb, text) TO authenticated;

COMMENT ON FUNCTION public.create_online_order(text, text, jsonb, text) IS
  'Creates an authenticated online order atomically using server-authoritative customer, pickup, price, total, loyalty and stock data.';
