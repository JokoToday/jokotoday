-- Specials phase 1: private batch preparation and physically isolated surplus.
-- No public publishing, customer holds, payment changes or LINE sends in this slice.
-- Existing product stock fields are production capacity, NOT an authoritative
-- physical walk-in pool. Manual intake never mutates those fields.
BEGIN;
CREATE SCHEMA IF NOT EXISTS specials_private;
REVOKE ALL ON SCHEMA specials_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA specials_private TO authenticated, service_role;

CREATE TABLE public.specials_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  business_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','prepared','closed','cancelled')),
  pickup_location_id uuid NOT NULL REFERENCES public.cms_pickup_locations(id) ON DELETE RESTRICT,
  sales_start_at timestamptz NOT NULL,
  sales_end_at timestamptz NOT NULL,
  pickup_start_at timestamptz NOT NULL,
  pickup_end_at timestamptz NOT NULL,
  hold_minutes integer NOT NULL DEFAULT 5 CHECK (hold_minutes = 5),
  verification_grace_minutes integer NOT NULL DEFAULT 2 CHECK (verification_grace_minutes = 2),
  pickup_buffer_minutes integer NOT NULL DEFAULT 15 CHECK (pickup_buffer_minutes = 15),
  notes_internal text NOT NULL DEFAULT '' CHECK (length(notes_internal) <= 2000),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  prepared_at timestamptz,
  closed_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT specials_batch_window CHECK (
    sales_start_at + interval '5 minutes' < sales_end_at
    AND pickup_start_at < pickup_end_at
    AND sales_end_at + interval '15 minutes' <= pickup_end_at
    AND (sales_start_at AT TIME ZONE 'Asia/Bangkok')::date = business_date
    AND (sales_end_at AT TIME ZONE 'Asia/Bangkok')::date = business_date
    AND (pickup_start_at AT TIME ZONE 'Asia/Bangkok')::date = business_date
    AND (pickup_end_at AT TIME ZONE 'Asia/Bangkok')::date = business_date
  )
);
CREATE UNIQUE INDEX specials_one_prepared_batch ON public.specials_batches ((true)) WHERE status = 'prepared';
CREATE INDEX specials_batches_date_idx ON public.specials_batches (business_date DESC, created_at DESC);
CREATE INDEX specials_batches_location_idx ON public.specials_batches(pickup_location_id);
CREATE INDEX specials_batches_creator_idx ON public.specials_batches(created_by);

CREATE TABLE public.specials_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.specials_batches(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.cms_products(id) ON DELETE RESTRICT,
  regular_price_satang integer NOT NULL CHECK (regular_price_satang > 0),
  special_price_satang integer NOT NULL CHECK (special_price_satang > 0 AND special_price_satang <= regular_price_satang),
  quantity_allocated integer NOT NULL DEFAULT 0 CHECK (quantity_allocated >= 0),
  quantity_available integer NOT NULL DEFAULT 0 CHECK (quantity_available >= 0),
  quantity_held integer NOT NULL DEFAULT 0 CHECK (quantity_held >= 0),
  quantity_committed integer NOT NULL DEFAULT 0 CHECK (quantity_committed >= 0),
  max_per_customer integer CHECK (max_per_customer > 0),
  is_enabled boolean NOT NULL DEFAULT true,
  made_by_joko_confirmed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  UNIQUE (batch_id, product_id),
  CONSTRAINT specials_inventory_balance CHECK (
    quantity_allocated = quantity_available + quantity_held + quantity_committed
  )
);
CREATE INDEX specials_items_product_idx ON public.specials_items(product_id);
CREATE INDEX specials_items_attestor_idx ON public.specials_items(made_by_joko_confirmed_by);

CREATE TABLE public.specials_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.specials_batches(id) ON DELETE RESTRICT,
  item_id uuid REFERENCES public.specials_items(id) ON DELETE RESTRICT,
  operation_key uuid NOT NULL UNIQUE,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('batch_created','batch_updated','batch_prepared','batch_closed','batch_cancelled','item_created','item_updated','transfer_in','transfer_out')),
  quantity_delta integer NOT NULL DEFAULT 0,
  source_reference text,
  reason text NOT NULL,
  request_payload jsonb NOT NULL,
  result_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX specials_audit_batch_idx ON public.specials_audit_events(batch_id, created_at DESC);
CREATE INDEX specials_audit_item_idx ON public.specials_audit_events(item_id);
CREATE INDEX specials_audit_actor_idx ON public.specials_audit_events(actor_id);

