-- Pickup Windows v1: additive rollout; enforcement OFF until Admin activation.
-- Existing order/payment/inventory/Makers triggers and notification ownership retained.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.valid_pickup_hours_v1(o time, c time, m smallint)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
 SELECT CASE WHEN o IS NULL AND c IS NULL AND m IS NULL THEN true
 WHEN o IS NULL OR c IS NULL OR m IS NULL THEN false
 ELSE o < c AND c < time '24:00' AND m IN (15,30,60)
 AND extract(second FROM o)=0 AND extract(second FROM c)=0
 AND mod(extract(epoch FROM (c-o)),m*60)=0 END;
$$;
REVOKE ALL ON FUNCTION private.valid_pickup_hours_v1(time,time,smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.valid_pickup_hours_v1(time,time,smallint) TO authenticated,service_role;

ALTER TABLE public.pickup_schedule_locations
 ADD COLUMN pickup_open_time time,
 ADD COLUMN pickup_close_time time,
 ADD COLUMN pickup_slot_minutes smallint,
 ADD CONSTRAINT pickup_schedule_location_hours_v1 CHECK(private.valid_pickup_hours_v1(pickup_open_time,pickup_close_time,pickup_slot_minutes));
ALTER TABLE public.pickup_date_locations
 ADD COLUMN pickup_open_time time,
 ADD COLUMN pickup_close_time time,
 ADD COLUMN pickup_slot_minutes smallint,
 ADD COLUMN pickup_window_revision integer NOT NULL DEFAULT 1 CHECK(pickup_window_revision>0),
 ADD CONSTRAINT pickup_date_location_hours_v1 CHECK(private.valid_pickup_hours_v1(pickup_open_time,pickup_close_time,pickup_slot_minutes));
ALTER TABLE public.orders
 ADD COLUMN pickup_slot_start time,
 ADD COLUMN pickup_slot_end time,
 ADD COLUMN pickup_location_snapshot jsonb,
 ADD COLUMN pickup_window_revision integer,
 ADD CONSTRAINT order_pickup_window_pair_v1 CHECK(
   (pickup_slot_start IS NULL AND pickup_slot_end IS NULL AND pickup_window_revision IS NULL)
   OR (pickup_slot_start IS NOT NULL AND pickup_slot_end IS NOT NULL AND pickup_window_revision IS NOT NULL
       AND pickup_window_revision>0 AND pickup_slot_end>pickup_slot_start
       AND extract(second FROM pickup_slot_start)=0 AND extract(second FROM pickup_slot_end)=0
       AND pickup_slot_end<time '24:00' AND pickup_date IS NOT NULL AND pickup_date_id IS NOT NULL AND pickup_location_id IS NOT NULL)),
 ADD CONSTRAINT order_pickup_location_snapshot_v1 CHECK(pickup_location_snapshot IS NULL OR
   (jsonb_typeof(pickup_location_snapshot)='object' AND coalesce(length(btrim(pickup_location_snapshot->>'name_en')),0)>0));

INSERT INTO public.cms_settings(setting_key,value) VALUES('pickup_windows_required','false') ON CONFLICT(setting_key) DO NOTHING;

CREATE TABLE private.pickup_window_audit_v1(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL,
 scope text NOT NULL, schedule_id uuid, pickup_date_id uuid, location_id uuid,
 before_values jsonb, after_values jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.pickup_window_audit_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.pickup_window_audit_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.pickup_window_audit_v1 TO service_role;

CREATE OR REPLACE FUNCTION private.copy_pickup_window_defaults_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 -- Copy only on creation, never on recurring edits or reactivation.
 IF NEW.pickup_open_time IS NULL THEN
  SELECT sl.pickup_open_time,sl.pickup_close_time,sl.pickup_slot_minutes
  INTO NEW.pickup_open_time,NEW.pickup_close_time,NEW.pickup_slot_minutes
  FROM public.pickup_dates d JOIN public.pickup_schedule_locations sl ON sl.schedule_id=d.schedule_id
  WHERE d.id=NEW.pickup_date_id AND sl.location_id=NEW.location_id;
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION private.copy_pickup_window_defaults_v1() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER copy_pickup_window_defaults_v1 BEFORE INSERT ON public.pickup_date_locations
FOR EACH ROW EXECUTE FUNCTION private.copy_pickup_window_defaults_v1();

CREATE OR REPLACE FUNCTION private.revise_pickup_window_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF (NEW.pickup_open_time,NEW.pickup_close_time,NEW.pickup_slot_minutes,NEW.is_active)
 IS DISTINCT FROM (OLD.pickup_open_time,OLD.pickup_close_time,OLD.pickup_slot_minutes,OLD.is_active) THEN
  NEW.pickup_window_revision := OLD.pickup_window_revision+1;
 ELSE NEW.pickup_window_revision := OLD.pickup_window_revision; END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION private.revise_pickup_window_v1() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER revise_pickup_window_v1 BEFORE UPDATE ON public.pickup_date_locations
FOR EACH ROW EXECUTE FUNCTION private.revise_pickup_window_v1();

CREATE OR REPLACE FUNCTION private.admin_set_pickup_hours_v1(
 p_scope text,p_parent_id uuid,p_location_id uuid,p_open time,p_close time,p_minutes smallint,p_expected_updated_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_row jsonb; new_row jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND role='admin') THEN
  RAISE EXCEPTION 'Admin authorization required' USING ERRCODE='42501'; END IF;
 IF NOT private.valid_pickup_hours_v1(p_open,p_close,p_minutes) OR p_open IS NULL THEN
  RAISE EXCEPTION 'Choose valid same-day hours with a whole number of 15, 30 or 60 minute intervals'; END IF;
 IF p_scope='schedule' THEN
  -- Match materializer/configuration lock order: location, schedule, association.
  PERFORM id FROM public.cms_pickup_locations WHERE id=p_location_id FOR SHARE;
  PERFORM id FROM public.pickup_schedules WHERE id=p_parent_id FOR UPDATE;
  SELECT to_jsonb(sl) INTO old_row FROM public.pickup_schedule_locations sl
   WHERE schedule_id=p_parent_id AND location_id=p_location_id FOR UPDATE;
  IF old_row IS NULL THEN RAISE EXCEPTION 'Save the schedule/location association first'; END IF;
  IF p_expected_updated_at IS NULL OR (old_row->>'updated_at')::timestamptz IS DISTINCT FROM p_expected_updated_at THEN
   RAISE EXCEPTION 'Pickup hours changed. Refresh before saving'; END IF;
  UPDATE public.pickup_schedule_locations SET pickup_open_time=p_open,pickup_close_time=p_close,
   pickup_slot_minutes=p_minutes,updated_at=clock_timestamp()
   WHERE schedule_id=p_parent_id AND location_id=p_location_id RETURNING to_jsonb(pickup_schedule_locations) INTO new_row;
 ELSIF p_scope='date' THEN
  -- Same date-row serialization used by customer order creation.
  PERFORM id FROM public.pickup_dates WHERE id=p_parent_id FOR UPDATE;
  SELECT to_jsonb(dl) INTO old_row FROM public.pickup_date_locations dl
   WHERE pickup_date_id=p_parent_id AND location_id=p_location_id FOR UPDATE;
  IF old_row IS NULL THEN RAISE EXCEPTION 'Enable the date/location association first'; END IF;
  IF p_expected_updated_at IS NULL OR (old_row->>'updated_at')::timestamptz IS DISTINCT FROM p_expected_updated_at THEN
   RAISE EXCEPTION 'Pickup hours changed. Refresh before saving'; END IF;
  -- Until the notification amendment/hold workflow ships, prohibit re-timing
  -- already configured operations with active orders. Initial legacy setup is allowed.
  IF old_row->>'pickup_open_time' IS NOT NULL
    AND (old_row->>'pickup_open_time',old_row->>'pickup_close_time',old_row->>'pickup_slot_minutes')
      IS DISTINCT FROM (p_open::text,p_close::text,p_minutes::text)
    AND EXISTS(SELECT 1 FROM public.orders WHERE pickup_date_id=p_parent_id AND pickup_location_id=p_location_id
       AND purchase_type='online' AND status NOT IN ('cancelled','picked_up','completed')) THEN
   RAISE EXCEPTION 'This operation has active orders. Keep its hours and change recurring defaults for future dates'; END IF;
  UPDATE public.pickup_date_locations SET pickup_open_time=p_open,pickup_close_time=p_close,
   pickup_slot_minutes=p_minutes,updated_at=clock_timestamp()
   WHERE pickup_date_id=p_parent_id AND location_id=p_location_id RETURNING to_jsonb(pickup_date_locations) INTO new_row;
 ELSE RAISE EXCEPTION 'Invalid pickup hours scope'; END IF;
 INSERT INTO private.pickup_window_audit_v1(actor_id,scope,schedule_id,pickup_date_id,location_id,before_values,after_values)
 VALUES(auth.uid(),p_scope,CASE WHEN p_scope='schedule' THEN p_parent_id END,
 CASE WHEN p_scope='date' THEN p_parent_id END,p_location_id,old_row,new_row);
 RETURN new_row;
END;$$;
REVOKE ALL ON FUNCTION private.admin_set_pickup_hours_v1(text,uuid,uuid,time,time,smallint,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.admin_set_pickup_hours_v1(text,uuid,uuid,time,time,smallint,timestamptz) TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_set_pickup_hours_v1(
 p_scope text,p_parent_id uuid,p_location_id uuid,p_open time,p_close time,p_minutes smallint,p_expected_updated_at timestamptz)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT private.admin_set_pickup_hours_v1(p_scope,p_parent_id,p_location_id,p_open,p_close,p_minutes,p_expected_updated_at);$$;
REVOKE ALL ON FUNCTION public.admin_set_pickup_hours_v1(text,uuid,uuid,time,time,smallint,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_pickup_hours_v1(text,uuid,uuid,time,time,smallint,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION private.admin_set_pickup_windows_required_v1(p_required boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_value text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND role='admin') THEN
  RAISE EXCEPTION 'Admin authorization required' USING ERRCODE='42501'; END IF;
 IF p_required IS NULL THEN RAISE EXCEPTION 'Required state is missing'; END IF;
 SELECT value INTO old_value FROM public.cms_settings WHERE setting_key='pickup_windows_required' FOR UPDATE;
 IF p_required AND (NOT EXISTS(SELECT 1 FROM public.cms_settings WHERE setting_key='pickup_v2_customer_enabled' AND value='true')
 OR EXISTS(SELECT 1 FROM public.pickup_dates d JOIN public.pickup_date_locations dl ON dl.pickup_date_id=d.id
  JOIN public.cms_pickup_locations l ON l.id=dl.location_id
  WHERE d.status='open' AND d.order_cutoff_at>now() AND d.pickup_date>=timezone('Asia/Bangkok',now())::date
   AND dl.is_active AND l.is_active AND dl.pickup_open_time IS NULL)) THEN
  RAISE EXCEPTION 'Enable Pickup v2 and configure all future bookable pickup operations before requiring windows'; END IF;
 UPDATE public.cms_settings SET value=CASE WHEN p_required THEN 'true' ELSE 'false' END
 WHERE setting_key='pickup_windows_required';
 INSERT INTO private.pickup_window_audit_v1(actor_id,scope,before_values,after_values)
 VALUES(auth.uid(),'rollout',to_jsonb(old_value),to_jsonb(p_required));
END;$$;
REVOKE ALL ON FUNCTION private.admin_set_pickup_windows_required_v1(boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.admin_set_pickup_windows_required_v1(boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_set_pickup_windows_required_v1(p_required boolean)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT private.admin_set_pickup_windows_required_v1(p_required);$$;
REVOKE ALL ON FUNCTION public.admin_set_pickup_windows_required_v1(boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_pickup_windows_required_v1(boolean) TO authenticated;

-- Existing verified core preserves all stock, account and payment/Makers trigger behavior.
CREATE OR REPLACE FUNCTION private.create_online_order_with_pickup_window_v1(p_order_number text, p_pickup_date_id uuid, p_pickup_location_id uuid, p_items jsonb, p_notes text, p_slot_start time, p_slot_end time, p_window_revision integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_operation public.pickup_date_locations%ROWTYPE;
  v_location_snapshot jsonb;
  v_required boolean;
  v_setting text;
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
  WHERE client_request_reference = p_order_number;
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

    IF v_existing.pickup_slot_start IS DISTINCT FROM p_slot_start
       OR v_existing.pickup_slot_end IS DISTINCT FROM p_slot_end
       OR v_existing.pickup_window_revision IS DISTINCT FROM p_window_revision THEN
      RAISE EXCEPTION 'Order reference conflict: pickup window differs';
    END IF;
    RETURN to_jsonb(v_existing);
  END IF;

  SELECT value INTO v_setting FROM public.cms_settings WHERE setting_key='pickup_windows_required' FOR SHARE;
  v_required := coalesce(v_setting,'false')='true';
  IF v_required AND (p_slot_start IS NULL OR p_slot_end IS NULL OR p_window_revision IS NULL) THEN
    RAISE EXCEPTION 'PICKUP_WINDOW_REQUIRED'; END IF;
  IF (p_slot_start IS NULL)::integer+(p_slot_end IS NULL)::integer+(p_window_revision IS NULL)::integer NOT IN (0,3) THEN
    RAISE EXCEPTION 'PICKUP_WINDOW_INVALID'; END IF;

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

  SELECT * INTO v_operation FROM public.pickup_date_locations
   WHERE pickup_date_id=p_pickup_date_id AND location_id=p_pickup_location_id;
  IF p_slot_start IS NOT NULL THEN
    IF v_operation.pickup_open_time IS NULL OR p_window_revision IS DISTINCT FROM v_operation.pickup_window_revision THEN
      RAISE EXCEPTION 'PICKUP_WINDOW_CHANGED'; END IF;
    IF extract(second FROM p_slot_start)<>0 OR extract(second FROM p_slot_end)<>0
       OR p_slot_start<v_operation.pickup_open_time OR p_slot_end>v_operation.pickup_close_time
       OR p_slot_end<=p_slot_start
       OR extract(epoch FROM (p_slot_end-p_slot_start))<>v_operation.pickup_slot_minutes*60
       OR mod(extract(epoch FROM (p_slot_start-v_operation.pickup_open_time)),v_operation.pickup_slot_minutes*60)<>0 THEN
      RAISE EXCEPTION 'PICKUP_WINDOW_INVALID'; END IF;
  END IF;
  SELECT jsonb_build_object('name_en',name_en,'name_th',name_th,'name_zh',name_zh,'maps_url',maps_url)
   INTO v_location_snapshot FROM public.cms_pickup_locations WHERE id=p_pickup_location_id;

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
    customer_id, order_number, client_request_reference, order_items, total_amount,
    pickup_location_id, pickup_date, pickup_date_id, pickup_slot_start, pickup_slot_end, pickup_window_revision, pickup_location_snapshot,
    status, payment_status, line_id,
    customer_name, customer_phone, customer_email, notes,
    pickup_day, purchase_type, inventory_reserved
  ) VALUES (
    v_customer.id, 'JT-' || nextval('public.online_order_number_seq')::text, p_order_number, v_order_items, v_total,
    p_pickup_location_id, v_date.pickup_date, v_date.id, p_slot_start, p_slot_end, p_window_revision, v_location_snapshot,
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
$function$

;
REVOKE ALL ON FUNCTION private.create_online_order_with_pickup_window_v1(text,uuid,uuid,jsonb,text,time,time,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.create_online_order_with_pickup_window_v1(text,uuid,uuid,jsonb,text,time,time,integer) TO authenticated;
CREATE OR REPLACE FUNCTION public.create_online_order_with_pickup_window_v1(
 p_order_number text,p_pickup_date_id uuid,p_pickup_location_id uuid,p_items jsonb,p_notes text,p_slot_start time,p_slot_end time,p_window_revision integer)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT private.create_online_order_with_pickup_window_v1(p_order_number,p_pickup_date_id,p_pickup_location_id,p_items,p_notes,p_slot_start,p_slot_end,p_window_revision);$$;
REVOKE ALL ON FUNCTION public.create_online_order_with_pickup_window_v1(text,uuid,uuid,jsonb,text,time,time,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_online_order_with_pickup_window_v1(text,uuid,uuid,jsonb,text,time,time,integer) TO authenticated;
CREATE OR REPLACE FUNCTION public.create_online_order_v2(
 p_order_number text,p_pickup_date_id uuid,p_pickup_location_id uuid,p_items jsonb,p_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT private.create_online_order_with_pickup_window_v1(p_order_number,p_pickup_date_id,p_pickup_location_id,p_items,p_notes,NULL,NULL,NULL);$$;
REVOKE ALL ON FUNCTION public.create_online_order_v2(text,uuid,uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_online_order_v2(text,uuid,uuid,jsonb,text) TO authenticated;

-- Legacy creation stays available while staged OFF; cannot bypass after activation.
CREATE OR REPLACE FUNCTION public.create_online_order(p_order_number text, p_pickup_day_key text, p_items jsonb, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_customer public.customers%rowtype;
  v_pickup public.cms_pickup_days%rowtype;
  v_cutoff public.pickup_cutoff_rules%rowtype;
  v_override public.pickup_overrides%rowtype;
  v_existing public.orders%rowtype;
  v_product public.cms_products%rowtype;
  v_order public.orders%rowtype;
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
  v_language text := 'en';
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_order_number is null or p_order_number !~ '^ORD-[0-9]{10,20}-[A-Z0-9]{4,12}$' then
    raise exception 'Invalid order reference';
  end if;
  if p_pickup_day_key is null or btrim(p_pickup_day_key) = '' then
    raise exception 'Pickup day is required';
  end if;
  if p_notes is not null and length(p_notes) > 2000 then
    raise exception 'Order notes are too long';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Order items must be an array';
  end if;
  v_item_count := jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 50 then
    raise exception 'Order must contain between 1 and 50 items';
  end if;

  select count(distinct item.product_id),
         count(*) filter (where item.product_id is null or item.quantity is null or item.quantity < 1 or item.quantity > 99)
  into v_distinct_item_count, v_invalid_item_count
  from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer);

  if v_invalid_item_count > 0 then
    raise exception 'Each order item requires a valid product and quantity from 1 to 99';
  end if;
  if v_distinct_item_count <> v_item_count then
    raise exception 'Duplicate products are not allowed in one order request';
  end if;

  select * into v_customer
  from public.customers
  where id = v_user_id
  for update;
  if not found then raise exception 'Completed customer profile required'; end if;
  if coalesce(v_customer.status, 'active') <> 'active' then raise exception 'Customer account is not active'; end if;

  select case lower(coalesce(up.preferred_language, 'en')) when 'th' then 'th' when 'zh' then 'zh' else 'en' end
  into v_language
  from public.user_profiles up
  where up.id = v_user_id;
  v_language := coalesce(v_language, 'en');

  select * into v_existing from public.orders where client_request_reference = p_order_number;
  if found then
    if v_existing.customer_id is distinct from v_user_id or coalesce(v_existing.purchase_type, 'online') <> 'online' then
      raise exception 'Order reference conflict';
    end if;
    return to_jsonb(v_existing);
  end if;

  if exists(select 1 from public.cms_settings where setting_key='pickup_windows_required' and value='true') then
    raise exception 'PICKUP_WINDOW_REQUIRED';
  end if;

  select * into v_pickup
  from public.cms_pickup_days
  where day_key = p_pickup_day_key and coalesce(is_open, false) = true;
  if not found then raise exception 'Selected pickup day is not available'; end if;
  if v_pickup.location_id is null then raise exception 'Selected pickup day has no pickup location'; end if;

  select * into v_cutoff
  from public.pickup_cutoff_rules
  where day_key = v_pickup.day_key and coalesce(is_active, false) = true;
  if not found then raise exception 'No active cutoff rule exists for the selected pickup day'; end if;

  v_today_bangkok := v_now_bangkok::date;
  v_pickup_date := v_today_bangkok + ((v_pickup.pickup_weekday - extract(dow from v_today_bangkok)::integer + 7) % 7);

  select * into v_override
  from public.pickup_overrides
  where date = v_pickup_date
    and pickup_day = v_cutoff.pickup_day
    and location = v_cutoff.location
    and coalesce(is_active, false) = true
  order by updated_at desc nulls last, created_at desc nulls last
  limit 1;

  if found and v_override.override_type in ('closed', 'sold_out') then
    raise exception 'Selected pickup day is unavailable';
  end if;

  if found and v_override.override_type = 'custom_cutoff' then
    if v_override.custom_cutoff_day is null or v_override.custom_cutoff_time is null then
      raise exception 'Invalid custom cutoff configuration';
    end if;
    v_cutoff_day := v_override.custom_cutoff_day;
    v_cutoff_time := v_override.custom_cutoff_time;
  else
    v_cutoff_day := v_cutoff.cutoff_day;
    v_cutoff_time := v_cutoff.cutoff_time;
  end if;

  v_cutoff_weekday := case v_cutoff_day
    when 'Sunday' then 0 when 'Monday' then 1 when 'Tuesday' then 2 when 'Wednesday' then 3
    when 'Thursday' then 4 when 'Friday' then 5 when 'Saturday' then 6 else null end;
  if v_cutoff_weekday is null then raise exception 'Invalid cutoff day configuration'; end if;

  begin
    v_cutoff_date := v_pickup_date - ((v_pickup.pickup_weekday - v_cutoff_weekday + 7) % 7);
    v_cutoff_at := v_cutoff_date::timestamp + v_cutoff_time::time;
  exception when invalid_datetime_format then
    raise exception 'Invalid cutoff time configuration';
  end;
  if v_now_bangkok >= v_cutoff_at then raise exception 'Ordering cutoff has passed for the selected pickup day'; end if;

  for v_item in
    select item.product_id, item.quantity
    from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
    order by item.product_id
  loop
    select * into v_product from public.cms_products where id = v_item.product_id for update;
    if not found then raise exception 'A selected product no longer exists'; end if;
    if coalesce(v_product.is_active, false) = false or coalesce(v_product.is_sold_out, false) = true then
      raise exception 'Product % is not available', v_product.name_en;
    end if;

    v_available_days := coalesce(v_product.available_days, '[]'::jsonb);
    if jsonb_typeof(v_available_days) <> 'array' then raise exception 'Invalid availability configuration for product %', v_product.name_en; end if;
    if jsonb_array_length(v_available_days) > 0 and not (
      v_available_days ? v_pickup.day_key
      or v_available_days ? v_pickup.label
      or (v_pickup.label_en is not null and v_available_days ? v_pickup.label_en)
      or v_available_days ? (v_cutoff.pickup_day || ' – ' || v_cutoff.location)
      or v_available_days ? (v_cutoff.pickup_day || ' - ' || v_cutoff.location)
    ) then
      raise exception 'Product % is not offered for the selected pickup day', v_product.name_en;
    end if;

    v_stock := coalesce(
      nullif(v_product.stock_by_day ->> v_pickup.day_key, '')::integer,
      nullif(v_product.stock_by_day ->> v_pickup.label, '')::integer,
      nullif(v_product.stock_by_day ->> coalesce(v_pickup.label_en, v_pickup.label), '')::integer,
      nullif(v_product.stock_by_day ->> (v_cutoff.pickup_day || ' – ' || v_cutoff.location), '')::integer,
      nullif(v_product.stock_by_day ->> (v_cutoff.pickup_day || ' - ' || v_cutoff.location), '')::integer,
      v_product.stock_remaining,
      0
    );
    if v_stock < v_item.quantity then raise exception 'Insufficient stock for product %', v_product.name_en; end if;

    v_total := v_total + (v_product.price * v_item.quantity);
    v_order_items := v_order_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'product_name', v_product.name_en,
      'product_name_th', v_product.name_th,
      'product_name_zh', coalesce(v_product.name_zh, ''),
      'quantity', v_item.quantity,
      'price_at_order', v_product.price
    ));

    update public.cms_products
    set stock_by_day = jsonb_set(coalesce(stock_by_day, '{}'::jsonb), array[v_pickup.day_key], to_jsonb(v_stock - v_item.quantity), true),
        updated_at = now()
    where id = v_product.id;
  end loop;

  insert into public.orders (
    customer_id, order_number, client_request_reference, order_items, total_amount, pickup_location_id, pickup_date,
    status, payment_status, line_id, customer_name, customer_phone, customer_email, notes,
    pickup_day, purchase_type, inventory_reserved
  ) values (
    v_customer.id, 'JT-' || nextval('public.online_order_number_seq')::text, p_order_number, v_order_items, v_total, v_pickup.location_id, v_pickup_date,
    'pending', 'unpaid', v_customer.line_id, v_customer.name, v_customer.phone, v_customer.email,
    nullif(btrim(coalesce(p_notes, '')), ''), coalesce(v_pickup.label_en, v_pickup.label), 'online', true
  ) returning * into v_order;

  insert into public.order_notification_events (order_id, notification_type, language)
  values
    (v_order.id, 'customer_confirmation', v_language),
    (v_order.id, 'admin_new_order', null)
  on conflict (order_id, notification_type) do nothing;

  return to_jsonb(v_order);
end;
$function$

;

CREATE OR REPLACE FUNCTION private.customer_pickup_availability_v2(p_product_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(pickup_date_id uuid, pickup_date date, order_cutoff_at timestamp with time zone, schedule_id uuid, schedule_key text, schedule_label_en text, schedule_label_th text, schedule_label_zh text, product_id uuid, remaining_quantity integer, locations jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    d.id as pickup_date_id,
    d.pickup_date,
    d.order_cutoff_at,
    s.id as schedule_id,
    s.schedule_key,
    s.label_en as schedule_label_en,
    s.label_th as schedule_label_th,
    s.label_zh as schedule_label_zh,
    i.product_id,
    greatest(i.capacity - i.reserved_quantity, 0)::integer as remaining_quantity,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'name_en', l.name_en,
          'name_th', l.name_th,
          'name_zh', l.name_zh,
          'description_en', l.description_en,
          'description_th', l.description_th,
          'description_zh', l.description_zh,
          'maps_url', l.maps_url,
          'sort_order', dl.sort_order,
          'pickup_open_time', dl.pickup_open_time,
          'pickup_close_time', dl.pickup_close_time,
          'pickup_slot_minutes', dl.pickup_slot_minutes,
          'pickup_window_revision', dl.pickup_window_revision
        )
        order by dl.sort_order, l.sort_order, l.name_en
      )
      from public.pickup_date_locations dl
      join public.cms_pickup_locations l
        on l.id = dl.location_id
      where dl.pickup_date_id = d.id
        and dl.is_active = true
        and l.is_active = true
    ), '[]'::jsonb) as locations
  from public.product_date_inventory i
  join public.pickup_dates d
    on d.id = i.pickup_date_id
  join public.pickup_schedules s
    on s.id = d.schedule_id
  join public.cms_products p
    on p.id = i.product_id
  left join public.product_schedule_capacity c
    on c.schedule_id = d.schedule_id
   and c.product_id = i.product_id
  where d.pickup_date >= timezone('Asia/Bangkok', now())::date
    and d.status = 'open'
    and now() < d.order_cutoff_at
    and s.is_active = true
    and p.is_active = true
    and coalesce(p.is_sold_out, false) = false
    and (
      p_product_ids is null
      or cardinality(p_product_ids) = 0
      or i.product_id = any(p_product_ids)
    )
    and (
      i.capacity_source <> 'recurring_default'
      or coalesce(c.is_active, false) = true
    )
    and exists (
      select 1
      from public.pickup_date_locations dl
      join public.cms_pickup_locations l
        on l.id = dl.location_id
      where dl.pickup_date_id = d.id
        and dl.is_active = true
        and l.is_active = true
    )
  order by d.pickup_date, s.sort_order, i.product_id;
$function$

;
CREATE OR REPLACE FUNCTION private.guard_pickup_window_reactivation_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE operation public.pickup_date_locations%ROWTYPE;
BEGIN
 SELECT * INTO operation FROM public.pickup_date_locations
 WHERE pickup_date_id=NEW.pickup_date_id AND location_id=NEW.pickup_location_id;
 IF NOT FOUND OR operation.pickup_open_time IS NULL
   OR NEW.pickup_slot_start<operation.pickup_open_time OR NEW.pickup_slot_end>operation.pickup_close_time THEN
  RAISE EXCEPTION 'The original pickup window is no longer available. Please use Order again'; END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION private.guard_pickup_window_reactivation_v1() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_pickup_window_reactivation_v1 BEFORE UPDATE OF status ON public.orders
FOR EACH ROW WHEN (OLD.status='cancelled' AND NEW.status='pending' AND NEW.pickup_slot_start IS NOT NULL)
EXECUTE FUNCTION private.guard_pickup_window_reactivation_v1();
COMMIT;
