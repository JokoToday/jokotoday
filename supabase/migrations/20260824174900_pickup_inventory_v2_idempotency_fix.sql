/*
  Pickup / inventory architecture v2 — idempotency payload binding.

  Reusing an order reference is idempotent only when customer, date, location,
  normalized product/quantity payload and normalized notes all match the order
  already created for that reference.
*/

BEGIN;

CREATE OR REPLACE FUNCTION public.create_online_order_v2(
  p_order_number text,
  p_pickup_date_id uuid,
  p_pickup_location_id uuid,
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
  v_date public.pickup_dates%ROWTYPE;
  v_schedule public.pickup_schedules%ROWTYPE;
  v_existing public.orders%ROWTYPE;
  v_product public.cms_products%ROWTYPE;
  v_inventory public.product_date_inventory%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_item record;
  v_item_count integer;
  v_distinct_item_count integer;
  v_invalid_item_count integer;
  v_total numeric := 0;
  v_order_items jsonb := '[]'::jsonb;
  v_request_items_key jsonb := '[]'::jsonb;
  v_existing_items_key jsonb := '[]'::jsonb;
  v_normalized_notes text;
  v_today_bangkok date := timezone('Asia/Bangkok', now())::date;
  v_language text := 'en';
  v_recurring_active boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_order_number IS NULL OR p_order_number !~ '^ORD-[0-9]{10,20}-[A-Z0-9]{4,12}$' THEN
    RAISE EXCEPTION 'Invalid order reference';
  END IF;
  IF p_pickup_date_id IS NULL OR p_pickup_location_id IS NULL THEN
    RAISE EXCEPTION 'Pickup date and pickup location are required';
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

  SELECT count(DISTINCT item.product_id),
         count(*) FILTER (
           WHERE item.product_id IS NULL OR item.quantity IS NULL
              OR item.quantity < 1 OR item.quantity > 99
         ),
         COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'product_id', item.product_id::text,
               'quantity', item.quantity
             ) ORDER BY item.product_id
           ),
           '[]'::jsonb
         )
  INTO v_distinct_item_count, v_invalid_item_count, v_request_items_key
  FROM jsonb_to_recordset(p_items) AS item(product_id uuid, quantity integer);

  IF v_invalid_item_count > 0 THEN
    RAISE EXCEPTION 'Each order item requires a valid product and quantity from 1 to 99';
  END IF;
  IF v_distinct_item_count <> v_item_count THEN
    RAISE EXCEPTION 'Duplicate products are not allowed in one order request';
  END IF;

  v_normalized_notes := NULLIF(btrim(COALESCE(p_notes, '')), '');

  /* Canonical lock order begins with the customer row. */
  SELECT * INTO v_customer
  FROM public.customers
  WHERE id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Completed customer profile required'; END IF;
  IF COALESCE(v_customer.status, 'active') <> 'active' THEN
    RAISE EXCEPTION 'Customer account is not active';
  END IF;

  SELECT CASE lower(COALESCE(up.preferred_language, 'en'))
           WHEN 'th' THEN 'th'
           WHEN 'zh' THEN 'zh'
           ELSE 'en'
         END
  INTO v_language
  FROM public.user_profiles up
  WHERE up.id = v_user_id;
  v_language := COALESCE(v_language, 'en');

  SELECT * INTO v_existing
  FROM public.orders
  WHERE order_number = p_order_number;
  IF FOUND THEN
    IF v_existing.customer_id IS DISTINCT FROM v_user_id
       OR COALESCE(v_existing.purchase_type, 'online') <> 'online'
       OR v_existing.pickup_date_id IS DISTINCT FROM p_pickup_date_id
       OR v_existing.pickup_location_id IS DISTINCT FROM p_pickup_location_id THEN
      RAISE EXCEPTION 'Order reference conflict';
    END IF;

    IF v_existing.order_items IS NULL OR jsonb_typeof(v_existing.order_items) <> 'array' THEN
      RAISE EXCEPTION 'Existing order snapshot is invalid for idempotent retry';
    END IF;

    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'product_id', item.product_id::text,
          'quantity', item.quantity
        ) ORDER BY item.product_id
      ),
      '[]'::jsonb
    )
    INTO v_existing_items_key
    FROM jsonb_to_recordset(v_existing.order_items)
      AS item(product_id uuid, quantity integer);

    IF v_existing_items_key IS DISTINCT FROM v_request_items_key
       OR COALESCE(NULLIF(btrim(COALESCE(v_existing.notes, '')), ''), '')
          IS DISTINCT FROM COALESCE(v_normalized_notes, '') THEN
      RAISE EXCEPTION 'Order reference conflict: request payload differs from the existing order';
    END IF;

    RETURN to_jsonb(v_existing);
  END IF;

  SELECT * INTO v_date
  FROM public.pickup_dates
  WHERE id = p_pickup_date_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Selected pickup date does not exist'; END IF;
  IF v_date.status <> 'open' THEN RAISE EXCEPTION 'Selected pickup date is unavailable'; END IF;
  IF v_date.pickup_date < v_today_bangkok THEN RAISE EXCEPTION 'Selected pickup date is in the past'; END IF;
  IF now() >= v_date.order_cutoff_at THEN
    RAISE EXCEPTION 'Ordering cutoff has passed for the selected pickup date';
  END IF;

  SELECT * INTO v_schedule
  FROM public.pickup_schedules
  WHERE id = v_date.schedule_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pickup schedule is not active'; END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.pickup_date_locations dl
    JOIN public.cms_pickup_locations l ON l.id = dl.location_id
    WHERE dl.pickup_date_id = p_pickup_date_id
      AND dl.location_id = p_pickup_location_id
      AND dl.is_active = true
      AND l.is_active = true
  ) THEN
    RAISE EXCEPTION 'Selected pickup location is not available for this date';
  END IF;

  FOR v_item IN
    SELECT item.product_id, item.quantity
    FROM jsonb_to_recordset(p_items) AS item(product_id uuid, quantity integer)
    ORDER BY item.product_id
  LOOP
    SELECT * INTO v_product
    FROM public.cms_products
    WHERE id = v_item.product_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'A selected product no longer exists'; END IF;
    IF COALESCE(v_product.is_active, false) = false
       OR COALESCE(v_product.is_sold_out, false) = true THEN
      RAISE EXCEPTION 'Product % is not available', v_product.name_en;
    END IF;

    /*
      Recurring availability is authoritative for recurring-default pools.
      Lock it before the inventory row so Admin availability changes serialize
      as schedule-capacity -> date-inventory, matching the Admin RPC lock order.
      Explicit date overrides remain independently offerable.
    */
    v_recurring_active := NULL;
    SELECT c.is_active INTO v_recurring_active
    FROM public.product_schedule_capacity c
    WHERE c.schedule_id = v_date.schedule_id
      AND c.product_id = v_item.product_id
    FOR SHARE;

    SELECT * INTO v_inventory
    FROM public.product_date_inventory
    WHERE pickup_date_id = p_pickup_date_id
      AND product_id = v_item.product_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % is not offered for the selected pickup date', v_product.name_en;
    END IF;
    IF v_inventory.capacity_source = 'recurring_default'
       AND COALESCE(v_recurring_active, false) = false THEN
      RAISE EXCEPTION 'Product % is not active for this pickup schedule', v_product.name_en;
    END IF;
    IF (v_inventory.capacity - v_inventory.reserved_quantity) < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_product.name_en;
    END IF;

    v_total := v_total + (v_product.price * v_item.quantity);
    v_order_items := v_order_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'product_name', v_product.name_en,
      'product_name_th', v_product.name_th,
      'product_name_zh', COALESCE(v_product.name_zh, ''),
      'quantity', v_item.quantity,
      'price_at_order', v_product.price
    ));
  END LOOP;

  INSERT INTO public.orders (
    customer_id, order_number, order_items, total_amount,
    pickup_location_id, pickup_date, pickup_date_id,
    status, payment_status, line_id,
    customer_name, customer_phone, customer_email, notes,
    pickup_day, purchase_type, inventory_reserved
  ) VALUES (
    v_customer.id, p_order_number, v_order_items, v_total,
    p_pickup_location_id, v_date.pickup_date, v_date.id,
    'pending', 'unpaid', v_customer.line_id,
    v_customer.name, v_customer.phone, v_customer.email,
    v_normalized_notes,
    v_schedule.label_en, 'online', true
  ) RETURNING * INTO v_order;

  FOR v_item IN
    SELECT item.product_id, item.quantity
    FROM jsonb_to_recordset(p_items) AS item(product_id uuid, quantity integer)
    ORDER BY item.product_id
  LOOP
    UPDATE public.product_date_inventory
    SET reserved_quantity = reserved_quantity + v_item.quantity,
        updated_at = now()
    WHERE pickup_date_id = p_pickup_date_id
      AND product_id = v_item.product_id
      AND reserved_quantity + v_item.quantity <= capacity;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Inventory changed while placing the order; please retry';
    END IF;

    INSERT INTO public.inventory_events (
      pickup_date_id, product_id, order_id, event_type,
      reserved_delta, actor_id, reason
    ) VALUES (
      p_pickup_date_id, v_item.product_id, v_order.id,
      'reserve', v_item.quantity, v_user_id, 'online_order'
    );
  END LOOP;

  INSERT INTO public.order_notification_events (
    order_id, notification_type, language
  ) VALUES
    (v_order.id, 'customer_confirmation', v_language),
    (v_order.id, 'admin_new_order', NULL)
  ON CONFLICT (order_id, notification_type) DO NOTHING;

  RETURN to_jsonb(v_order);
END;
$$;

/* Keep the customer checkout RPC dark until a separately reviewed cutover. */
REVOKE ALL ON FUNCTION public.create_online_order_v2(text, uuid, uuid, jsonb, text)
FROM PUBLIC, anon, authenticated;

COMMIT;