-- Authorization helper is private, not a publicly exposed privileged endpoint.
CREATE FUNCTION specials_private.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role::text = 'admin'
  );
$$;
REVOKE ALL ON FUNCTION specials_private.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION specials_private.is_admin() TO authenticated, service_role;

ALTER TABLE public.specials_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specials_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specials_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.specials_batches, public.specials_items, public.specials_audit_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.specials_batches, public.specials_items, public.specials_audit_events TO authenticated;
GRANT SELECT ON public.specials_batches, public.specials_items, public.specials_audit_events TO service_role;
CREATE POLICY specials_batches_admin_read ON public.specials_batches FOR SELECT TO authenticated USING ((SELECT specials_private.is_admin()));
CREATE POLICY specials_items_admin_read ON public.specials_items FOR SELECT TO authenticated USING ((SELECT specials_private.is_admin()));
CREATE POLICY specials_audit_admin_read ON public.specials_audit_events FOR SELECT TO authenticated USING ((SELECT specials_private.is_admin()));

-- Browser-callable wrappers are invokers. The single privileged dispatcher is
-- in the unexposed private schema and rechecks actor, action and every invariant.
CREATE FUNCTION specials_private.admin_action(p_action text, p_request jsonb, p_operation_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_prior public.specials_audit_events%ROWTYPE;
  v_batch public.specials_batches%ROWTYPE;
  v_item public.specials_items%ROWTYPE;
  v_product public.cms_products%ROWTYPE;
  v_result jsonb;
  v_event text;
  v_reason text;
  v_source text;
  v_qty integer := 0;
  v_delta integer := 0;
  v_today date := (clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date;
  v_now timestamptz;
BEGIN
  IF NOT specials_private.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_operation_key IS NULL OR p_request IS NULL OR jsonb_typeof(p_request) <> 'object'
     OR p_action IS NULL OR p_action NOT IN ('save_batch','save_item','transfer','prepare','close','cancel') THEN
    RAISE EXCEPTION 'Invalid Specials operation' USING ERRCODE = '22023';
  END IF;
  -- Same operation key is serialized before checking the durable audit record.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_operation_key::text, 731));
  SELECT * INTO v_prior FROM public.specials_audit_events WHERE operation_key = p_operation_key;
  IF FOUND THEN
    IF v_prior.actor_id IS DISTINCT FROM v_actor
       OR v_prior.request_payload IS DISTINCT FROM jsonb_build_object('action',p_action,'request',p_request) THEN
      RAISE EXCEPTION 'Operation key was already used for a different request' USING ERRCODE = '22023';
    END IF;
    RETURN v_prior.result_payload;
  END IF;
  -- Shared lock order for all mutations: batch first, then item/product.
  IF nullif(p_request->>'batch_id','') IS NOT NULL THEN
    SELECT * INTO v_batch FROM public.specials_batches WHERE id = (p_request->>'batch_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Specials batch not found'; END IF;
    IF (p_request->>'expected_version') IS NULL OR v_batch.version <> (p_request->>'expected_version')::integer THEN
      RAISE EXCEPTION 'Batch changed. Refresh before trying again.' USING ERRCODE = '40001';
    END IF;
  ELSIF p_action <> 'save_batch' THEN
    RAISE EXCEPTION 'Batch is required';
  END IF;
  v_now := clock_timestamp();
  v_today := (v_now AT TIME ZONE 'Asia/Bangkok')::date;

  IF p_action = 'save_batch' THEN
    IF v_batch.id IS NOT NULL AND v_batch.status <> 'draft' THEN RAISE EXCEPTION 'Only a draft batch can be edited'; END IF;
    IF (p_request->>'business_date')::date IS DISTINCT FROM v_today THEN RAISE EXCEPTION 'Specials must be prepared for today in Bangkok'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.cms_pickup_locations WHERE id = (p_request->>'pickup_location_id')::uuid AND is_active = true) THEN
      RAISE EXCEPTION 'Choose an active pickup location';
    END IF;
    IF (p_request->>'sales_end_at')::timestamptz <= v_now + interval '5 minutes' THEN RAISE EXCEPTION 'Allow a full 5-minute payment window before sales end'; END IF;
    IF v_batch.id IS NULL THEN
      INSERT INTO public.specials_batches(title,business_date,pickup_location_id,sales_start_at,sales_end_at,pickup_start_at,pickup_end_at,notes_internal,created_by)
      VALUES (btrim(p_request->>'title'),v_today,(p_request->>'pickup_location_id')::uuid,(p_request->>'sales_start_at')::timestamptz,(p_request->>'sales_end_at')::timestamptz,(p_request->>'pickup_start_at')::timestamptz,(p_request->>'pickup_end_at')::timestamptz,coalesce(p_request->>'notes_internal',''),v_actor)
      RETURNING * INTO v_batch;
      v_event := 'batch_created';
    ELSE
      UPDATE public.specials_batches SET title=btrim(p_request->>'title'),business_date=v_today,pickup_location_id=(p_request->>'pickup_location_id')::uuid,
        sales_start_at=(p_request->>'sales_start_at')::timestamptz,sales_end_at=(p_request->>'sales_end_at')::timestamptz,
        pickup_start_at=(p_request->>'pickup_start_at')::timestamptz,pickup_end_at=(p_request->>'pickup_end_at')::timestamptz,
        notes_internal=coalesce(p_request->>'notes_internal',''),version=version+1,updated_at=v_now WHERE id=v_batch.id RETURNING * INTO v_batch;
      v_event := 'batch_updated';
    END IF;
    v_reason := 'Same-day batch setup';
  ELSIF p_action = 'save_item' THEN
    IF v_batch.status <> 'draft' OR v_batch.business_date <> v_today THEN RAISE EXCEPTION 'Products can only be edited in today''s draft'; END IF;
    IF (p_request->>'made_by_joko_confirmed')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'Confirm this product is made by JOKO'; END IF;
    SELECT * INTO v_product FROM public.cms_products WHERE id=(p_request->>'product_id')::uuid FOR SHARE;
    IF NOT FOUND OR v_product.is_active IS DISTINCT FROM true THEN RAISE EXCEPTION 'Choose an active catalogue product'; END IF;
    IF nullif(p_request->>'item_id','') IS NOT NULL THEN
      SELECT * INTO v_item FROM public.specials_items WHERE id=(p_request->>'item_id')::uuid AND batch_id=v_batch.id FOR UPDATE;
      IF NOT FOUND OR v_item.product_id <> v_product.id THEN RAISE EXCEPTION 'Offer not found or product changed'; END IF;
      IF v_item.version <> (p_request->>'item_version')::integer OR (p_request->>'item_version') IS NULL THEN RAISE EXCEPTION 'Offer changed. Refresh before trying again.' USING ERRCODE='40001'; END IF;
      UPDATE public.specials_items SET special_price_satang=(p_request->>'special_price_satang')::integer,
        max_per_customer=nullif(p_request->>'max_per_customer','')::integer,is_enabled=coalesce((p_request->>'is_enabled')::boolean,true),
        updated_at=v_now,version=version+1 WHERE id=v_item.id RETURNING * INTO v_item;
      v_event := 'item_updated';
    ELSE
      INSERT INTO public.specials_items(batch_id,product_id,regular_price_satang,special_price_satang,max_per_customer,made_by_joko_confirmed_by)
      VALUES (v_batch.id,v_product.id,round(v_product.price*100)::integer,(p_request->>'special_price_satang')::integer,nullif(p_request->>'max_per_customer','')::integer,v_actor)
      RETURNING * INTO v_item;
      v_event := 'item_created';
    END IF;
    v_reason := 'Offer price and Made by JOKO attestation';
  ELSIF p_action = 'transfer' THEN
    SELECT * INTO v_item FROM public.specials_items WHERE id=(p_request->>'item_id')::uuid AND batch_id=v_batch.id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Offer not found'; END IF;
    v_qty := (p_request->>'quantity')::integer;
    v_source := nullif(btrim(p_request->>'source_reference'),'');
    v_reason := nullif(btrim(p_request->>'reason'),'');
    IF v_qty IS NULL OR v_qty <= 0 OR v_source IS NULL OR v_reason IS NULL OR length(v_source)>500 OR length(v_reason)>1000 THEN RAISE EXCEPTION 'Positive quantity, source/destination and reason are required'; END IF;
    IF p_request->>'direction' = 'in' THEN
      IF v_batch.status NOT IN ('draft','prepared') OR v_batch.business_date <> v_today OR v_now >= v_batch.sales_end_at THEN RAISE EXCEPTION 'Stock intake requires today''s open preparation'; END IF;
      IF (p_request->>'physically_isolated')::boolean IS DISTINCT FROM true OR (p_request->>'unallocated_and_good_quality')::boolean IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Count, isolate and confirm unallocated good-quality stock before transfer';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.cms_products WHERE id=v_item.product_id AND is_active=true) THEN RAISE EXCEPTION 'Product is inactive'; END IF;
      v_delta := v_qty;
      v_event := 'transfer_in';
    ELSIF p_request->>'direction' = 'out' THEN
      IF v_qty > v_item.quantity_available THEN RAISE EXCEPTION 'Only available stock can be released'; END IF;
      v_delta := -v_qty;
      v_event := 'transfer_out';
    ELSE RAISE EXCEPTION 'Transfer direction must be in or out'; END IF;
    UPDATE public.specials_items SET quantity_allocated=quantity_allocated+v_delta,quantity_available=quantity_available+v_delta,
      version=version+1,updated_at=v_now WHERE id=v_item.id RETURNING * INTO v_item;
    -- Never edit cms_products.stock_remaining or product_date_inventory here.
  ELSIF p_action = 'prepare' THEN
    IF v_batch.status <> 'draft' OR v_batch.business_date <> v_today THEN RAISE EXCEPTION 'Prepare today''s draft only'; END IF;
    IF v_now < v_batch.sales_start_at OR v_now >= v_batch.sales_end_at - interval '5 minutes' THEN RAISE EXCEPTION 'Preparation must occur within the valid sales opportunity'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.cms_pickup_locations WHERE id=v_batch.pickup_location_id AND is_active=true) THEN RAISE EXCEPTION 'Pickup location is inactive'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.specials_items WHERE batch_id=v_batch.id AND is_enabled AND quantity_available>0) THEN RAISE EXCEPTION 'Transfer some stock before preparing'; END IF;
    IF EXISTS (SELECT 1 FROM public.specials_items i JOIN public.cms_products p ON p.id=i.product_id WHERE i.batch_id=v_batch.id AND i.is_enabled AND p.is_active IS DISTINCT FROM true) THEN RAISE EXCEPTION 'An enabled product is inactive'; END IF;
    UPDATE public.specials_batches SET status='prepared',prepared_at=v_now,updated_at=v_now,version=version+1 WHERE id=v_batch.id RETURNING * INTO v_batch;
    v_event := 'batch_prepared'; v_reason := 'Reviewed inventory and pickup preview; not published';
  ELSE
    IF v_batch.status NOT IN ('draft','prepared') THEN RAISE EXCEPTION 'Batch already closed or cancelled'; END IF;
    v_reason := nullif(btrim(p_request->>'reason'),'');
    IF v_reason IS NULL OR length(v_reason)>1000 THEN RAISE EXCEPTION 'A closure reason is required'; END IF;
    UPDATE public.specials_batches SET status=CASE WHEN p_action='close' THEN 'closed' ELSE 'cancelled' END,closed_at=v_now,updated_at=v_now,version=version+1 WHERE id=v_batch.id RETURNING * INTO v_batch;
    v_event := CASE WHEN p_action='close' THEN 'batch_closed' ELSE 'batch_cancelled' END;
    -- Closure does not silently release physical stock. Transfer out explicitly.
  END IF;
  IF p_action IN ('save_item','transfer') THEN
    UPDATE public.specials_batches SET version=version+1,updated_at=v_now WHERE id=v_batch.id RETURNING * INTO v_batch;
  END IF;
  v_result := jsonb_build_object('batch',to_jsonb(v_batch),'item',CASE WHEN v_item.id IS NULL THEN NULL ELSE to_jsonb(v_item) END);
  INSERT INTO public.specials_audit_events(batch_id,item_id,operation_key,actor_id,event_type,quantity_delta,source_reference,reason,request_payload,result_payload)
  VALUES (v_batch.id,v_item.id,p_operation_key,v_actor,v_event,v_delta,v_source,v_reason,jsonb_build_object('action',p_action,'request',p_request),v_result);
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION specials_private.admin_action(text,jsonb,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION specials_private.admin_action(text,jsonb,uuid) TO authenticated;

CREATE FUNCTION public.admin_specials_action_v1(p_action text,p_request jsonb,p_operation_key uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT specials_private.admin_action(p_action,p_request,p_operation_key);
$$;
REVOKE ALL ON FUNCTION public.admin_specials_action_v1(text,jsonb,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_specials_action_v1(text,jsonb,uuid) TO authenticated;
COMMENT ON FUNCTION public.admin_specials_action_v1(text,jsonb,uuid) IS 'Admin-only, atomic, idempotent Specials preparation. No publish/payment/send capability in phase 1.';
COMMIT;
