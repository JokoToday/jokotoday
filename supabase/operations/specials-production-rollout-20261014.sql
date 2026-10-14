-- PREPARED ONLY. Apply only after explicit production rollout approval.
-- This bundle assumes the independently approved current-main notification-preferences rollout is complete.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
DO $preflight$
BEGIN
 IF to_regclass('public.specials_batches') IS NOT NULL THEN RAISE EXCEPTION 'Specials already exists; inspect migration history instead of reapplying'; END IF;
 IF to_regprocedure('public.resolve_customer_notification_recipient_v1(uuid,text)') IS NULL THEN RAISE EXCEPTION 'Complete the current-main notification-preferences rollout first'; END IF;
 IF to_regprocedure('public.notification_channel_allowed_v1(uuid,text)') IS NULL THEN RAISE EXCEPTION 'Complete current-main legacy notification pause-gate rollout first'; END IF;
 -- Preserve independently approved transactional notification controls; this bundle does not change them.
END $preflight$;

-- 20261008101347_joko_specials_inventory_foundation_v1.sql
-- Specials phase 1: private batch preparation and physically isolated surplus.
-- No public publishing, customer holds, payment changes or LINE sends in this slice.
-- Existing product stock fields are production capacity, NOT an authoritative
-- physical walk-in pool. Manual intake never mutates those fields.

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

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261008101347','joko_specials_inventory_foundation_v1',ARRAY['-- Specials phase 1: private batch preparation and physically isolated surplus.
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
  status text NOT NULL DEFAULT ''draft'' CHECK (status IN (''draft'',''prepared'',''closed'',''cancelled'')),
  pickup_location_id uuid NOT NULL REFERENCES public.cms_pickup_locations(id) ON DELETE RESTRICT,
  sales_start_at timestamptz NOT NULL,
  sales_end_at timestamptz NOT NULL,
  pickup_start_at timestamptz NOT NULL,
  pickup_end_at timestamptz NOT NULL,
  hold_minutes integer NOT NULL DEFAULT 5 CHECK (hold_minutes = 5),
  verification_grace_minutes integer NOT NULL DEFAULT 2 CHECK (verification_grace_minutes = 2),
  pickup_buffer_minutes integer NOT NULL DEFAULT 15 CHECK (pickup_buffer_minutes = 15),
  notes_internal text NOT NULL DEFAULT '''' CHECK (length(notes_internal) <= 2000),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  prepared_at timestamptz,
  closed_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT specials_batch_window CHECK (
    sales_start_at + interval ''5 minutes'' < sales_end_at
    AND pickup_start_at < pickup_end_at
    AND sales_end_at + interval ''15 minutes'' <= pickup_end_at
    AND (sales_start_at AT TIME ZONE ''Asia/Bangkok'')::date = business_date
    AND (sales_end_at AT TIME ZONE ''Asia/Bangkok'')::date = business_date
    AND (pickup_start_at AT TIME ZONE ''Asia/Bangkok'')::date = business_date
    AND (pickup_end_at AT TIME ZONE ''Asia/Bangkok'')::date = business_date
  )
);
CREATE UNIQUE INDEX specials_one_prepared_batch ON public.specials_batches ((true)) WHERE status = ''prepared'';
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
  event_type text NOT NULL CHECK (event_type IN (''batch_created'',''batch_updated'',''batch_prepared'',''batch_closed'',''batch_cancelled'',''item_created'',''item_updated'',''transfer_in'',''transfer_out'')),
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
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '''' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role::text = ''admin''
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
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '''' AS $$
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
  v_today date := (clock_timestamp() AT TIME ZONE ''Asia/Bangkok'')::date;
  v_now timestamptz;
BEGIN
  IF NOT specials_private.is_admin() THEN
    RAISE EXCEPTION ''Admin access required'' USING ERRCODE = ''42501'';
  END IF;
  IF p_operation_key IS NULL OR p_request IS NULL OR jsonb_typeof(p_request) <> ''object''
     OR p_action IS NULL OR p_action NOT IN (''save_batch'',''save_item'',''transfer'',''prepare'',''close'',''cancel'') THEN
    RAISE EXCEPTION ''Invalid Specials operation'' USING ERRCODE = ''22023'';
  END IF;
  -- Same operation key is serialized before checking the durable audit record.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_operation_key::text, 731));
  SELECT * INTO v_prior FROM public.specials_audit_events WHERE operation_key = p_operation_key;
  IF FOUND THEN
    IF v_prior.actor_id IS DISTINCT FROM v_actor
       OR v_prior.request_payload IS DISTINCT FROM jsonb_build_object(''action'',p_action,''request'',p_request) THEN
      RAISE EXCEPTION ''Operation key was already used for a different request'' USING ERRCODE = ''22023'';
    END IF;
    RETURN v_prior.result_payload;
  END IF;
  -- Shared lock order for all mutations: batch first, then item/product.
  IF nullif(p_request->>''batch_id'','''') IS NOT NULL THEN
    SELECT * INTO v_batch FROM public.specials_batches WHERE id = (p_request->>''batch_id'')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION ''Specials batch not found''; END IF;
    IF (p_request->>''expected_version'') IS NULL OR v_batch.version <> (p_request->>''expected_version'')::integer THEN
      RAISE EXCEPTION ''Batch changed. Refresh before trying again.'' USING ERRCODE = ''40001'';
    END IF;
  ELSIF p_action <> ''save_batch'' THEN
    RAISE EXCEPTION ''Batch is required'';
  END IF;
  v_now := clock_timestamp();
  v_today := (v_now AT TIME ZONE ''Asia/Bangkok'')::date;

  IF p_action = ''save_batch'' THEN
    IF v_batch.id IS NOT NULL AND v_batch.status <> ''draft'' THEN RAISE EXCEPTION ''Only a draft batch can be edited''; END IF;
    IF (p_request->>''business_date'')::date IS DISTINCT FROM v_today THEN RAISE EXCEPTION ''Specials must be prepared for today in Bangkok''; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.cms_pickup_locations WHERE id = (p_request->>''pickup_location_id'')::uuid AND is_active = true) THEN
      RAISE EXCEPTION ''Choose an active pickup location'';
    END IF;
    IF (p_request->>''sales_end_at'')::timestamptz <= v_now + interval ''5 minutes'' THEN RAISE EXCEPTION ''Allow a full 5-minute payment window before sales end''; END IF;
    IF v_batch.id IS NULL THEN
      INSERT INTO public.specials_batches(title,business_date,pickup_location_id,sales_start_at,sales_end_at,pickup_start_at,pickup_end_at,notes_internal,created_by)
      VALUES (btrim(p_request->>''title''),v_today,(p_request->>''pickup_location_id'')::uuid,(p_request->>''sales_start_at'')::timestamptz,(p_request->>''sales_end_at'')::timestamptz,(p_request->>''pickup_start_at'')::timestamptz,(p_request->>''pickup_end_at'')::timestamptz,coalesce(p_request->>''notes_internal'',''''),v_actor)
      RETURNING * INTO v_batch;
      v_event := ''batch_created'';
    ELSE
      UPDATE public.specials_batches SET title=btrim(p_request->>''title''),business_date=v_today,pickup_location_id=(p_request->>''pickup_location_id'')::uuid,
        sales_start_at=(p_request->>''sales_start_at'')::timestamptz,sales_end_at=(p_request->>''sales_end_at'')::timestamptz,
        pickup_start_at=(p_request->>''pickup_start_at'')::timestamptz,pickup_end_at=(p_request->>''pickup_end_at'')::timestamptz,
        notes_internal=coalesce(p_request->>''notes_internal'',''''),version=version+1,updated_at=v_now WHERE id=v_batch.id RETURNING * INTO v_batch;
      v_event := ''batch_updated'';
    END IF;
    v_reason := ''Same-day batch setup'';
  ELSIF p_action = ''save_item'' THEN
    IF v_batch.status <> ''draft'' OR v_batch.business_date <> v_today THEN RAISE EXCEPTION ''Products can only be edited in today''''s draft''; END IF;
    IF (p_request->>''made_by_joko_confirmed'')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION ''Confirm this product is made by JOKO''; END IF;
    SELECT * INTO v_product FROM public.cms_products WHERE id=(p_request->>''product_id'')::uuid FOR SHARE;
    IF NOT FOUND OR v_product.is_active IS DISTINCT FROM true THEN RAISE EXCEPTION ''Choose an active catalogue product''; END IF;
    IF nullif(p_request->>''item_id'','''') IS NOT NULL THEN
      SELECT * INTO v_item FROM public.specials_items WHERE id=(p_request->>''item_id'')::uuid AND batch_id=v_batch.id FOR UPDATE;
      IF NOT FOUND OR v_item.product_id <> v_product.id THEN RAISE EXCEPTION ''Offer not found or product changed''; END IF;
      IF v_item.version <> (p_request->>''item_version'')::integer OR (p_request->>''item_version'') IS NULL THEN RAISE EXCEPTION ''Offer changed. Refresh before trying again.'' USING ERRCODE=''40001''; END IF;
      UPDATE public.specials_items SET special_price_satang=(p_request->>''special_price_satang'')::integer,
        max_per_customer=nullif(p_request->>''max_per_customer'','''')::integer,is_enabled=coalesce((p_request->>''is_enabled'')::boolean,true),
        updated_at=v_now,version=version+1 WHERE id=v_item.id RETURNING * INTO v_item;
      v_event := ''item_updated'';
    ELSE
      INSERT INTO public.specials_items(batch_id,product_id,regular_price_satang,special_price_satang,max_per_customer,made_by_joko_confirmed_by)
      VALUES (v_batch.id,v_product.id,round(v_product.price*100)::integer,(p_request->>''special_price_satang'')::integer,nullif(p_request->>''max_per_customer'','''')::integer,v_actor)
      RETURNING * INTO v_item;
      v_event := ''item_created'';
    END IF;
    v_reason := ''Offer price and Made by JOKO attestation'';
  ELSIF p_action = ''transfer'' THEN
    SELECT * INTO v_item FROM public.specials_items WHERE id=(p_request->>''item_id'')::uuid AND batch_id=v_batch.id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION ''Offer not found''; END IF;
    v_qty := (p_request->>''quantity'')::integer;
    v_source := nullif(btrim(p_request->>''source_reference''),'''');
    v_reason := nullif(btrim(p_request->>''reason''),'''');
    IF v_qty IS NULL OR v_qty <= 0 OR v_source IS NULL OR v_reason IS NULL OR length(v_source)>500 OR length(v_reason)>1000 THEN RAISE EXCEPTION ''Positive quantity, source/destination and reason are required''; END IF;
    IF p_request->>''direction'' = ''in'' THEN
      IF v_batch.status NOT IN (''draft'',''prepared'') OR v_batch.business_date <> v_today OR v_now >= v_batch.sales_end_at THEN RAISE EXCEPTION ''Stock intake requires today''''s open preparation''; END IF;
      IF (p_request->>''physically_isolated'')::boolean IS DISTINCT FROM true OR (p_request->>''unallocated_and_good_quality'')::boolean IS DISTINCT FROM true THEN
        RAISE EXCEPTION ''Count, isolate and confirm unallocated good-quality stock before transfer'';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.cms_products WHERE id=v_item.product_id AND is_active=true) THEN RAISE EXCEPTION ''Product is inactive''; END IF;
      v_delta := v_qty;
      v_event := ''transfer_in'';
    ELSIF p_request->>''direction'' = ''out'' THEN
      IF v_qty > v_item.quantity_available THEN RAISE EXCEPTION ''Only available stock can be released''; END IF;
      v_delta := -v_qty;
      v_event := ''transfer_out'';
    ELSE RAISE EXCEPTION ''Transfer direction must be in or out''; END IF;
    UPDATE public.specials_items SET quantity_allocated=quantity_allocated+v_delta,quantity_available=quantity_available+v_delta,
      version=version+1,updated_at=v_now WHERE id=v_item.id RETURNING * INTO v_item;
    -- Never edit cms_products.stock_remaining or product_date_inventory here.
  ELSIF p_action = ''prepare'' THEN
    IF v_batch.status <> ''draft'' OR v_batch.business_date <> v_today THEN RAISE EXCEPTION ''Prepare today''''s draft only''; END IF;
    IF v_now < v_batch.sales_start_at OR v_now >= v_batch.sales_end_at - interval ''5 minutes'' THEN RAISE EXCEPTION ''Preparation must occur within the valid sales opportunity''; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.cms_pickup_locations WHERE id=v_batch.pickup_location_id AND is_active=true) THEN RAISE EXCEPTION ''Pickup location is inactive''; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.specials_items WHERE batch_id=v_batch.id AND is_enabled AND quantity_available>0) THEN RAISE EXCEPTION ''Transfer some stock before preparing''; END IF;
    IF EXISTS (SELECT 1 FROM public.specials_items i JOIN public.cms_products p ON p.id=i.product_id WHERE i.batch_id=v_batch.id AND i.is_enabled AND p.is_active IS DISTINCT FROM true) THEN RAISE EXCEPTION ''An enabled product is inactive''; END IF;
    UPDATE public.specials_batches SET status=''prepared'',prepared_at=v_now,updated_at=v_now,version=version+1 WHERE id=v_batch.id RETURNING * INTO v_batch;
    v_event := ''batch_prepared''; v_reason := ''Reviewed inventory and pickup preview; not published'';
  ELSE
    IF v_batch.status NOT IN (''draft'',''prepared'') THEN RAISE EXCEPTION ''Batch already closed or cancelled''; END IF;
    v_reason := nullif(btrim(p_request->>''reason''),'''');
    IF v_reason IS NULL OR length(v_reason)>1000 THEN RAISE EXCEPTION ''A closure reason is required''; END IF;
    UPDATE public.specials_batches SET status=CASE WHEN p_action=''close'' THEN ''closed'' ELSE ''cancelled'' END,closed_at=v_now,updated_at=v_now,version=version+1 WHERE id=v_batch.id RETURNING * INTO v_batch;
    v_event := CASE WHEN p_action=''close'' THEN ''batch_closed'' ELSE ''batch_cancelled'' END;
    -- Closure does not silently release physical stock. Transfer out explicitly.
  END IF;
  IF p_action IN (''save_item'',''transfer'') THEN
    UPDATE public.specials_batches SET version=version+1,updated_at=v_now WHERE id=v_batch.id RETURNING * INTO v_batch;
  END IF;
  v_result := jsonb_build_object(''batch'',to_jsonb(v_batch),''item'',CASE WHEN v_item.id IS NULL THEN NULL ELSE to_jsonb(v_item) END);
  INSERT INTO public.specials_audit_events(batch_id,item_id,operation_key,actor_id,event_type,quantity_delta,source_reference,reason,request_payload,result_payload)
  VALUES (v_batch.id,v_item.id,p_operation_key,v_actor,v_event,v_delta,v_source,v_reason,jsonb_build_object(''action'',p_action,''request'',p_request),v_result);
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION specials_private.admin_action(text,jsonb,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION specials_private.admin_action(text,jsonb,uuid) TO authenticated;

CREATE FUNCTION public.admin_specials_action_v1(p_action text,p_request jsonb,p_operation_key uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '''' AS $$
  SELECT specials_private.admin_action(p_action,p_request,p_operation_key);
$$;
REVOKE ALL ON FUNCTION public.admin_specials_action_v1(text,jsonb,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_specials_action_v1(text,jsonb,uuid) TO authenticated;
COMMENT ON FUNCTION public.admin_specials_action_v1(text,jsonb,uuid) IS ''Admin-only, atomic, idempotent Specials preparation. No publish/payment/send capability in phase 1.'';
COMMIT;
']);

-- 20261008110550_joko_specials_checkout_v1.sql

-- JOKO Specials: existing orders/payment rail, isolated stock, immutable checkout snapshots.
-- Apply only after the inventory foundation and payment rail migrations.
ALTER TABLE public.specials_batches DROP CONSTRAINT specials_batches_status_check;
ALTER TABLE public.specials_batches ADD CONSTRAINT specials_batches_status_check CHECK(status IN ('draft','prepared','live','closed','cancelled'));
DROP INDEX public.specials_one_prepared_batch;
CREATE UNIQUE INDEX specials_one_active_batch ON public.specials_batches((true)) WHERE status IN ('prepared','live');
ALTER TABLE public.orders ADD COLUMN order_type text NOT NULL DEFAULT 'regular' CHECK(order_type IN ('regular','specials'));
ALTER TABLE public.orders ADD COLUMN specials_batch_id uuid REFERENCES public.specials_batches(id) ON DELETE RESTRICT;
ALTER TABLE public.orders ADD COLUMN specials_pickup_snapshot jsonb;
ALTER TABLE public.orders ADD CONSTRAINT specials_order_link CHECK((order_type='specials')=(specials_batch_id IS NOT NULL) AND (order_type<>'specials' OR (specials_pickup_snapshot IS NOT NULL AND pickup_date_id IS NULL AND NOT inventory_reserved)));
CREATE INDEX specials_orders_batch_idx ON public.orders(specials_batch_id) WHERE order_type='specials';
CREATE TABLE specials_private.settings (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), enabled boolean NOT NULL DEFAULT false,
 qr_payload text NOT NULL DEFAULT '', receiver_bank_code text NOT NULL DEFAULT '', receiver_bank_number text NOT NULL DEFAULT '', receiver_label text NOT NULL DEFAULT '',
 updated_by uuid REFERENCES auth.users(id), updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO specials_private.settings(id) VALUES(true);
CREATE TABLE public.specials_checkouts (
 order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE RESTRICT,
 batch_id uuid NOT NULL REFERENCES public.specials_batches(id), customer_id uuid NOT NULL REFERENCES auth.users(id),
 operation_key uuid NOT NULL UNIQUE, request jsonb NOT NULL,
 inventory_state text NOT NULL CHECK(inventory_state IN ('held','verifying','committed','released')),
 financial_state text NOT NULL DEFAULT 'pending' CHECK(financial_state IN ('pending','verifying','verified','reconciliation_required','refund_pending','refunded')),
 fulfillment_state text NOT NULL DEFAULT 'awaiting_payment' CHECK(fulfillment_state IN ('awaiting_payment','ready','picked_up','no_show','cancelled')),
 payment_deadline timestamptz NOT NULL, verification_deadline timestamptz NOT NULL,
 active_attempt_id uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX specials_one_customer_hold ON public.specials_checkouts(customer_id,batch_id) WHERE inventory_state IN ('held','verifying');
CREATE INDEX specials_checkouts_expiry ON public.specials_checkouts(batch_id,payment_deadline) WHERE inventory_state IN ('held','verifying');
CREATE TABLE specials_private.checkout_snapshots (
 order_id uuid PRIMARY KEY REFERENCES public.specials_checkouts(order_id), settings jsonb NOT NULL
);
CREATE TABLE specials_private.hold_lines (
 order_id uuid REFERENCES public.specials_checkouts(order_id), item_id uuid REFERENCES public.specials_items(id), quantity integer NOT NULL CHECK(quantity>0), PRIMARY KEY(order_id,item_id)
);
CREATE TABLE specials_private.attempts (
 id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES public.specials_checkouts(order_id), storage_path text NOT NULL,
 registered_at timestamptz NOT NULL DEFAULT clock_timestamp(), completed_at timestamptz, evidence jsonb,
 result jsonb
);
CREATE TABLE specials_private.receipts (
 provider_ref text PRIMARY KEY, order_id uuid NOT NULL REFERENCES public.specials_checkouts(order_id),
 amount numeric(10,2) NOT NULL CHECK(amount>0), received_at timestamptz NOT NULL,
 disposition text NOT NULL CHECK(disposition IN ('credited','reconciliation_required','refund_pending','refunded')),
 refunded_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK(refunded_amount>=0 AND refunded_amount<=amount), refund_reference text, refund_reason text, refunded_by uuid REFERENCES auth.users(id)
);
CREATE TABLE public.specials_line_outbox (
 batch_id uuid PRIMARY KEY REFERENCES public.specials_batches(id), retry_key uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 message text NOT NULL, status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','accepted','failed','uncertain','suppressed')),
 first_attempt_at timestamptz, lease_until timestamptz, attempt_count integer NOT NULL DEFAULT 0, accepted_request_id text, last_error text,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE specials_private.staff_locations (
 user_id uuid REFERENCES auth.users(id), location_id uuid REFERENCES public.cms_pickup_locations(id), PRIMARY KEY(user_id,location_id)
);
ALTER TABLE public.specials_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specials_line_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.specials_checkouts,public.specials_line_outbox FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.specials_checkouts,public.specials_line_outbox TO authenticated,service_role;
CREATE POLICY specials_checkout_read ON public.specials_checkouts FOR SELECT TO authenticated USING(customer_id=auth.uid() OR specials_private.is_admin() OR EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND role::text='staff'));
CREATE POLICY specials_line_admin_read ON public.specials_line_outbox FOR SELECT TO authenticated USING(specials_private.is_admin());
REVOKE ALL ON ALL TABLES IN SCHEMA specials_private FROM PUBLIC,anon,authenticated,service_role;

-- One batch lock serializes every stock/payment lifecycle mutation. Network calls never hold it.
CREATE FUNCTION specials_private.release_hold(p_order uuid,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.specials_checkouts%ROWTYPE; l record;
BEGIN
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order FOR UPDATE;
 IF c.inventory_state NOT IN ('held','verifying') THEN RETURN; END IF;
 FOR l IN SELECT * FROM specials_private.hold_lines WHERE order_id=p_order ORDER BY item_id LOOP
  UPDATE public.specials_items SET quantity_held=quantity_held-l.quantity,quantity_available=quantity_available+l.quantity,version=version+1,updated_at=clock_timestamp() WHERE id=l.item_id;
 END LOOP;
 UPDATE public.specials_checkouts SET inventory_state='released',financial_state=CASE WHEN financial_state IN ('pending','verifying') THEN 'pending' ELSE financial_state END,fulfillment_state='cancelled',updated_at=clock_timestamp() WHERE order_id=p_order;
 UPDATE public.orders SET status='cancelled',inventory_reserved=false WHERE id=p_order AND payment_status='unpaid';
 UPDATE public.payment_transactions SET status=CASE WHEN p_reason='cancelled' THEN 'cancelled' ELSE 'expired' END,last_error_code=p_reason,updated_at=clock_timestamp() WHERE order_id=p_order AND status<>'verified';
END $$;
CREATE FUNCTION specials_private.reap_batch(p_batch uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c record; b public.specials_batches%ROWTYPE; t timestamptz;
BEGIN
 SELECT * INTO b FROM public.specials_batches WHERE id=p_batch FOR UPDATE;
 t:=clock_timestamp();
 FOR c IN SELECT * FROM public.specials_checkouts WHERE batch_id=p_batch AND inventory_state IN ('held','verifying') ORDER BY order_id FOR UPDATE LOOP
  IF (c.inventory_state='held' AND t>=c.payment_deadline) OR (c.inventory_state='verifying' AND t>=c.verification_deadline) THEN PERFORM specials_private.release_hold(c.order_id,'expired'); END IF;
 END LOOP;
 IF b.status IN ('prepared','live') AND t>=b.sales_end_at THEN UPDATE public.specials_batches SET status='closed',closed_at=t,version=version+1 WHERE id=p_batch; END IF;
 IF t>=b.pickup_end_at THEN UPDATE public.specials_checkouts SET fulfillment_state='no_show',updated_at=t WHERE batch_id=p_batch AND inventory_state='committed' AND fulfillment_state='ready'; END IF;
 UPDATE public.specials_line_outbox SET status='suppressed',last_error='Sale no longer eligible',updated_at=t WHERE batch_id=p_batch AND status IN ('queued','failed') AND (b.status<>'live' OR t>=b.sales_end_at-interval '5 minutes');
END $$;
CREATE FUNCTION specials_private.checkout(p_batch uuid,p_cart jsonb,p_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.specials_batches%ROWTYPE; u public.user_profiles%ROWTYPE; s specials_private.settings%ROWTYPE; c public.specials_checkouts%ROWTYPE; i public.specials_items%ROWTYPE; row record; pr public.cms_products%ROWTYPE; loc public.cms_pickup_locations%ROWTYPE; oid uuid:=gen_random_uuid(); total integer:=0; items jsonb:='[]'; t timestamptz; used integer;
BEGIN
 IF auth.uid() IS NULL OR p_key IS NULL THEN RAISE EXCEPTION 'Sign in and provide an operation key'; END IF;
 IF p_cart IS NULL OR jsonb_typeof(p_cart)<>'array' OR jsonb_array_length(p_cart)=0 OR jsonb_array_length(p_cart)>50 THEN RAISE EXCEPTION 'Invalid cart'; END IF;
 SELECT * INTO b FROM public.specials_batches WHERE id=p_batch FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Specials unavailable'; END IF;
 PERFORM specials_private.reap_batch(p_batch);
 SELECT * INTO c FROM public.specials_checkouts WHERE operation_key=p_key;
 IF FOUND THEN
  IF c.customer_id<>auth.uid() OR c.batch_id<>p_batch OR c.request<>p_cart THEN RAISE EXCEPTION 'Operation key belongs to a different request'; END IF;
  RETURN jsonb_build_object('order_id',c.order_id);
 END IF;
 t:=clock_timestamp();
 SELECT * INTO s FROM specials_private.settings WHERE id;
 IF NOT s.enabled OR b.status<>'live' OR t<b.sales_start_at OR t>=b.sales_end_at-interval '5 minutes' OR b.business_date<>(t AT TIME ZONE 'Asia/Bangkok')::date THEN RAISE EXCEPTION 'Checkout is closed'; END IF;
 SELECT * INTO u FROM public.user_profiles WHERE id=auth.uid();
 IF NOT FOUND OR NOT coalesce(u.profile_completed,false) OR nullif(trim(u.name),'') IS NULL OR nullif(trim(u.phone),'') IS NULL THEN RAISE EXCEPTION 'Complete your name and phone in your profile first'; END IF;
 IF EXISTS(SELECT 1 FROM public.specials_checkouts WHERE customer_id=auth.uid() AND batch_id=p_batch AND inventory_state IN ('held','verifying')) THEN RAISE EXCEPTION 'Resume or cancel your existing checkout first'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_cart) x GROUP BY x->>'item_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate cart item'; END IF;
 SELECT * INTO loc FROM public.cms_pickup_locations WHERE id=b.pickup_location_id AND is_active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pickup location unavailable'; END IF;
 FOR row IN SELECT value FROM jsonb_array_elements(p_cart) ORDER BY value->>'item_id' LOOP
  IF coalesce(row.value->>'quantity','') !~ '^[1-9][0-9]{0,3}$' THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  SELECT * INTO i FROM public.specials_items WHERE id=(row.value->>'item_id')::uuid AND batch_id=p_batch FOR UPDATE;
  IF NOT FOUND OR NOT i.is_enabled OR i.quantity_available<(row.value->>'quantity')::int THEN RAISE EXCEPTION 'Specials item sold out'; END IF;
  SELECT * INTO pr FROM public.cms_products WHERE id=i.product_id AND is_active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product unavailable'; END IF;
  SELECT coalesce(sum(h.quantity),0) INTO used FROM specials_private.hold_lines h JOIN public.specials_checkouts x ON x.order_id=h.order_id WHERE h.item_id=i.id AND x.customer_id=auth.uid() AND x.inventory_state IN ('held','verifying','committed');
  IF i.max_per_customer IS NOT NULL AND used+(row.value->>'quantity')::int>i.max_per_customer THEN RAISE EXCEPTION 'Customer quantity limit exceeded'; END IF;
  total:=total+i.special_price_satang*(row.value->>'quantity')::int;
  items:=items||jsonb_build_array(jsonb_build_object('product_id',pr.id,'product_name',pr.name_en,'product_name_th',pr.name_th,'product_name_zh',pr.name_zh,'quantity',(row.value->>'quantity')::int,'price_at_order',i.special_price_satang/100.0));
 END LOOP;
 t:=clock_timestamp();
 IF t>=b.sales_end_at-interval '5 minutes' OR b.business_date<>(t AT TIME ZONE 'Asia/Bangkok')::date THEN RAISE EXCEPTION 'Checkout is closed'; END IF;
 INSERT INTO public.orders(id,customer_id,order_number,order_items,total_amount,pickup_location_id,pickup_date,status,payment_status,customer_name,customer_phone,customer_email,line_id,purchase_type,order_type,specials_batch_id,specials_pickup_snapshot,inventory_reserved,loyalty_points_earned,loyalty_multiplier)
 VALUES(oid,auth.uid(),'JT-'||nextval('public.online_order_number_seq'),items,total/100.0,b.pickup_location_id,b.business_date,'pending','unpaid',u.name,u.phone,u.email,u.line_id,'online','specials',b.id,jsonb_build_object('name_en',loc.name_en,'name_th',loc.name_th,'name_zh',loc.name_zh,'maps_url',loc.maps_url,'start_at',b.pickup_start_at,'end_at',b.pickup_end_at),false,0,0);
 INSERT INTO public.specials_checkouts(order_id,batch_id,customer_id,operation_key,request,inventory_state,payment_deadline,verification_deadline) VALUES(oid,b.id,auth.uid(),p_key,p_cart,'held',t+interval '5 minutes',t+interval '7 minutes');
 INSERT INTO specials_private.checkout_snapshots VALUES(oid,to_jsonb(s));
 INSERT INTO public.payment_transactions(order_id,customer_id,amount_due,status,expires_at) VALUES(oid,auth.uid(),total/100.0,'pending',t+interval '5 minutes');
 FOR row IN SELECT value FROM jsonb_array_elements(p_cart) LOOP
  INSERT INTO specials_private.hold_lines VALUES(oid,(row.value->>'item_id')::uuid,(row.value->>'quantity')::int);
  UPDATE public.specials_items SET quantity_available=quantity_available-(row.value->>'quantity')::int,quantity_held=quantity_held+(row.value->>'quantity')::int,version=version+1,updated_at=t WHERE id=(row.value->>'item_id')::uuid;
 END LOOP;
 RETURN jsonb_build_object('order_id',oid);
END $$;
CREATE FUNCTION specials_private.customer_state(p_order uuid,p_cancel boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.specials_checkouts%ROWTYPE; o public.orders%ROWTYPE; snap jsonb;
BEGIN
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order AND customer_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Checkout not found'; END IF;
 PERFORM specials_private.reap_batch(c.batch_id);
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order FOR UPDATE;
 IF p_cancel THEN
  IF c.inventory_state='verifying' THEN RAISE EXCEPTION 'Verification in progress; wait for the result'; END IF;
  IF c.inventory_state='committed' THEN RAISE EXCEPTION 'Paid orders require Admin assistance'; END IF;
  PERFORM specials_private.release_hold(p_order,'cancelled');
  SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order;
 END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order;
 SELECT settings INTO snap FROM specials_private.checkout_snapshots WHERE order_id=p_order;
 RETURN jsonb_build_object('checkout',to_jsonb(c),'order',jsonb_build_object('id',o.id,'order_number',o.order_number,'order_items',o.order_items,'total_amount',o.total_amount,'payment_status',o.payment_status,'status',o.status,'pickup',o.specials_pickup_snapshot),'qr_payload',CASE WHEN c.inventory_state='held' THEN snap->>'qr_payload' ELSE NULL END,'receiver_label',snap->>'receiver_label','server_now',clock_timestamp());
END $$;
-- Register only after a full image upload, before the provider call. Service role only.
CREATE FUNCTION specials_private.begin_verification(p_order uuid,p_customer uuid,p_attempt uuid,p_path text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.specials_checkouts%ROWTYPE; snap jsonb; o public.orders%ROWTYPE; a specials_private.attempts%ROWTYPE;
BEGIN
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order AND customer_id=p_customer;
 IF NOT FOUND THEN RAISE EXCEPTION 'Checkout not found'; END IF;
 PERFORM specials_private.reap_batch(c.batch_id);
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order FOR UPDATE;
 SELECT * INTO a FROM specials_private.attempts WHERE id=p_attempt;
 IF FOUND THEN RAISE EXCEPTION 'Upload was already submitted; refresh checkout status'; END IF;
 IF (SELECT count(*) FROM specials_private.attempts WHERE order_id=p_order)>=6 THEN RAISE EXCEPTION 'Slip submission limit reached; contact Admin'; END IF;
 IF c.inventory_state NOT IN ('held','released') OR (c.inventory_state='held' AND clock_timestamp()>=c.payment_deadline) THEN RAISE EXCEPTION 'Cannot submit another slip during verification or after payment'; END IF;
 IF c.inventory_state='held' THEN
  UPDATE public.specials_checkouts SET inventory_state='verifying',financial_state='verifying',active_attempt_id=p_attempt,updated_at=clock_timestamp() WHERE order_id=p_order;
  UPDATE public.payment_transactions SET status='verifying',updated_at=clock_timestamp() WHERE order_id=p_order;
 END IF;
 INSERT INTO specials_private.attempts(id,order_id,storage_path) VALUES(p_attempt,p_order,p_path);
 SELECT settings INTO snap FROM specials_private.checkout_snapshots WHERE order_id=p_order;
 SELECT * INTO o FROM public.orders WHERE id=p_order;
 RETURN jsonb_build_object('amount',o.total_amount,'order_number',o.order_number,'receiver_bank_code',snap->>'receiver_bank_code','receiver_bank_number',snap->>'receiver_bank_number');
END $$;
CREATE FUNCTION specials_private.finish_verification(p_attempt uuid,p_evidence jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a specials_private.attempts%ROWTYPE; c public.specials_checkouts%ROWTYPE; o public.orders%ROWTYPE; b public.specials_batches%ROWTYPE; r specials_private.receipts%ROWTYPE; snap jsonb; l record; ref text; amount numeric; paid_at timestamptz; good boolean; v_result jsonb;
BEGIN
 SELECT * INTO a FROM specials_private.attempts WHERE id=p_attempt;
 IF NOT FOUND THEN RAISE EXCEPTION 'Attempt not found'; END IF;
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=a.order_id;
 SELECT * INTO b FROM public.specials_batches WHERE id=c.batch_id FOR UPDATE;
 PERFORM specials_private.reap_batch(c.batch_id);
 SELECT * INTO a FROM specials_private.attempts WHERE id=p_attempt FOR UPDATE;
 IF a.result IS NOT NULL THEN RETURN a.result; END IF;
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=a.order_id FOR UPDATE;
 SELECT * INTO o FROM public.orders WHERE id=c.order_id FOR UPDATE;
 SELECT settings INTO snap FROM specials_private.checkout_snapshots WHERE order_id=c.order_id;
 ref:=nullif(trim(p_evidence->>'reference'),''); amount:=(p_evidence->>'amount')::numeric; paid_at:=(p_evidence->>'paid_at')::timestamptz;
 IF coalesce((p_evidence->>'provider_success')::boolean,false) AND ref IS NOT NULL AND amount>0 AND paid_at IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('easyslip:'||ref,811));
  SELECT * INTO r FROM specials_private.receipts WHERE provider_ref=ref;
  IF FOUND OR EXISTS(SELECT 1 FROM public.payment_transactions WHERE provider='easyslip' AND provider_transaction_ref=ref) THEN
   v_result:=jsonb_build_object('state','duplicate','message','This transfer has already been recorded. Contact Admin if needed.');
  ELSE
   good:=coalesce(coalesce((p_evidence->>'account_matched')::boolean,false) AND p_evidence->>'bank_code'=snap->>'receiver_bank_code' AND regexp_replace(coalesce(p_evidence->>'bank_number',''),'[^0-9]','','g')=regexp_replace(snap->>'receiver_bank_number','[^0-9]','','g'),false);
   -- Wrong recipients are evidence only; they are not JOKO money or refundable receipts.
   IF NOT good THEN v_result:=jsonb_build_object('state','rejected','message','Receiver does not match JOKO. Contact Admin before paying again.');
   ELSE
    good:=amount=o.total_amount AND NOT coalesce((p_evidence->>'duplicate')::boolean,true) AND c.inventory_state='verifying' AND c.active_attempt_id=p_attempt AND a.registered_at<c.payment_deadline AND clock_timestamp()<c.verification_deadline AND paid_at>=c.created_at AND paid_at<=c.payment_deadline AND b.status<>'cancelled';
    INSERT INTO specials_private.receipts(provider_ref,order_id,amount,received_at,disposition) VALUES(ref,c.order_id,amount,paid_at,CASE WHEN good THEN 'credited' ELSE 'reconciliation_required' END);
    IF good THEN
     FOR l IN SELECT * FROM specials_private.hold_lines WHERE order_id=c.order_id ORDER BY item_id LOOP
      UPDATE public.specials_items SET quantity_held=quantity_held-l.quantity,quantity_committed=quantity_committed+l.quantity,version=version+1,updated_at=clock_timestamp() WHERE id=l.item_id;
     END LOOP;
     UPDATE public.specials_checkouts SET inventory_state='committed',financial_state='verified',fulfillment_state='ready',updated_at=clock_timestamp() WHERE order_id=c.order_id;
     UPDATE public.orders SET payment_status='paid',payment_method='promptpay_online',amount_paid=total_amount,status='confirmed',loyalty_points_earned=0,loyalty_multiplier=0 WHERE id=c.order_id;
     UPDATE public.payment_transactions SET status='verified',provider_transaction_ref=ref,verified_at=clock_timestamp(),updated_at=clock_timestamp() WHERE order_id=c.order_id;
     INSERT INTO public.order_notification_events(order_id,notification_type,status) VALUES(c.order_id,'payment_confirmation','pending'),(c.order_id,'admin_new_order','pending') ON CONFLICT DO NOTHING;
     v_result:=jsonb_build_object('state','verified');
    ELSE
     PERFORM specials_private.release_hold(c.order_id,'reconciliation_required');
     UPDATE public.specials_checkouts SET financial_state='reconciliation_required',updated_at=clock_timestamp() WHERE order_id=c.order_id;
     v_result:=jsonb_build_object('state','reconciliation_required','message','Payment needs Admin reconciliation. Stock has not been reacquired. Do not pay again.');
    END IF;
   END IF;
  END IF;
 ELSE v_result:=jsonb_build_object('state','provider_error','message','Verification could not confirm this transfer. Refresh or contact Admin.');
 END IF;
 -- A rejected v_result never extends the original deadlines.
 IF c.inventory_state='verifying' AND c.active_attempt_id=p_attempt AND v_result->>'state' IN ('rejected','duplicate','provider_error') THEN
  IF clock_timestamp()<c.payment_deadline THEN
   UPDATE public.specials_checkouts SET inventory_state='held',financial_state='pending',active_attempt_id=NULL,updated_at=clock_timestamp() WHERE order_id=c.order_id;
   UPDATE public.payment_transactions SET status='pending' WHERE order_id=c.order_id;
  ELSE PERFORM specials_private.release_hold(c.order_id,'expired'); END IF;
 END IF;
 UPDATE specials_private.attempts SET evidence=p_evidence,completed_at=clock_timestamp(),result=v_result WHERE id=p_attempt;
 RETURN v_result;
END $$;
CREATE FUNCTION specials_private.pickup(p_order uuid,p_location uuid) RETURNS SETOF public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.specials_checkouts%ROWTYPE; b public.specials_batches%ROWTYPE; o public.orders%ROWTYPE;
BEGIN
 IF NOT specials_private.is_admin() AND NOT EXISTS(SELECT 1 FROM public.user_profiles u JOIN specials_private.staff_locations s ON s.user_id=u.id WHERE u.id=auth.uid() AND u.role::text='staff' AND s.location_id=p_location) THEN RAISE EXCEPTION 'Not authorized for this pickup location'; END IF;
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order;
 IF NOT FOUND THEN RAISE EXCEPTION 'Specials order not found'; END IF;
 SELECT * INTO b FROM public.specials_batches WHERE id=c.batch_id FOR UPDATE;
 PERFORM specials_private.reap_batch(b.id);
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order FOR UPDATE;
 SELECT * INTO o FROM public.orders WHERE id=p_order FOR UPDATE;
 IF o.pickup_location_id IS DISTINCT FROM p_location THEN RAISE EXCEPTION 'Wrong pickup location'; END IF;
 IF c.fulfillment_state='picked_up' THEN RETURN NEXT o; RETURN; END IF;
 IF c.inventory_state<>'committed' OR c.financial_state<>'verified' OR c.fulfillment_state<>'ready' OR o.payment_status<>'paid' OR o.amount_paid<>o.total_amount THEN RAISE EXCEPTION 'Payment is not complete or order is not eligible'; END IF;
 IF clock_timestamp()<(o.specials_pickup_snapshot->>'start_at')::timestamptz OR clock_timestamp()>=(o.specials_pickup_snapshot->>'end_at')::timestamptz OR b.business_date<>(clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date THEN RAISE EXCEPTION 'Outside same-day pickup window'; END IF;
 UPDATE public.specials_checkouts SET fulfillment_state='picked_up',updated_at=clock_timestamp() WHERE order_id=p_order;
 UPDATE public.orders SET status='picked_up',picked_up_at=clock_timestamp(),loyalty_points_earned=0 WHERE id=p_order RETURNING * INTO o;
 RETURN NEXT o;
END $$;
CREATE FUNCTION specials_private.catalog() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT jsonb_build_object('batch',jsonb_build_object('id',b.id,'title',b.title,'pickup_start_at',b.pickup_start_at,'pickup_end_at',b.pickup_end_at,'sales_end_at',b.sales_end_at,'location',jsonb_build_object('name_en',l.name_en,'name_th',l.name_th,'maps_url',l.maps_url)), 'items',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name_en',p.name_en,'name_th',p.name_th,'image',p.image,'price_satang',i.special_price_satang,'regular_price_satang',i.regular_price_satang,'available',i.quantity_available,'max_per_customer',i.max_per_customer) ORDER BY i.created_at),'[]'::jsonb) FROM public.specials_items i JOIN public.cms_products p ON p.id=i.product_id WHERE i.batch_id=b.id AND i.is_enabled AND p.is_active)) FROM public.specials_batches b JOIN public.cms_pickup_locations l ON l.id=b.pickup_location_id JOIN specials_private.settings s ON s.id WHERE b.status='live' AND s.enabled AND l.is_active AND clock_timestamp()>=b.sales_start_at AND clock_timestamp()<b.sales_end_at-interval '5 minutes' AND b.business_date=(clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date LIMIT 1),'{}'::jsonb);
$$;
-- Extend the existing admin dispatcher while preserving its audited retry contract.
ALTER FUNCTION specials_private.admin_action(text,jsonb,uuid) RENAME TO preparation_action;
DO $patch$
DECLARE definition text;
BEGIN
 definition:=pg_get_functiondef('specials_private.preparation_action(text,jsonb,uuid)'::regprocedure);
 IF position('NOT IN (''draft'',''prepared'')' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected preparation contract'; END IF;
 definition:=replace(definition,'NOT IN (''draft'',''prepared'')','NOT IN (''draft'',''prepared'',''live'')');
 EXECUTE definition;
END $patch$;
CREATE FUNCTION specials_private.admin_action(p_action text,p_request jsonb,p_operation_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.specials_batches%ROWTYPE; s specials_private.settings%ROWTYPE; r specials_private.receipts%ROWTYPE; outbox public.specials_line_outbox%ROWTYPE; t timestamptz; loc public.cms_pickup_locations%ROWTYPE; msg text;
BEGIN
 IF NOT specials_private.is_admin() THEN RAISE EXCEPTION 'Admin required'; END IF;
 IF p_action IN ('save_batch','save_item','transfer','prepare','close','cancel') THEN
  IF p_action='cancel' AND EXISTS(SELECT 1 FROM public.specials_checkouts WHERE batch_id=(p_request->>'batch_id')::uuid AND inventory_state='committed' AND financial_state<>'refunded' AND fulfillment_state<>'picked_up') THEN RAISE EXCEPTION 'Resolve paid orders before emergency cancellation'; END IF;
  RETURN specials_private.preparation_action(p_action,p_request,p_operation_key);
 END IF;
 IF p_action='settings' THEN
  IF coalesce((p_request->>'enabled')::boolean,false) AND (length(coalesce(p_request->>'qr_payload','')) NOT BETWEEN 30 AND 2048 OR coalesce(p_request->>'receiver_bank_code','')='' OR length(regexp_replace(coalesce(p_request->>'receiver_bank_number',''),'[^0-9]','','g'))<6 OR coalesce(p_request->>'receiver_label','')='') THEN RAISE EXCEPTION 'Approved merchant QR and exact registered receiver required'; END IF;
  UPDATE specials_private.settings SET enabled=coalesce((p_request->>'enabled')::boolean,false),qr_payload=coalesce(p_request->>'qr_payload',''),receiver_bank_code=upper(trim(coalesce(p_request->>'receiver_bank_code',''))),receiver_bank_number=coalesce(p_request->>'receiver_bank_number',''),receiver_label=coalesce(p_request->>'receiver_label',''),updated_by=auth.uid(),updated_at=clock_timestamp() WHERE id RETURNING * INTO s;
  RETURN jsonb_build_object('settings',to_jsonb(s));
 END IF;
 IF p_action='staff_location' THEN
  IF NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=(p_request->>'user_id')::uuid AND role::text='staff') OR NOT EXISTS(SELECT 1 FROM public.cms_pickup_locations WHERE id=(p_request->>'location_id')::uuid AND is_active) THEN RAISE EXCEPTION 'Active location and staff user required'; END IF;
  IF coalesce((p_request->>'enabled')::boolean,false) THEN INSERT INTO specials_private.staff_locations VALUES((p_request->>'user_id')::uuid,(p_request->>'location_id')::uuid) ON CONFLICT DO NOTHING;
  ELSE DELETE FROM specials_private.staff_locations WHERE user_id=(p_request->>'user_id')::uuid AND location_id=(p_request->>'location_id')::uuid; END IF;
  RETURN jsonb_build_object('saved',true);
 END IF;
 SELECT * INTO b FROM public.specials_batches WHERE id=(p_request->>'batch_id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Batch not found'; END IF;
 t:=clock_timestamp();
 IF p_action='publish' THEN
  IF b.status='live' THEN RETURN jsonb_build_object('batch',to_jsonb(b)); END IF;
  IF b.version IS DISTINCT FROM (p_request->>'expected_version')::integer THEN RAISE EXCEPTION 'Batch changed; refresh'; END IF;
  IF b.status<>'prepared' OR b.business_date<>(t AT TIME ZONE 'Asia/Bangkok')::date OR t<b.sales_start_at OR t>=b.sales_end_at-interval '5 minutes' OR NOT EXISTS(SELECT 1 FROM specials_private.settings WHERE id AND enabled) OR NOT EXISTS(SELECT 1 FROM public.specials_items i JOIN public.cms_products p ON p.id=i.product_id WHERE i.batch_id=b.id AND i.is_enabled AND i.quantity_available>0 AND p.is_active) OR NOT EXISTS(SELECT 1 FROM public.cms_pickup_locations WHERE id=b.pickup_location_id AND is_active) THEN RAISE EXCEPTION 'Publication requires enabled payment, prepared stock and an open sales window'; END IF;
  UPDATE public.specials_batches SET status='live',version=version+1,updated_at=t WHERE id=b.id RETURNING * INTO b;
  RETURN jsonb_build_object('batch',to_jsonb(b));
 ELSIF p_action='queue_line' THEN
  IF b.status<>'live' OR t>=b.sales_end_at-interval '5 minutes' OR NOT EXISTS(SELECT 1 FROM public.specials_items WHERE batch_id=b.id AND is_enabled AND quantity_available>0) THEN RAISE EXCEPTION 'Sale is not eligible for announcement'; END IF;
  SELECT * INTO loc FROM public.cms_pickup_locations WHERE id=b.pickup_location_id;
  msg:='JOKO Specials — '||b.title||E'\nขนม JOKO ราคาพิเศษ รับวันนี้เท่านั้น / Same-day pickup only\n'||loc.name_en||' / '||loc.name_th||E'\n'||to_char(b.pickup_start_at AT TIME ZONE 'Asia/Bangkok','DD Mon HH24:MI')||'–'||to_char(b.pickup_end_at AT TIME ZONE 'Asia/Bangkok','HH24:MI')||E' (Bangkok)\nLimited stock / มีจำนวนจำกัด\nhttps://joko.today/specials';
  INSERT INTO public.specials_line_outbox(batch_id,message) VALUES(b.id,msg) ON CONFLICT(batch_id) DO NOTHING;
  SELECT * INTO outbox FROM public.specials_line_outbox WHERE batch_id=b.id;
  RETURN jsonb_build_object('batch',to_jsonb(b),'announcement',to_jsonb(outbox));
 ELSIF p_action='refund_pending' THEN
  SELECT * INTO r FROM specials_private.receipts WHERE provider_ref=p_request->>'reference' AND order_id IN (SELECT order_id FROM public.specials_checkouts WHERE batch_id=b.id) FOR UPDATE;
  IF NOT FOUND OR nullif(trim(p_request->>'reason'),'') IS NULL OR r.disposition='refunded' OR EXISTS(SELECT 1 FROM public.specials_checkouts WHERE order_id=r.order_id AND fulfillment_state='picked_up') THEN RAISE EXCEPTION 'Unrefunded receipt, reason and uncollected order required'; END IF;
  UPDATE specials_private.receipts SET disposition='refund_pending',refund_reason=p_request->>'reason' WHERE provider_ref=r.provider_ref;
  UPDATE public.specials_checkouts SET financial_state='refund_pending',fulfillment_state='cancelled',updated_at=t WHERE order_id=r.order_id;
  UPDATE public.orders SET status='cancelled' WHERE id=r.order_id;
  RETURN jsonb_build_object('batch',to_jsonb(b));
 ELSIF p_action='refund' THEN
  SELECT * INTO r FROM specials_private.receipts WHERE provider_ref=p_request->>'reference' AND order_id IN (SELECT order_id FROM public.specials_checkouts WHERE batch_id=b.id) FOR UPDATE;
  IF NOT FOUND OR nullif(trim(p_request->>'reason'),'') IS NULL OR nullif(trim(p_request->>'refund_reference'),'') IS NULL OR (p_request->>'amount')::numeric<>r.amount THEN RAISE EXCEPTION 'Full actual refund amount, bank reference and reason required'; END IF;
  IF r.disposition='refunded' THEN
   IF r.refund_reference<>p_request->>'refund_reference' THEN RAISE EXCEPTION 'Refund already recorded'; END IF;
  ELSE
   IF EXISTS(SELECT 1 FROM public.specials_checkouts WHERE order_id=r.order_id AND fulfillment_state='picked_up') THEN RAISE EXCEPTION 'Picked-up orders need separate financial review'; END IF;
   UPDATE specials_private.receipts SET disposition='refunded',refunded_amount=amount,refund_reference=p_request->>'refund_reference',refund_reason=p_request->>'reason',refunded_by=auth.uid() WHERE provider_ref=r.provider_ref;
   -- Refund does not restock committed goods; Admin handles physical leftovers separately.
   UPDATE public.specials_checkouts SET financial_state=CASE WHEN EXISTS(SELECT 1 FROM specials_private.receipts remaining WHERE remaining.order_id=r.order_id AND remaining.disposition<>'refunded') THEN 'refund_pending' ELSE 'refunded' END,fulfillment_state='cancelled',updated_at=t WHERE order_id=r.order_id;
   UPDATE public.orders SET status='cancelled' WHERE id=r.order_id;
  END IF;
  RETURN jsonb_build_object('batch',to_jsonb(b));
 END IF;
 RAISE EXCEPTION 'Invalid Specials action';
END $$;
-- SQL wrappers resolve functions at execution time; replace to bind renamed dispatcher.
CREATE OR REPLACE FUNCTION public.admin_specials_action_v1(p_action text,p_request jsonb,p_operation_key uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT specials_private.admin_action(p_action,p_request,p_operation_key) $$;
CREATE FUNCTION specials_private.admin_details() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT specials_private.is_admin() THEN RAISE EXCEPTION 'Admin required'; END IF;
 RETURN jsonb_build_object('settings',(SELECT to_jsonb(s) FROM specials_private.settings s WHERE id),'staff_locations',(SELECT coalesce(jsonb_agg(to_jsonb(s)),'[]') FROM specials_private.staff_locations s),'receipts',(SELECT coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('batch_id',c.batch_id)),'[]') FROM specials_private.receipts r JOIN public.specials_checkouts c ON c.order_id=r.order_id));
END $$;
CREATE FUNCTION specials_private.line_action(p_action text,p_batch uuid,p_result jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.specials_batches%ROWTYPE; x public.specials_line_outbox%ROWTYPE; t timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO b FROM public.specials_batches WHERE id=p_batch FOR UPDATE;
 SELECT * INTO x FROM public.specials_line_outbox WHERE batch_id=p_batch FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Announcement not prepared'; END IF;
 IF p_action='claim' THEN
  IF x.status IN ('accepted','suppressed') THEN RETURN jsonb_build_object('send',false,'status',x.status); END IF;
  IF x.status='sending' AND x.lease_until>t THEN RETURN jsonb_build_object('send',false,'status','sending'); END IF;
  IF x.first_attempt_at IS NOT NULL AND t>=x.first_attempt_at+interval '23 hours' THEN
   UPDATE public.specials_line_outbox SET status='uncertain',last_error='Retry window exhausted; do not create another campaign',lease_until=NULL WHERE batch_id=p_batch;
   RETURN jsonb_build_object('send',false,'status','uncertain');
  END IF;
  IF b.status<>'live' OR t>=b.sales_end_at-interval '5 minutes' OR NOT EXISTS(SELECT 1 FROM public.specials_items WHERE batch_id=p_batch AND is_enabled AND quantity_available>0) THEN
   UPDATE public.specials_line_outbox SET status=CASE WHEN first_attempt_at IS NULL THEN 'suppressed' ELSE 'uncertain' END,last_error='Sale closed or sold out; sending suppressed',lease_until=NULL WHERE batch_id=p_batch;
   RETURN jsonb_build_object('send',false,'status','suppressed');
  END IF;
  UPDATE public.specials_line_outbox SET status='sending',first_attempt_at=coalesce(first_attempt_at,t),lease_until=t+interval '2 minutes',attempt_count=attempt_count+1,updated_at=t WHERE batch_id=p_batch RETURNING * INTO x;
  RETURN jsonb_build_object('send',true,'retry_key',x.retry_key,'message',x.message);
 ELSIF p_action='finish' THEN
  IF x.status='accepted' THEN RETURN to_jsonb(x); END IF;
  UPDATE public.specials_line_outbox SET status=CASE WHEN p_result->>'status'='accepted' THEN 'accepted' WHEN p_result->>'status'='failed' THEN 'failed' ELSE 'uncertain' END,accepted_request_id=p_result->>'request_id',last_error=left(p_result->>'error',500),lease_until=NULL,updated_at=t WHERE batch_id=p_batch RETURNING * INTO x;
  RETURN to_jsonb(x);
 END IF;
 RAISE EXCEPTION 'Invalid announcement action';
END $$;
CREATE FUNCTION specials_private.sweep() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b record; n integer:=0;
BEGIN
 FOR b IN SELECT batch.id FROM public.specials_batches batch WHERE batch.status IN ('prepared','live') OR EXISTS(SELECT 1 FROM public.specials_checkouts c WHERE c.batch_id=batch.id AND (c.inventory_state IN ('held','verifying') OR c.fulfillment_state='ready')) ORDER BY batch.id LOOP PERFORM specials_private.reap_batch(b.id); n:=n+1; END LOOP;
 RETURN n;
END $$;
-- Public API surface. Private service functions are inaccessible to browser roles.
CREATE FUNCTION public.specials_catalog_v1() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT specials_private.catalog() $$;
CREATE FUNCTION public.specials_checkout_v1(p_batch uuid,p_cart jsonb,p_key uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT specials_private.checkout(p_batch,p_cart,p_key) $$;
CREATE FUNCTION public.specials_customer_state_v1(p_order uuid,p_cancel boolean DEFAULT false) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT specials_private.customer_state(p_order,p_cancel) $$;
CREATE FUNCTION public.specials_pickup_v1(p_order uuid,p_location uuid) RETURNS SETOF public.orders LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM specials_private.pickup(p_order,p_location) $$;
CREATE FUNCTION public.specials_admin_details_v1() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT specials_private.admin_details() $$;
CREATE FUNCTION public.specials_begin_verification_v1(p_order uuid,p_customer uuid,p_attempt uuid,p_path text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT specials_private.begin_verification(p_order,p_customer,p_attempt,p_path) $$;
CREATE FUNCTION public.specials_finish_verification_v1(p_attempt uuid,p_evidence jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT specials_private.finish_verification(p_attempt,p_evidence) $$;
CREATE FUNCTION public.specials_line_action_v1(p_action text,p_batch uuid,p_result jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT specials_private.line_action(p_action,p_batch,p_result) $$;
CREATE FUNCTION public.specials_sweep_v1() RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT specials_private.sweep() $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA specials_private FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA specials_private TO anon;
GRANT EXECUTE ON FUNCTION specials_private.catalog() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION specials_private.is_admin(),specials_private.admin_action(text,jsonb,uuid),specials_private.admin_details(),specials_private.checkout(uuid,jsonb,uuid),specials_private.customer_state(uuid,boolean),specials_private.pickup(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION specials_private.begin_verification(uuid,uuid,uuid,text),specials_private.finish_verification(uuid,jsonb),specials_private.line_action(text,uuid,jsonb),specials_private.sweep() TO service_role;
REVOKE ALL ON FUNCTION public.specials_catalog_v1(),public.specials_checkout_v1(uuid,jsonb,uuid),public.specials_customer_state_v1(uuid,boolean),public.specials_pickup_v1(uuid,uuid),public.specials_admin_details_v1(),public.specials_begin_verification_v1(uuid,uuid,uuid,text),public.specials_finish_verification_v1(uuid,jsonb),public.specials_line_action_v1(text,uuid,jsonb),public.specials_sweep_v1() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.specials_catalog_v1() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.specials_checkout_v1(uuid,jsonb,uuid),public.specials_customer_state_v1(uuid,boolean),public.specials_pickup_v1(uuid,uuid),public.specials_admin_details_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.specials_begin_verification_v1(uuid,uuid,uuid,text),public.specials_finish_verification_v1(uuid,jsonb),public.specials_line_action_v1(text,uuid,jsonb),public.specials_sweep_v1() TO service_role;
-- Browser roles cannot relabel, insert or directly mutate Specials orders via staff policies.
CREATE FUNCTION specials_private.guard_order() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF current_user IN ('authenticated','anon') AND (NEW.order_type='specials' OR (TG_OP='UPDATE' AND OLD.order_type='specials')) THEN RAISE EXCEPTION 'Use the authorized Specials workflow'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER specials_order_guard BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION specials_private.guard_order();
-- Existing privileged RPCs must reject Specials before any stock, payment or loyalty side effects.
-- Patch bodies fail closed against the known signatures. Preserve all regular-order behavior.
DO $guards$
DECLARE f record; definition text; injection text;
BEGIN
 FOR f IN SELECT p.oid,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('cancel_online_order','cancel_online_order_legacy_v1','cancel_online_order_v2','cancel_online_order_v2_inventory_v1','staff_record_order_payment_v2','staff_repair_completed_order_payment_method_v2','staff_redeem_loyalty_reward_v2','refund_reserved_order_loyalty_reward_v2','apply_loyalty_points_delta_v2','claim_order_notification','confirm_order_pickup','create_or_get_payment_transaction_v1','finalize_verified_payment_v1','expire_payment_transaction_v1') LOOP
  definition:=pg_get_functiondef(f.oid);
  IF definition !~* E'\\mBEGIN\\M[[:space:]]*\n' THEN RAISE EXCEPTION 'Unexpected RPC body: %',f.proname; END IF;
  IF f.proname='expire_payment_transaction_v1' THEN
   injection:=E'BEGIN\n  IF EXISTS(SELECT 1 FROM public.specials_checkouts c JOIN public.payment_transactions t ON t.order_id=c.order_id WHERE t.id=p_payment_transaction_id) THEN PERFORM specials_private.reap_batch((SELECT c.batch_id FROM public.specials_checkouts c JOIN public.payment_transactions t ON t.order_id=c.order_id WHERE t.id=p_payment_transaction_id)); RETURN jsonb_build_object(''state'',''specials_swept''); END IF;\n';
  ELSIF f.proname='claim_order_notification' THEN
   injection:=E'BEGIN\n  IF EXISTS(SELECT 1 FROM public.orders WHERE id=p_order_id AND order_type=''specials'' AND (payment_status<>''paid'' OR p_notification_type=''customer_confirmation'')) THEN RETURN jsonb_build_object(''outcome'',''unavailable''); END IF;\n';
  ELSIF f.proname='finalize_verified_payment_v1' THEN
   injection:=E'BEGIN\n  PERFORM pg_advisory_xact_lock(hashtextextended(''easyslip:''||p_provider_transaction_ref,811));\n  IF EXISTS(SELECT 1 FROM specials_private.receipts WHERE provider_ref=p_provider_transaction_ref) OR EXISTS(SELECT 1 FROM public.orders o JOIN public.payment_transactions t ON t.order_id=o.id WHERE t.id=p_payment_transaction_id AND o.order_type=''specials'') THEN RAISE EXCEPTION ''Use Specials payment verification''; END IF;\n';
  ELSE
   injection:=E'BEGIN\n  IF EXISTS(SELECT 1 FROM public.orders WHERE id=p_order_id AND order_type=''specials'') THEN RAISE EXCEPTION ''Use the authorized Specials workflow''; END IF;\n';
  END IF;
  EXECUTE regexp_replace(definition,E'\\mBEGIN\\M[[:space:]]*\n',injection,'i');
 END LOOP;
END $guards$;
DO $cron$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
  PERFORM cron.schedule('joko-specials-expiry-v1','* * * * *','SELECT specials_private.sweep()');
 END IF;
END $cron$;
-- Static Thai merchant QR validation: TLV, currency, country, CRC, no fixed amount.
CREATE FUNCTION specials_private.valid_merchant_qr(payload text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE pos integer:=1; tag text; size integer; value text; crc integer:=65535; idx integer; bit integer; currency_ok boolean:=false; country_ok boolean:=false; merchant_ok boolean:=false; initiation_ok boolean:=false; seen text[]:=ARRAY[]::text[];
BEGIN
 IF payload IS NULL OR length(payload) NOT BETWEEN 30 AND 2048 OR payload !~ '^000201' OR right(payload,8)!~'^6304[0-9A-Fa-f]{4}$' THEN RETURN false; END IF;
 WHILE pos<=length(payload) LOOP
  tag:=substring(payload,pos,2);
  IF substring(payload,pos+2,2)!~'^[0-9]{2}$' OR tag=ANY(seen) THEN RETURN false; END IF;
  seen:=array_append(seen,tag); size:=substring(payload,pos+2,2)::integer;value:=substring(payload,pos+4,size);
  IF length(value)<>size THEN RETURN false; END IF;
  IF tag='54' THEN RETURN false; END IF;
  IF tag='01' THEN initiation_ok:=value='11'; END IF;
  IF tag='53' THEN currency_ok:=value='764'; END IF;
  IF tag='58' THEN country_ok:=value='TH'; END IF;
  IF tag IN ('29','30','31') THEN merchant_ok:=length(value)>10; END IF;
  pos:=pos+4+size;
 END LOOP;
 IF pos<>length(payload)+1 OR NOT currency_ok OR NOT country_ok OR NOT merchant_ok OR NOT initiation_ok THEN RETURN false; END IF;
 FOR idx IN 1..length(payload)-4 LOOP
  crc:=crc # (ascii(substring(payload,idx,1))<<8);
  FOR bit IN 1..8 LOOP crc:=CASE WHEN crc & 32768<>0 THEN ((crc<<1)#4129)&65535 ELSE (crc<<1)&65535 END; END LOOP;
 END LOOP;
 RETURN lpad(upper(to_hex(crc)),4,'0')=upper(right(payload,4));
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
ALTER TABLE specials_private.settings ADD CONSTRAINT specials_static_merchant_qr CHECK(NOT enabled OR specials_private.valid_merchant_qr(qr_payload));
-- Disable regular loyalty calculation for Specials on insert, after the existing trigger.
CREATE FUNCTION specials_private.zero_specials_points() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.order_type='specials' THEN NEW.loyalty_points_earned:=0;NEW.loyalty_multiplier:=0; END IF; RETURN NEW;
END $$;
CREATE TRIGGER zz_specials_points BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION specials_private.zero_specials_points();
-- Durable audit and retry protection for the extended admin actions.
CREATE TABLE specials_private.operations(operation_key uuid PRIMARY KEY,actor_id uuid NOT NULL REFERENCES auth.users(id),action text NOT NULL,request jsonb NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
REVOKE ALL ON specials_private.operations FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION specials_private.admin_action(text,jsonb,uuid) RENAME TO operational_action;
CREATE FUNCTION specials_private.admin_action(p_action text,p_request jsonb,p_operation_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous specials_private.operations%ROWTYPE; result jsonb;
BEGIN
 IF NOT specials_private.is_admin() OR p_operation_key IS NULL THEN RAISE EXCEPTION 'Admin and operation key required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_operation_key::text,731));
 IF p_action IN ('save_batch','save_item','transfer','prepare','close','cancel') THEN
  IF EXISTS(SELECT 1 FROM specials_private.operations WHERE operation_key=p_operation_key) THEN RAISE EXCEPTION 'Operation key belongs to a different request'; END IF;
  RETURN specials_private.operational_action(p_action,p_request,p_operation_key);
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_operation_key::text,731));
 SELECT * INTO previous FROM specials_private.operations WHERE operation_key=p_operation_key;
 IF FOUND THEN
  IF previous.actor_id<>auth.uid() OR previous.action IS DISTINCT FROM p_action OR previous.request IS DISTINCT FROM p_request THEN RAISE EXCEPTION 'Operation key belongs to a different request'; END IF;
  RETURN previous.result;
 END IF;
 IF EXISTS(SELECT 1 FROM public.specials_audit_events WHERE operation_key=p_operation_key) THEN RAISE EXCEPTION 'Operation key belongs to a different request'; END IF;
 result:=specials_private.operational_action(p_action,p_request,p_operation_key);
 INSERT INTO specials_private.operations VALUES(p_operation_key,auth.uid(),p_action,p_request,result,clock_timestamp());
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.admin_specials_action_v1(p_action text,p_request jsonb,p_operation_key uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT specials_private.admin_action(p_action,p_request,p_operation_key) $$;
REVOKE ALL ON FUNCTION specials_private.operational_action(text,jsonb,uuid),specials_private.admin_action(text,jsonb,uuid),specials_private.valid_merchant_qr(text),specials_private.zero_specials_points() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION specials_private.admin_action(text,jsonb,uuid) TO authenticated;

REVOKE ALL ON FUNCTION specials_private.guard_order() FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX specials_hold_lines_item_idx ON specials_private.hold_lines(item_id);
CREATE INDEX specials_attempts_order_idx ON specials_private.attempts(order_id);
CREATE UNIQUE INDEX specials_refund_reference_unique ON specials_private.receipts(refund_reference) WHERE refund_reference IS NOT NULL;
CREATE INDEX specials_receipts_order_idx ON specials_private.receipts(order_id);
CREATE INDEX specials_checkout_batch_all_idx ON public.specials_checkouts(batch_id);

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261008110550','joko_specials_checkout_v1',ARRAY['BEGIN;
-- JOKO Specials: existing orders/payment rail, isolated stock, immutable checkout snapshots.
-- Apply only after the inventory foundation and payment rail migrations.
ALTER TABLE public.specials_batches DROP CONSTRAINT specials_batches_status_check;
ALTER TABLE public.specials_batches ADD CONSTRAINT specials_batches_status_check CHECK(status IN (''draft'',''prepared'',''live'',''closed'',''cancelled''));
DROP INDEX public.specials_one_prepared_batch;
CREATE UNIQUE INDEX specials_one_active_batch ON public.specials_batches((true)) WHERE status IN (''prepared'',''live'');
ALTER TABLE public.orders ADD COLUMN order_type text NOT NULL DEFAULT ''regular'' CHECK(order_type IN (''regular'',''specials''));
ALTER TABLE public.orders ADD COLUMN specials_batch_id uuid REFERENCES public.specials_batches(id) ON DELETE RESTRICT;
ALTER TABLE public.orders ADD COLUMN specials_pickup_snapshot jsonb;
ALTER TABLE public.orders ADD CONSTRAINT specials_order_link CHECK((order_type=''specials'')=(specials_batch_id IS NOT NULL) AND (order_type<>''specials'' OR (specials_pickup_snapshot IS NOT NULL AND pickup_date_id IS NULL AND NOT inventory_reserved)));
CREATE INDEX specials_orders_batch_idx ON public.orders(specials_batch_id) WHERE order_type=''specials'';
CREATE TABLE specials_private.settings (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), enabled boolean NOT NULL DEFAULT false,
 qr_payload text NOT NULL DEFAULT '''', receiver_bank_code text NOT NULL DEFAULT '''', receiver_bank_number text NOT NULL DEFAULT '''', receiver_label text NOT NULL DEFAULT '''',
 updated_by uuid REFERENCES auth.users(id), updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO specials_private.settings(id) VALUES(true);
CREATE TABLE public.specials_checkouts (
 order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE RESTRICT,
 batch_id uuid NOT NULL REFERENCES public.specials_batches(id), customer_id uuid NOT NULL REFERENCES auth.users(id),
 operation_key uuid NOT NULL UNIQUE, request jsonb NOT NULL,
 inventory_state text NOT NULL CHECK(inventory_state IN (''held'',''verifying'',''committed'',''released'')),
 financial_state text NOT NULL DEFAULT ''pending'' CHECK(financial_state IN (''pending'',''verifying'',''verified'',''reconciliation_required'',''refund_pending'',''refunded'')),
 fulfillment_state text NOT NULL DEFAULT ''awaiting_payment'' CHECK(fulfillment_state IN (''awaiting_payment'',''ready'',''picked_up'',''no_show'',''cancelled'')),
 payment_deadline timestamptz NOT NULL, verification_deadline timestamptz NOT NULL,
 active_attempt_id uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX specials_one_customer_hold ON public.specials_checkouts(customer_id,batch_id) WHERE inventory_state IN (''held'',''verifying'');
CREATE INDEX specials_checkouts_expiry ON public.specials_checkouts(batch_id,payment_deadline) WHERE inventory_state IN (''held'',''verifying'');
CREATE TABLE specials_private.checkout_snapshots (
 order_id uuid PRIMARY KEY REFERENCES public.specials_checkouts(order_id), settings jsonb NOT NULL
);
CREATE TABLE specials_private.hold_lines (
 order_id uuid REFERENCES public.specials_checkouts(order_id), item_id uuid REFERENCES public.specials_items(id), quantity integer NOT NULL CHECK(quantity>0), PRIMARY KEY(order_id,item_id)
);
CREATE TABLE specials_private.attempts (
 id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES public.specials_checkouts(order_id), storage_path text NOT NULL,
 registered_at timestamptz NOT NULL DEFAULT clock_timestamp(), completed_at timestamptz, evidence jsonb,
 result jsonb
);
CREATE TABLE specials_private.receipts (
 provider_ref text PRIMARY KEY, order_id uuid NOT NULL REFERENCES public.specials_checkouts(order_id),
 amount numeric(10,2) NOT NULL CHECK(amount>0), received_at timestamptz NOT NULL,
 disposition text NOT NULL CHECK(disposition IN (''credited'',''reconciliation_required'',''refund_pending'',''refunded'')),
 refunded_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK(refunded_amount>=0 AND refunded_amount<=amount), refund_reference text, refund_reason text, refunded_by uuid REFERENCES auth.users(id)
);
CREATE TABLE public.specials_line_outbox (
 batch_id uuid PRIMARY KEY REFERENCES public.specials_batches(id), retry_key uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 message text NOT NULL, status text NOT NULL DEFAULT ''queued'' CHECK(status IN (''queued'',''sending'',''accepted'',''failed'',''uncertain'',''suppressed'')),
 first_attempt_at timestamptz, lease_until timestamptz, attempt_count integer NOT NULL DEFAULT 0, accepted_request_id text, last_error text,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE specials_private.staff_locations (
 user_id uuid REFERENCES auth.users(id), location_id uuid REFERENCES public.cms_pickup_locations(id), PRIMARY KEY(user_id,location_id)
);
ALTER TABLE public.specials_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specials_line_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.specials_checkouts,public.specials_line_outbox FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.specials_checkouts,public.specials_line_outbox TO authenticated,service_role;
CREATE POLICY specials_checkout_read ON public.specials_checkouts FOR SELECT TO authenticated USING(customer_id=auth.uid() OR specials_private.is_admin() OR EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND role::text=''staff''));
CREATE POLICY specials_line_admin_read ON public.specials_line_outbox FOR SELECT TO authenticated USING(specials_private.is_admin());
REVOKE ALL ON ALL TABLES IN SCHEMA specials_private FROM PUBLIC,anon,authenticated,service_role;

-- One batch lock serializes every stock/payment lifecycle mutation. Network calls never hold it.
CREATE FUNCTION specials_private.release_hold(p_order uuid,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS $$
DECLARE c public.specials_checkouts%ROWTYPE; l record;
BEGIN
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order FOR UPDATE;
 IF c.inventory_state NOT IN (''held'',''verifying'') THEN RETURN; END IF;
 FOR l IN SELECT * FROM specials_private.hold_lines WHERE order_id=p_order ORDER BY item_id LOOP
  UPDATE public.specials_items SET quantity_held=quantity_held-l.quantity,quantity_available=quantity_available+l.quantity,version=version+1,updated_at=clock_timestamp() WHERE id=l.item_id;
 END LOOP;
 UPDATE public.specials_checkouts SET inventory_state=''released'',financial_state=CASE WHEN financial_state IN (''pending'',''verifying'') THEN ''pending'' ELSE financial_state END,fulfillment_state=''cancelled'',updated_at=clock_timestamp() WHERE order_id=p_order;
 UPDATE public.orders SET status=''cancelled'',inventory_reserved=false WHERE id=p_order AND payment_status=''unpaid'';
 UPDATE public.payment_transactions SET status=CASE WHEN p_reason=''cancelled'' THEN ''cancelled'' ELSE ''expired'' END,last_error_code=p_reason,updated_at=clock_timestamp() WHERE order_id=p_order AND status<>''verified'';
END $$;
CREATE FUNCTION specials_private.reap_batch(p_batch uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS $$
DECLARE c record; b public.specials_batches%ROWTYPE; t timestamptz;
BEGIN
 SELECT * INTO b FROM public.specials_batches WHERE id=p_batch FOR UPDATE;
 t:=clock_timestamp();
 FOR c IN SELECT * FROM public.specials_checkouts WHERE batch_id=p_batch AND inventory_state IN (''held'',''verifying'') ORDER BY order_id FOR UPDATE LOOP
  IF (c.inventory_state=''held'' AND t>=c.payment_deadline) OR (c.inventory_state=''verifying'' AND t>=c.verification_deadline) THEN PERFORM specials_private.release_hold(c.order_id,''expired''); END IF;
 END LOOP;
 IF b.status IN (''prepared'',''live'') AND t>=b.sales_end_at THEN UPDATE public.specials_batches SET status=''closed'',closed_at=t,version=version+1 WHERE id=p_batch; END IF;
 IF t>=b.pickup_end_at THEN UPDATE public.specials_checkouts SET fulfillment_state=''no_show'',updated_at=t WHERE batch_id=p_batch AND inventory_state=''committed'' AND fulfillment_state=''ready''; END IF;
 UPDATE public.specials_line_outbox SET status=''suppressed'',last_error=''Sale no longer eligible'',updated_at=t WHERE batch_id=p_batch AND status IN (''queued'',''failed'') AND (b.status<>''live'' OR t>=b.sales_end_at-interval ''5 minutes'');
END $$;
CREATE FUNCTION specials_private.checkout(p_batch uuid,p_cart jsonb,p_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS $$
DECLARE b public.specials_batches%ROWTYPE; u public.user_profiles%ROWTYPE; s specials_private.settings%ROWTYPE; c public.specials_checkouts%ROWTYPE; i public.specials_items%ROWTYPE; row record; pr public.cms_products%ROWTYPE; loc public.cms_pickup_locations%ROWTYPE; oid uuid:=gen_random_uuid(); total integer:=0; items jsonb:=''[]''; t timestamptz; used integer;
BEGIN
 IF auth.uid() IS NULL OR p_key IS NULL THEN RAISE EXCEPTION ''Sign in and provide an operation key''; END IF;
 IF p_cart IS NULL OR jsonb_typeof(p_cart)<>''array'' OR jsonb_array_length(p_cart)=0 OR jsonb_array_length(p_cart)>50 THEN RAISE EXCEPTION ''Invalid cart''; END IF;
 SELECT * INTO b FROM public.specials_batches WHERE id=p_batch FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION ''Specials unavailable''; END IF;
 PERFORM specials_private.reap_batch(p_batch);
 SELECT * INTO c FROM public.specials_checkouts WHERE operation_key=p_key;
 IF FOUND THEN
  IF c.customer_id<>auth.uid() OR c.batch_id<>p_batch OR c.request<>p_cart THEN RAISE EXCEPTION ''Operation key belongs to a different request''; END IF;
  RETURN jsonb_build_object(''order_id'',c.order_id);
 END IF;
 t:=clock_timestamp();
 SELECT * INTO s FROM specials_private.settings WHERE id;
 IF NOT s.enabled OR b.status<>''live'' OR t<b.sales_start_at OR t>=b.sales_end_at-interval ''5 minutes'' OR b.business_date<>(t AT TIME ZONE ''Asia/Bangkok'')::date THEN RAISE EXCEPTION ''Checkout is closed''; END IF;
 SELECT * INTO u FROM public.user_profiles WHERE id=auth.uid();
 IF NOT FOUND OR NOT coalesce(u.profile_completed,false) OR nullif(trim(u.name),'''') IS NULL OR nullif(trim(u.phone),'''') IS NULL THEN RAISE EXCEPTION ''Complete your name and phone in your profile first''; END IF;
 IF EXISTS(SELECT 1 FROM public.specials_checkouts WHERE customer_id=auth.uid() AND batch_id=p_batch AND inventory_state IN (''held'',''verifying'')) THEN RAISE EXCEPTION ''Resume or cancel your existing checkout first''; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_cart) x GROUP BY x->>''item_id'' HAVING count(*)>1) THEN RAISE EXCEPTION ''Duplicate cart item''; END IF;
 SELECT * INTO loc FROM public.cms_pickup_locations WHERE id=b.pickup_location_id AND is_active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION ''Pickup location unavailable''; END IF;
 FOR row IN SELECT value FROM jsonb_array_elements(p_cart) ORDER BY value->>''item_id'' LOOP
  IF coalesce(row.value->>''quantity'','''') !~ ''^[1-9][0-9]{0,3}$'' THEN RAISE EXCEPTION ''Invalid quantity''; END IF;
  SELECT * INTO i FROM public.specials_items WHERE id=(row.value->>''item_id'')::uuid AND batch_id=p_batch FOR UPDATE;
  IF NOT FOUND OR NOT i.is_enabled OR i.quantity_available<(row.value->>''quantity'')::int THEN RAISE EXCEPTION ''Specials item sold out''; END IF;
  SELECT * INTO pr FROM public.cms_products WHERE id=i.product_id AND is_active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION ''Product unavailable''; END IF;
  SELECT coalesce(sum(h.quantity),0) INTO used FROM specials_private.hold_lines h JOIN public.specials_checkouts x ON x.order_id=h.order_id WHERE h.item_id=i.id AND x.customer_id=auth.uid() AND x.inventory_state IN (''held'',''verifying'',''committed'');
  IF i.max_per_customer IS NOT NULL AND used+(row.value->>''quantity'')::int>i.max_per_customer THEN RAISE EXCEPTION ''Customer quantity limit exceeded''; END IF;
  total:=total+i.special_price_satang*(row.value->>''quantity'')::int;
  items:=items||jsonb_build_array(jsonb_build_object(''product_id'',pr.id,''product_name'',pr.name_en,''product_name_th'',pr.name_th,''product_name_zh'',pr.name_zh,''quantity'',(row.value->>''quantity'')::int,''price_at_order'',i.special_price_satang/100.0));
 END LOOP;
 t:=clock_timestamp();
 IF t>=b.sales_end_at-interval ''5 minutes'' OR b.business_date<>(t AT TIME ZONE ''Asia/Bangkok'')::date THEN RAISE EXCEPTION ''Checkout is closed''; END IF;
 INSERT INTO public.orders(id,customer_id,order_number,order_items,total_amount,pickup_location_id,pickup_date,status,payment_status,customer_name,customer_phone,customer_email,line_id,purchase_type,order_type,specials_batch_id,specials_pickup_snapshot,inventory_reserved,loyalty_points_earned,loyalty_multiplier)
 VALUES(oid,auth.uid(),''JT-''||nextval(''public.online_order_number_seq''),items,total/100.0,b.pickup_location_id,b.business_date,''pending'',''unpaid'',u.name,u.phone,u.email,u.line_id,''online'',''specials'',b.id,jsonb_build_object(''name_en'',loc.name_en,''name_th'',loc.name_th,''name_zh'',loc.name_zh,''maps_url'',loc.maps_url,''start_at'',b.pickup_start_at,''end_at'',b.pickup_end_at),false,0,0);
 INSERT INTO public.specials_checkouts(order_id,batch_id,customer_id,operation_key,request,inventory_state,payment_deadline,verification_deadline) VALUES(oid,b.id,auth.uid(),p_key,p_cart,''held'',t+interval ''5 minutes'',t+interval ''7 minutes'');
 INSERT INTO specials_private.checkout_snapshots VALUES(oid,to_jsonb(s));
 INSERT INTO public.payment_transactions(order_id,customer_id,amount_due,status,expires_at) VALUES(oid,auth.uid(),total/100.0,''pending'',t+interval ''5 minutes'');
 FOR row IN SELECT value FROM jsonb_array_elements(p_cart) LOOP
  INSERT INTO specials_private.hold_lines VALUES(oid,(row.value->>''item_id'')::uuid,(row.value->>''quantity'')::int);
  UPDATE public.specials_items SET quantity_available=quantity_available-(row.value->>''quantity'')::int,quantity_held=quantity_held+(row.value->>''quantity'')::int,version=version+1,updated_at=t WHERE id=(row.value->>''item_id'')::uuid;
 END LOOP;
 RETURN jsonb_build_object(''order_id'',oid);
END $$;
CREATE FUNCTION specials_private.customer_state(p_order uuid,p_cancel boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS $$
DECLARE c public.specials_checkouts%ROWTYPE; o public.orders%ROWTYPE; snap jsonb;
BEGIN
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order AND customer_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION ''Checkout not found''; END IF;
 PERFORM specials_private.reap_batch(c.batch_id);
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order FOR UPDATE;
 IF p_cancel THEN
  IF c.inventory_state=''verifying'' THEN RAISE EXCEPTION ''Verification in progress; wait for the result''; END IF;
  IF c.inventory_state=''committed'' THEN RAISE EXCEPTION ''Paid orders require Admin assistance''; END IF;
  PERFORM specials_private.release_hold(p_order,''cancelled'');
  SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order;
 END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order;
 SELECT settings INTO snap FROM specials_private.checkout_snapshots WHERE order_id=p_order;
 RETURN jsonb_build_object(''checkout'',to_jsonb(c),''order'',jsonb_build_object(''id'',o.id,''order_number'',o.order_number,''order_items'',o.order_items,''total_amount'',o.total_amount,''payment_status'',o.payment_status,''status'',o.status,''pickup'',o.specials_pickup_snapshot),''qr_payload'',CASE WHEN c.inventory_state=''held'' THEN snap->>''qr_payload'' ELSE NULL END,''receiver_label'',snap->>''receiver_label'',''server_now'',clock_timestamp());
END $$;
-- Register only after a full image upload, before the provider call. Service role only.
CREATE FUNCTION specials_private.begin_verification(p_order uuid,p_customer uuid,p_attempt uuid,p_path text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS $$
DECLARE c public.specials_checkouts%ROWTYPE; snap jsonb; o public.orders%ROWTYPE; a specials_private.attempts%ROWTYPE;
BEGIN
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order AND customer_id=p_customer;
 IF NOT FOUND THEN RAISE EXCEPTION ''Checkout not found''; END IF;
 PERFORM specials_private.reap_batch(c.batch_id);
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order FOR UPDATE;
 SELECT * INTO a FROM specials_private.attempts WHERE id=p_attempt;
 IF FOUND THEN RAISE EXCEPTION ''Upload was already submitted; refresh checkout status''; END IF;
 IF (SELECT count(*) FROM specials_private.attempts WHERE order_id=p_order)>=6 THEN RAISE EXCEPTION ''Slip submission limit reached; contact Admin''; END IF;
 IF c.inventory_state NOT IN (''held'',''released'') OR (c.inventory_state=''held'' AND clock_timestamp()>=c.payment_deadline) THEN RAISE EXCEPTION ''Cannot submit another slip during verification or after payment''; END IF;
 IF c.inventory_state=''held'' THEN
  UPDATE public.specials_checkouts SET inventory_state=''verifying'',financial_state=''verifying'',active_attempt_id=p_attempt,updated_at=clock_timestamp() WHERE order_id=p_order;
  UPDATE public.payment_transactions SET status=''verifying'',updated_at=clock_timestamp() WHERE order_id=p_order;
 END IF;
 INSERT INTO specials_private.attempts(id,order_id,storage_path) VALUES(p_attempt,p_order,p_path);
 SELECT settings INTO snap FROM specials_private.checkout_snapshots WHERE order_id=p_order;
 SELECT * INTO o FROM public.orders WHERE id=p_order;
 RETURN jsonb_build_object(''amount'',o.total_amount,''order_number'',o.order_number,''receiver_bank_code'',snap->>''receiver_bank_code'',''receiver_bank_number'',snap->>''receiver_bank_number'');
END $$;
CREATE FUNCTION specials_private.finish_verification(p_attempt uuid,p_evidence jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS $$
DECLARE a specials_private.attempts%ROWTYPE; c public.specials_checkouts%ROWTYPE; o public.orders%ROWTYPE; b public.specials_batches%ROWTYPE; r specials_private.receipts%ROWTYPE; snap jsonb; l record; ref text; amount numeric; paid_at timestamptz; good boolean; v_result jsonb;
BEGIN
 SELECT * INTO a FROM specials_private.attempts WHERE id=p_attempt;
 IF NOT FOUND THEN RAISE EXCEPTION ''Attempt not found''; END IF;
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=a.order_id;
 SELECT * INTO b FROM public.specials_batches WHERE id=c.batch_id FOR UPDATE;
 PERFORM specials_private.reap_batch(c.batch_id);
 SELECT * INTO a FROM specials_private.attempts WHERE id=p_attempt FOR UPDATE;
 IF a.result IS NOT NULL THEN RETURN a.result; END IF;
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=a.order_id FOR UPDATE;
 SELECT * INTO o FROM public.orders WHERE id=c.order_id FOR UPDATE;
 SELECT settings INTO snap FROM specials_private.checkout_snapshots WHERE order_id=c.order_id;
 ref:=nullif(trim(p_evidence->>''reference''),''''); amount:=(p_evidence->>''amount'')::numeric; paid_at:=(p_evidence->>''paid_at'')::timestamptz;
 IF coalesce((p_evidence->>''provider_success'')::boolean,false) AND ref IS NOT NULL AND amount>0 AND paid_at IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(''easyslip:''||ref,811));
  SELECT * INTO r FROM specials_private.receipts WHERE provider_ref=ref;
  IF FOUND OR EXISTS(SELECT 1 FROM public.payment_transactions WHERE provider=''easyslip'' AND provider_transaction_ref=ref) THEN
   v_result:=jsonb_build_object(''state'',''duplicate'',''message'',''This transfer has already been recorded. Contact Admin if needed.'');
  ELSE
   good:=coalesce(coalesce((p_evidence->>''account_matched'')::boolean,false) AND p_evidence->>''bank_code''=snap->>''receiver_bank_code'' AND regexp_replace(coalesce(p_evidence->>''bank_number'',''''),''[^0-9]'','''',''g'')=regexp_replace(snap->>''receiver_bank_number'',''[^0-9]'','''',''g''),false);
   -- Wrong recipients are evidence only; they are not JOKO money or refundable receipts.
   IF NOT good THEN v_result:=jsonb_build_object(''state'',''rejected'',''message'',''Receiver does not match JOKO. Contact Admin before paying again.'');
   ELSE
    good:=amount=o.total_amount AND NOT coalesce((p_evidence->>''duplicate'')::boolean,true) AND c.inventory_state=''verifying'' AND c.active_attempt_id=p_attempt AND a.registered_at<c.payment_deadline AND clock_timestamp()<c.verification_deadline AND paid_at>=c.created_at AND paid_at<=c.payment_deadline AND b.status<>''cancelled'';
    INSERT INTO specials_private.receipts(provider_ref,order_id,amount,received_at,disposition) VALUES(ref,c.order_id,amount,paid_at,CASE WHEN good THEN ''credited'' ELSE ''reconciliation_required'' END);
    IF good THEN
     FOR l IN SELECT * FROM specials_private.hold_lines WHERE order_id=c.order_id ORDER BY item_id LOOP
      UPDATE public.specials_items SET quantity_held=quantity_held-l.quantity,quantity_committed=quantity_committed+l.quantity,version=version+1,updated_at=clock_timestamp() WHERE id=l.item_id;
     END LOOP;
     UPDATE public.specials_checkouts SET inventory_state=''committed'',financial_state=''verified'',fulfillment_state=''ready'',updated_at=clock_timestamp() WHERE order_id=c.order_id;
     UPDATE public.orders SET payment_status=''paid'',payment_method=''promptpay_online'',amount_paid=total_amount,status=''confirmed'',loyalty_points_earned=0,loyalty_multiplier=0 WHERE id=c.order_id;
     UPDATE public.payment_transactions SET status=''verified'',provider_transaction_ref=ref,verified_at=clock_timestamp(),updated_at=clock_timestamp() WHERE order_id=c.order_id;
     INSERT INTO public.order_notification_events(order_id,notification_type,status) VALUES(c.order_id,''payment_confirmation'',''pending''),(c.order_id,''admin_new_order'',''pending'') ON CONFLICT DO NOTHING;
     v_result:=jsonb_build_object(''state'',''verified'');
    ELSE
     PERFORM specials_private.release_hold(c.order_id,''reconciliation_required'');
     UPDATE public.specials_checkouts SET financial_state=''reconciliation_required'',updated_at=clock_timestamp() WHERE order_id=c.order_id;
     v_result:=jsonb_build_object(''state'',''reconciliation_required'',''message'',''Payment needs Admin reconciliation. Stock has not been reacquired. Do not pay again.'');
    END IF;
   END IF;
  END IF;
 ELSE v_result:=jsonb_build_object(''state'',''provider_error'',''message'',''Verification could not confirm this transfer. Refresh or contact Admin.'');
 END IF;
 -- A rejected v_result never extends the original deadlines.
 IF c.inventory_state=''verifying'' AND c.active_attempt_id=p_attempt AND v_result->>''state'' IN (''rejected'',''duplicate'',''provider_error'') THEN
  IF clock_timestamp()<c.payment_deadline THEN
   UPDATE public.specials_checkouts SET inventory_state=''held'',financial_state=''pending'',active_attempt_id=NULL,updated_at=clock_timestamp() WHERE order_id=c.order_id;
   UPDATE public.payment_transactions SET status=''pending'' WHERE order_id=c.order_id;
  ELSE PERFORM specials_private.release_hold(c.order_id,''expired''); END IF;
 END IF;
 UPDATE specials_private.attempts SET evidence=p_evidence,completed_at=clock_timestamp(),result=v_result WHERE id=p_attempt;
 RETURN v_result;
END $$;
CREATE FUNCTION specials_private.pickup(p_order uuid,p_location uuid) RETURNS SETOF public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS $$
DECLARE c public.specials_checkouts%ROWTYPE; b public.specials_batches%ROWTYPE; o public.orders%ROWTYPE;
BEGIN
 IF NOT specials_private.is_admin() AND NOT EXISTS(SELECT 1 FROM public.user_profiles u JOIN specials_private.staff_locations s ON s.user_id=u.id WHERE u.id=auth.uid() AND u.role::text=''staff'' AND s.location_id=p_location) THEN RAISE EXCEPTION ''Not authorized for this pickup location''; END IF;
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order;
 IF NOT FOUND THEN RAISE EXCEPTION ''Specials order not found''; END IF;
 SELECT * INTO b FROM public.specials_batches WHERE id=c.batch_id FOR UPDATE;
 PERFORM specials_private.reap_batch(b.id);
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order FOR UPDATE;
 SELECT * INTO o FROM public.orders WHERE id=p_order FOR UPDATE;
 IF o.pickup_location_id IS DISTINCT FROM p_location THEN RAISE EXCEPTION ''Wrong pickup location''; END IF;
 IF c.fulfillment_state=''picked_up'' THEN RETURN NEXT o; RETURN; END IF;
 IF c.inventory_state<>''committed'' OR c.financial_state<>''verified'' OR c.fulfillment_state<>''ready'' OR o.payment_status<>''paid'' OR o.amount_paid<>o.total_amount THEN RAISE EXCEPTION ''Payment is not complete or order is not eligible''; END IF;
 IF clock_timestamp()<(o.specials_pickup_snapshot->>''start_at'')::timestamptz OR clock_timestamp()>=(o.specials_pickup_snapshot->>''end_at'')::timestamptz OR b.business_date<>(clock_timestamp() AT TIME ZONE ''Asia/Bangkok'')::date THEN RAISE EXCEPTION ''Outside same-day pickup window''; END IF;
 UPDATE public.specials_checkouts SET fulfillment_state=''picked_up'',updated_at=clock_timestamp() WHERE order_id=p_order;
 UPDATE public.orders SET status=''picked_up'',picked_up_at=clock_timestamp(),loyalty_points_earned=0 WHERE id=p_order RETURNING * INTO o;
 RETURN NEXT o;
END $$;
CREATE FUNCTION specials_private.catalog() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='''' AS $$
 SELECT coalesce((SELECT jsonb_build_object(''batch'',jsonb_build_object(''id'',b.id,''title'',b.title,''pickup_start_at'',b.pickup_start_at,''pickup_end_at'',b.pickup_end_at,''sales_end_at'',b.sales_end_at,''location'',jsonb_build_object(''name_en'',l.name_en,''name_th'',l.name_th,''maps_url'',l.maps_url)), ''items'',(SELECT coalesce(jsonb_agg(jsonb_build_object(''id'',i.id,''name_en'',p.name_en,''name_th'',p.name_th,''image'',p.image,''price_satang'',i.special_price_satang,''regular_price_satang'',i.regular_price_satang,''available'',i.quantity_available,''max_per_customer'',i.max_per_customer) ORDER BY i.created_at),''[]''::jsonb) FROM public.specials_items i JOIN public.cms_products p ON p.id=i.product_id WHERE i.batch_id=b.id AND i.is_enabled AND p.is_active)) FROM public.specials_batches b JOIN public.cms_pickup_locations l ON l.id=b.pickup_location_id JOIN specials_private.settings s ON s.id WHERE b.status=''live'' AND s.enabled AND l.is_active AND clock_timestamp()>=b.sales_start_at AND clock_timestamp()<b.sales_end_at-interval ''5 minutes'' AND b.business_date=(clock_timestamp() AT TIME ZONE ''Asia/Bangkok'')::date LIMIT 1),''{}''::jsonb);
$$;
-- Extend the existing admin dispatcher while preserving its audited retry contract.
ALTER FUNCTION specials_private.admin_action(text,jsonb,uuid) RENAME TO preparation_action;
DO $patch$
DECLARE definition text;
BEGIN
 definition:=pg_get_functiondef(''specials_private.preparation_action(text,jsonb,uuid)''::regprocedure);
 IF position(''NOT IN (''''draft'''',''''prepared'''')'' IN definition)=0 THEN RAISE EXCEPTION ''Unexpected preparation contract''; END IF;
 definition:=replace(definition,''NOT IN (''''draft'''',''''prepared'''')'',''NOT IN (''''draft'''',''''prepared'''',''''live'''')'');
 EXECUTE definition;
END $patch$;
CREATE FUNCTION specials_private.admin_action(p_action text,p_request jsonb,p_operation_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS $$
DECLARE b public.specials_batches%ROWTYPE; s specials_private.settings%ROWTYPE; r specials_private.receipts%ROWTYPE; outbox public.specials_line_outbox%ROWTYPE; t timestamptz; loc public.cms_pickup_locations%ROWTYPE; msg text;
BEGIN
 IF NOT specials_private.is_admin() THEN RAISE EXCEPTION ''Admin required''; END IF;
 IF p_action IN (''save_batch'',''save_item'',''transfer'',''prepare'',''close'',''cancel'') THEN
  IF p_action=''cancel'' AND EXISTS(SELECT 1 FROM public.specials_checkouts WHERE batch_id=(p_request->>''batch_id'')::uuid AND inventory_state=''committed'' AND financial_state<>''refunded'' AND fulfillment_state<>''picked_up'') THEN RAISE EXCEPTION ''Resolve paid orders before emergency cancellation''; END IF;
  RETURN specials_private.preparation_action(p_action,p_request,p_operation_key);
 END IF;
 IF p_action=''settings'' THEN
  IF coalesce((p_request->>''enabled'')::boolean,false) AND (length(coalesce(p_request->>''qr_payload'','''')) NOT BETWEEN 30 AND 2048 OR coalesce(p_request->>''receiver_bank_code'','''')='''' OR length(regexp_replace(coalesce(p_request->>''receiver_bank_number'',''''),''[^0-9]'','''',''g''))<6 OR coalesce(p_request->>''receiver_label'','''')='''') THEN RAISE EXCEPTION ''Approved merchant QR and exact registered receiver required''; END IF;
  UPDATE specials_private.settings SET enabled=coalesce((p_request->>''enabled'')::boolean,false),qr_payload=coalesce(p_request->>''qr_payload'',''''),receiver_bank_code=upper(trim(coalesce(p_request->>''receiver_bank_code'',''''))),receiver_bank_number=coalesce(p_request->>''receiver_bank_number'',''''),receiver_label=coalesce(p_request->>''receiver_label'',''''),updated_by=auth.uid(),updated_at=clock_timestamp() WHERE id RETURNING * INTO s;
  RETURN jsonb_build_object(''settings'',to_jsonb(s));
 END IF;
 IF p_action=''staff_location'' THEN
  IF NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=(p_request->>''user_id'')::uuid AND role::text=''staff'') OR NOT EXISTS(SELECT 1 FROM public.cms_pickup_locations WHERE id=(p_request->>''location_id'')::uuid AND is_active) THEN RAISE EXCEPTION ''Active location and staff user required''; END IF;
  IF coalesce((p_request->>''enabled'')::boolean,false) THEN INSERT INTO specials_private.staff_locations VALUES((p_request->>''user_id'')::uuid,(p_request->>''location_id'')::uuid) ON CONFLICT DO NOTHING;
  ELSE DELETE FROM specials_private.staff_locations WHERE user_id=(p_request->>''user_id'')::uuid AND location_id=(p_request->>''location_id'')::uuid; END IF;
  RETURN jsonb_build_object(''saved'',true);
 END IF;
 SELECT * INTO b FROM public.specials_batches WHERE id=(p_request->>''batch_id'')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION ''Batch not found''; END IF;
 t:=clock_timestamp();
 IF p_action=''publish'' THEN
  IF b.status=''live'' THEN RETURN jsonb_build_object(''batch'',to_jsonb(b)); END IF;
  IF b.version IS DISTINCT FROM (p_request->>''expected_version'')::integer THEN RAISE EXCEPTION ''Batch changed; refresh''; END IF;
  IF b.status<>''prepared'' OR b.business_date<>(t AT TIME ZONE ''Asia/Bangkok'')::date OR t<b.sales_start_at OR t>=b.sales_end_at-interval ''5 minutes'' OR NOT EXISTS(SELECT 1 FROM specials_private.settings WHERE id AND enabled) OR NOT EXISTS(SELECT 1 FROM public.specials_items i JOIN public.cms_products p ON p.id=i.product_id WHERE i.batch_id=b.id AND i.is_enabled AND i.quantity_available>0 AND p.is_active) OR NOT EXISTS(SELECT 1 FROM public.cms_pickup_locations WHERE id=b.pickup_location_id AND is_active) THEN RAISE EXCEPTION ''Publication requires enabled payment, prepared stock and an open sales window''; END IF;
  UPDATE public.specials_batches SET status=''live'',version=version+1,updated_at=t WHERE id=b.id RETURNING * INTO b;
  RETURN jsonb_build_object(''batch'',to_jsonb(b));
 ELSIF p_action=''queue_line'' THEN
  IF b.status<>''live'' OR t>=b.sales_end_at-interval ''5 minutes'' OR NOT EXISTS(SELECT 1 FROM public.specials_items WHERE batch_id=b.id AND is_enabled AND quantity_available>0) THEN RAISE EXCEPTION ''Sale is not eligible for announcement''; END IF;
  SELECT * INTO loc FROM public.cms_pickup_locations WHERE id=b.pickup_location_id;
  msg:=''JOKO Specials — ''||b.title||E''\nขนม JOKO ราคาพิเศษ รับวันนี้เท่านั้น / Same-day pickup only\n''||loc.name_en||'' / ''||loc.name_th||E''\n''||to_char(b.pickup_start_at AT TIME ZONE ''Asia/Bangkok'',''DD Mon HH24:MI'')||''–''||to_char(b.pickup_end_at AT TIME ZONE ''Asia/Bangkok'',''HH24:MI'')||E'' (Bangkok)\nLimited stock / มีจำนวนจำกัด\nhttps://joko.today/specials'';
  INSERT INTO public.specials_line_outbox(batch_id,message) VALUES(b.id,msg) ON CONFLICT(batch_id) DO NOTHING;
  SELECT * INTO outbox FROM public.specials_line_outbox WHERE batch_id=b.id;
  RETURN jsonb_build_object(''batch'',to_jsonb(b),''announcement'',to_jsonb(outbox));
 ELSIF p_action=''refund_pending'' THEN
  SELECT * INTO r FROM specials_private.receipts WHERE provider_ref=p_request->>''reference'' AND order_id IN (SELECT order_id FROM public.specials_checkouts WHERE batch_id=b.id) FOR UPDATE;
  IF NOT FOUND OR nullif(trim(p_request->>''reason''),'''') IS NULL OR r.disposition=''refunded'' OR EXISTS(SELECT 1 FROM public.specials_checkouts WHERE order_id=r.order_id AND fulfillment_state=''picked_up'') THEN RAISE EXCEPTION ''Unrefunded receipt, reason and uncollected order required''; END IF;
  UPDATE specials_private.receipts SET disposition=''refund_pending'',refund_reason=p_request->>''reason'' WHERE provider_ref=r.provider_ref;
  UPDATE public.specials_checkouts SET financial_state=''refund_pending'',fulfillment_state=''cancelled'',updated_at=t WHERE order_id=r.order_id;
  UPDATE public.orders SET status=''cancelled'' WHERE id=r.order_id;
  RETURN jsonb_build_object(''batch'',to_jsonb(b));
 ELSIF p_action=''refund'' THEN
  SELECT * INTO r FROM specials_private.receipts WHERE provider_ref=p_request->>''reference'' AND order_id IN (SELECT order_id FROM public.specials_checkouts WHERE batch_id=b.id) FOR UPDATE;
  IF NOT FOUND OR nullif(trim(p_request->>''reason''),'''') IS NULL OR nullif(trim(p_request->>''refund_reference''),'''') IS NULL OR (p_request->>''amount'')::numeric<>r.amount THEN RAISE EXCEPTION ''Full actual refund amount, bank reference and reason required''; END IF;
  IF r.disposition=''refunded'' THEN
   IF r.refund_reference<>p_request->>''refund_reference'' THEN RAISE EXCEPTION ''Refund already recorded''; END IF;
  ELSE
   IF EXISTS(SELECT 1 FROM public.specials_checkouts WHERE order_id=r.order_id AND fulfillment_state=''picked_up'') THEN RAISE EXCEPTION ''Picked-up orders need separate financial review''; END IF;
   UPDATE specials_private.receipts SET disposition=''refunded'',refunded_amount=amount,refund_reference=p_request->>''refund_reference'',refund_reason=p_request->>''reason'',refunded_by=auth.uid() WHERE provider_ref=r.provider_ref;
   -- Refund does not restock committed goods; Admin handles physical leftovers separately.
   UPDATE public.specials_checkouts SET financial_state=CASE WHEN EXISTS(SELECT 1 FROM specials_private.receipts remaining WHERE remaining.order_id=r.order_id AND remaining.disposition<>''refunded'') THEN ''refund_pending'' ELSE ''refunded'' END,fulfillment_state=''cancelled'',updated_at=t WHERE order_id=r.order_id;
   UPDATE public.orders SET status=''cancelled'' WHERE id=r.order_id;
  END IF;
  RETURN jsonb_build_object(''batch'',to_jsonb(b));
 END IF;
 RAISE EXCEPTION ''Invalid Specials action'';
END $$;
-- SQL wrappers resolve functions at execution time; replace to bind renamed dispatcher.
CREATE OR REPLACE FUNCTION public.admin_specials_action_v1(p_action text,p_request jsonb,p_operation_key uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='''' AS $$ SELECT specials_private.admin_action(p_action,p_request,p_operation_key) $$;
CREATE FUNCTION specials_private.admin_details() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS $$
BEGIN
 IF NOT specials_private.is_admin() THEN RAISE EXCEPTION ''Admin required''; END IF;
 RETURN jsonb_build_object(''settings'',(SELECT to_jsonb(s) FROM specials_private.settings s WHERE id),''staff_locations'',(SELECT coalesce(jsonb_agg(to_jsonb(s)),''[]'') FROM specials_private.staff_locations s),''receipts'',(SELECT coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object(''batch_id'',c.batch_id)),''[]'') FROM specials_private.receipts r JOIN public.specials_checkouts c ON c.order_id=r.order_id));
END $$;
CREATE FUNCTION specials_private.line_action(p_action text,p_batch uuid,p_result jsonb DEFAULT ''{}'') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS $$
DECLARE b public.specials_batches%ROWTYPE; x public.specials_line_outbox%ROWTYPE; t timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO b FROM public.specials_batches WHERE id=p_batch FOR UPDATE;
 SELECT * INTO x FROM public.specials_line_outbox WHERE batch_id=p_batch FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION ''Announcement not prepared''; END IF;
 IF p_action=''claim'' THEN
  IF x.status IN (''accepted'',''suppressed'') THEN RETURN jsonb_build_object(''send'',false,''status'',x.status); END IF;
  IF x.status=''sending'' AND x.lease_until>t THEN RETURN jsonb_build_object(''send'',false,''status'',''sending''); END IF;
  IF x.first_attempt_at IS NOT NULL AND t>=x.first_attempt_at+interval ''23 hours'' THEN
   UPDATE public.specials_line_outbox SET status=''uncertain'',last_error=''Retry window exhausted; do not create another campaign'',lease_until=NULL WHERE batch_id=p_batch;
   RETURN jsonb_build_object(''send'',false,''status'',''uncertain'');
  END IF;
  IF b.status<>''live'' OR t>=b.sales_end_at-interval ''5 minutes'' OR NOT EXISTS(SELECT 1 FROM public.specials_items WHERE batch_id=p_batch AND is_enabled AND quantity_available>0) THEN
   UPDATE public.specials_line_outbox SET status=CASE WHEN first_attempt_at IS NULL THEN ''suppressed'' ELSE ''uncertain'' END,last_error=''Sale closed or sold out; sending suppressed'',lease_until=NULL WHERE batch_id=p_batch;
   RETURN jsonb_build_object(''send'',false,''status'',''suppressed'');
  END IF;
  UPDATE public.specials_line_outbox SET status=''sending'',first_attempt_at=coalesce(first_attempt_at,t),lease_until=t+interval ''2 minutes'',attempt_count=attempt_count+1,updated_at=t WHERE batch_id=p_batch RETURNING * INTO x;
  RETURN jsonb_build_object(''send'',true,''retry_key'',x.retry_key,''message'',x.message);
 ELSIF p_action=''finish'' THEN
  IF x.status=''accepted'' THEN RETURN to_jsonb(x); END IF;
  UPDATE public.specials_line_outbox SET status=CASE WHEN p_result->>''status''=''accepted'' THEN ''accepted'' WHEN p_result->>''status''=''failed'' THEN ''failed'' ELSE ''uncertain'' END,accepted_request_id=p_result->>''request_id'',last_error=left(p_result->>''error'',500),lease_until=NULL,updated_at=t WHERE batch_id=p_batch RETURNING * INTO x;
  RETURN to_jsonb(x);
 END IF;
 RAISE EXCEPTION ''Invalid announcement action'';
END $$;
CREATE FUNCTION specials_private.sweep() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS $$
DECLARE b record; n integer:=0;
BEGIN
 FOR b IN SELECT batch.id FROM public.specials_batches batch WHERE batch.status IN (''prepared'',''live'') OR EXISTS(SELECT 1 FROM public.specials_checkouts c WHERE c.batch_id=batch.id AND (c.inventory_state IN (''held'',''verifying'') OR c.fulfillment_state=''ready'')) ORDER BY batch.id LOOP PERFORM specials_private.reap_batch(b.id); n:=n+1; END LOOP;
 RETURN n;
END $$;
-- Public API surface. Private service functions are inaccessible to browser roles.
CREATE FUNCTION public.specials_catalog_v1() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='''' AS $$ SELECT specials_private.catalog() $$;
CREATE FUNCTION public.specials_checkout_v1(p_batch uuid,p_cart jsonb,p_key uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='''' AS $$ SELECT specials_private.checkout(p_batch,p_cart,p_key) $$;
CREATE FUNCTION public.specials_customer_state_v1(p_order uuid,p_cancel boolean DEFAULT false) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='''' AS $$ SELECT specials_private.customer_state(p_order,p_cancel) $$;
CREATE FUNCTION public.specials_pickup_v1(p_order uuid,p_location uuid) RETURNS SETOF public.orders LANGUAGE sql SECURITY INVOKER SET search_path='''' AS $$ SELECT * FROM specials_private.pickup(p_order,p_location) $$;
CREATE FUNCTION public.specials_admin_details_v1() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='''' AS $$ SELECT specials_private.admin_details() $$;
CREATE FUNCTION public.specials_begin_verification_v1(p_order uuid,p_customer uuid,p_attempt uuid,p_path text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='''' AS $$ SELECT specials_private.begin_verification(p_order,p_customer,p_attempt,p_path) $$;
CREATE FUNCTION public.specials_finish_verification_v1(p_attempt uuid,p_evidence jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='''' AS $$ SELECT specials_private.finish_verification(p_attempt,p_evidence) $$;
CREATE FUNCTION public.specials_line_action_v1(p_action text,p_batch uuid,p_result jsonb DEFAULT ''{}'') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='''' AS $$ SELECT specials_private.line_action(p_action,p_batch,p_result) $$;
CREATE FUNCTION public.specials_sweep_v1() RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path='''' AS $$ SELECT specials_private.sweep() $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA specials_private FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA specials_private TO anon;
GRANT EXECUTE ON FUNCTION specials_private.catalog() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION specials_private.is_admin(),specials_private.admin_action(text,jsonb,uuid),specials_private.admin_details(),specials_private.checkout(uuid,jsonb,uuid),specials_private.customer_state(uuid,boolean),specials_private.pickup(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION specials_private.begin_verification(uuid,uuid,uuid,text),specials_private.finish_verification(uuid,jsonb),specials_private.line_action(text,uuid,jsonb),specials_private.sweep() TO service_role;
REVOKE ALL ON FUNCTION public.specials_catalog_v1(),public.specials_checkout_v1(uuid,jsonb,uuid),public.specials_customer_state_v1(uuid,boolean),public.specials_pickup_v1(uuid,uuid),public.specials_admin_details_v1(),public.specials_begin_verification_v1(uuid,uuid,uuid,text),public.specials_finish_verification_v1(uuid,jsonb),public.specials_line_action_v1(text,uuid,jsonb),public.specials_sweep_v1() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.specials_catalog_v1() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.specials_checkout_v1(uuid,jsonb,uuid),public.specials_customer_state_v1(uuid,boolean),public.specials_pickup_v1(uuid,uuid),public.specials_admin_details_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.specials_begin_verification_v1(uuid,uuid,uuid,text),public.specials_finish_verification_v1(uuid,jsonb),public.specials_line_action_v1(text,uuid,jsonb),public.specials_sweep_v1() TO service_role;
-- Browser roles cannot relabel, insert or directly mutate Specials orders via staff policies.
CREATE FUNCTION specials_private.guard_order() RETURNS trigger LANGUAGE plpgsql SET search_path='''' AS $$
BEGIN
 IF current_user IN (''authenticated'',''anon'') AND (NEW.order_type=''specials'' OR (TG_OP=''UPDATE'' AND OLD.order_type=''specials'')) THEN RAISE EXCEPTION ''Use the authorized Specials workflow''; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER specials_order_guard BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION specials_private.guard_order();
-- Existing privileged RPCs must reject Specials before any stock, payment or loyalty side effects.
-- Patch bodies fail closed against the known signatures. Preserve all regular-order behavior.
DO $guards$
DECLARE f record; definition text; injection text;
BEGIN
 FOR f IN SELECT p.oid,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=''public'' AND p.proname IN (''cancel_online_order'',''cancel_online_order_legacy_v1'',''cancel_online_order_v2'',''cancel_online_order_v2_inventory_v1'',''staff_record_order_payment_v2'',''staff_repair_completed_order_payment_method_v2'',''staff_redeem_loyalty_reward_v2'',''refund_reserved_order_loyalty_reward_v2'',''apply_loyalty_points_delta_v2'',''claim_order_notification'',''confirm_order_pickup'',''create_or_get_payment_transaction_v1'',''finalize_verified_payment_v1'',''expire_payment_transaction_v1'') LOOP
  definition:=pg_get_functiondef(f.oid);
  IF definition !~* E''\\mBEGIN\\M[[:space:]]*\n'' THEN RAISE EXCEPTION ''Unexpected RPC body: %'',f.proname; END IF;
  IF f.proname=''expire_payment_transaction_v1'' THEN
   injection:=E''BEGIN\n  IF EXISTS(SELECT 1 FROM public.specials_checkouts c JOIN public.payment_transactions t ON t.order_id=c.order_id WHERE t.id=p_payment_transaction_id) THEN PERFORM specials_private.reap_batch((SELECT c.batch_id FROM public.specials_checkouts c JOIN public.payment_transactions t ON t.order_id=c.order_id WHERE t.id=p_payment_transaction_id)); RETURN jsonb_build_object(''''state'''',''''specials_swept''''); END IF;\n'';
  ELSIF f.proname=''claim_order_notification'' THEN
   injection:=E''BEGIN\n  IF EXISTS(SELECT 1 FROM public.orders WHERE id=p_order_id AND order_type=''''specials'''' AND (payment_status<>''''paid'''' OR p_notification_type=''''customer_confirmation'''')) THEN RETURN jsonb_build_object(''''outcome'''',''''unavailable''''); END IF;\n'';
  ELSIF f.proname=''finalize_verified_payment_v1'' THEN
   injection:=E''BEGIN\n  PERFORM pg_advisory_xact_lock(hashtextextended(''''easyslip:''''||p_provider_transaction_ref,811));\n  IF EXISTS(SELECT 1 FROM specials_private.receipts WHERE provider_ref=p_provider_transaction_ref) OR EXISTS(SELECT 1 FROM public.orders o JOIN public.payment_transactions t ON t.order_id=o.id WHERE t.id=p_payment_transaction_id AND o.order_type=''''specials'''') THEN RAISE EXCEPTION ''''Use Specials payment verification''''; END IF;\n'';
  ELSE
   injection:=E''BEGIN\n  IF EXISTS(SELECT 1 FROM public.orders WHERE id=p_order_id AND order_type=''''specials'''') THEN RAISE EXCEPTION ''''Use the authorized Specials workflow''''; END IF;\n'';
  END IF;
  EXECUTE regexp_replace(definition,E''\\mBEGIN\\M[[:space:]]*\n'',injection,''i'');
 END LOOP;
END $guards$;
DO $cron$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_extension WHERE extname=''pg_cron'') THEN
  PERFORM cron.schedule(''joko-specials-expiry-v1'',''* * * * *'',''SELECT specials_private.sweep()'');
 END IF;
END $cron$;
-- Static Thai merchant QR validation: TLV, currency, country, CRC, no fixed amount.
CREATE FUNCTION specials_private.valid_merchant_qr(payload text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='''' AS $$
DECLARE pos integer:=1; tag text; size integer; value text; crc integer:=65535; idx integer; bit integer; currency_ok boolean:=false; country_ok boolean:=false; merchant_ok boolean:=false; initiation_ok boolean:=false; seen text[]:=ARRAY[]::text[];
BEGIN
 IF payload IS NULL OR length(payload) NOT BETWEEN 30 AND 2048 OR payload !~ ''^000201'' OR right(payload,8)!~''^6304[0-9A-Fa-f]{4}$'' THEN RETURN false; END IF;
 WHILE pos<=length(payload) LOOP
  tag:=substring(payload,pos,2);
  IF substring(payload,pos+2,2)!~''^[0-9]{2}$'' OR tag=ANY(seen) THEN RETURN false; END IF;
  seen:=array_append(seen,tag); size:=substring(payload,pos+2,2)::integer;value:=substring(payload,pos+4,size);
  IF length(value)<>size THEN RETURN false; END IF;
  IF tag=''54'' THEN RETURN false; END IF;
  IF tag=''01'' THEN initiation_ok:=value=''11''; END IF;
  IF tag=''53'' THEN currency_ok:=value=''764''; END IF;
  IF tag=''58'' THEN country_ok:=value=''TH''; END IF;
  IF tag IN (''29'',''30'',''31'') THEN merchant_ok:=length(value)>10; END IF;
  pos:=pos+4+size;
 END LOOP;
 IF pos<>length(payload)+1 OR NOT currency_ok OR NOT country_ok OR NOT merchant_ok OR NOT initiation_ok THEN RETURN false; END IF;
 FOR idx IN 1..length(payload)-4 LOOP
  crc:=crc # (ascii(substring(payload,idx,1))<<8);
  FOR bit IN 1..8 LOOP crc:=CASE WHEN crc & 32768<>0 THEN ((crc<<1)#4129)&65535 ELSE (crc<<1)&65535 END; END LOOP;
 END LOOP;
 RETURN lpad(upper(to_hex(crc)),4,''0'')=upper(right(payload,4));
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
ALTER TABLE specials_private.settings ADD CONSTRAINT specials_static_merchant_qr CHECK(NOT enabled OR specials_private.valid_merchant_qr(qr_payload));
-- Disable regular loyalty calculation for Specials on insert, after the existing trigger.
CREATE FUNCTION specials_private.zero_specials_points() RETURNS trigger LANGUAGE plpgsql SET search_path='''' AS $$
BEGIN
 IF NEW.order_type=''specials'' THEN NEW.loyalty_points_earned:=0;NEW.loyalty_multiplier:=0; END IF; RETURN NEW;
END $$;
CREATE TRIGGER zz_specials_points BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION specials_private.zero_specials_points();
-- Durable audit and retry protection for the extended admin actions.
CREATE TABLE specials_private.operations(operation_key uuid PRIMARY KEY,actor_id uuid NOT NULL REFERENCES auth.users(id),action text NOT NULL,request jsonb NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
REVOKE ALL ON specials_private.operations FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION specials_private.admin_action(text,jsonb,uuid) RENAME TO operational_action;
CREATE FUNCTION specials_private.admin_action(p_action text,p_request jsonb,p_operation_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS $$
DECLARE previous specials_private.operations%ROWTYPE; result jsonb;
BEGIN
 IF NOT specials_private.is_admin() OR p_operation_key IS NULL THEN RAISE EXCEPTION ''Admin and operation key required''; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_operation_key::text,731));
 IF p_action IN (''save_batch'',''save_item'',''transfer'',''prepare'',''close'',''cancel'') THEN
  IF EXISTS(SELECT 1 FROM specials_private.operations WHERE operation_key=p_operation_key) THEN RAISE EXCEPTION ''Operation key belongs to a different request''; END IF;
  RETURN specials_private.operational_action(p_action,p_request,p_operation_key);
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_operation_key::text,731));
 SELECT * INTO previous FROM specials_private.operations WHERE operation_key=p_operation_key;
 IF FOUND THEN
  IF previous.actor_id<>auth.uid() OR previous.action IS DISTINCT FROM p_action OR previous.request IS DISTINCT FROM p_request THEN RAISE EXCEPTION ''Operation key belongs to a different request''; END IF;
  RETURN previous.result;
 END IF;
 IF EXISTS(SELECT 1 FROM public.specials_audit_events WHERE operation_key=p_operation_key) THEN RAISE EXCEPTION ''Operation key belongs to a different request''; END IF;
 result:=specials_private.operational_action(p_action,p_request,p_operation_key);
 INSERT INTO specials_private.operations VALUES(p_operation_key,auth.uid(),p_action,p_request,result,clock_timestamp());
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.admin_specials_action_v1(p_action text,p_request jsonb,p_operation_key uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='''' AS $$ SELECT specials_private.admin_action(p_action,p_request,p_operation_key) $$;
REVOKE ALL ON FUNCTION specials_private.operational_action(text,jsonb,uuid),specials_private.admin_action(text,jsonb,uuid),specials_private.valid_merchant_qr(text),specials_private.zero_specials_points() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION specials_private.admin_action(text,jsonb,uuid) TO authenticated;

REVOKE ALL ON FUNCTION specials_private.guard_order() FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX specials_hold_lines_item_idx ON specials_private.hold_lines(item_id);
CREATE INDEX specials_attempts_order_idx ON specials_private.attempts(order_id);
CREATE UNIQUE INDEX specials_refund_reference_unique ON specials_private.receipts(refund_reference) WHERE refund_reference IS NOT NULL;
CREATE INDEX specials_receipts_order_idx ON specials_private.receipts(order_id);
CREATE INDEX specials_checkout_batch_all_idx ON public.specials_checkouts(batch_id);
COMMIT;
']);

-- 20261009025239_joko_specials_payment_compatibility_v1.sql
-- Restore Specials guards after regular payment timeout/reactivation replaces expiry.

DO $guards$
DECLARE signature text; definition text; injection text;
BEGIN
 FOREACH signature IN ARRAY ARRAY['public.expire_payment_transaction_v1(uuid)','public.reactivate_expired_online_order_v1(uuid)','public.expire_own_payment_transaction_v1(uuid)'] LOOP
  definition:=pg_get_functiondef(signature::regprocedure);
  IF definition !~* E'\\mBEGIN\\M[[:space:]]*\n' THEN RAISE EXCEPTION 'Unexpected RPC body: %',signature; END IF;
  IF signature='public.expire_payment_transaction_v1(uuid)' THEN
   injection:=E'BEGIN\n  IF EXISTS(SELECT 1 FROM public.specials_checkouts c JOIN public.payment_transactions t ON t.order_id=c.order_id WHERE t.id=p_payment_transaction_id) THEN PERFORM specials_private.reap_batch((SELECT c.batch_id FROM public.specials_checkouts c JOIN public.payment_transactions t ON t.order_id=c.order_id WHERE t.id=p_payment_transaction_id)); RETURN jsonb_build_object(''state'',''specials_swept''); END IF;\n';
  ELSIF signature='public.reactivate_expired_online_order_v1(uuid)' THEN
   injection:=E'BEGIN\n  IF EXISTS(SELECT 1 FROM public.orders WHERE id=p_order_id AND order_type=''specials'') THEN RAISE EXCEPTION ''Use the authorized Specials workflow''; END IF;\n';
  ELSE
   injection:=E'BEGIN\n  IF EXISTS(SELECT 1 FROM public.orders o JOIN public.payment_transactions t ON t.order_id=o.id WHERE t.id=p_payment_transaction_id AND o.order_type=''specials'') THEN RAISE EXCEPTION ''Use the authorized Specials workflow''; END IF;\n';
  END IF;
  EXECUTE regexp_replace(definition,E'\\mBEGIN\\M[[:space:]]*\n',injection,'i');
 END LOOP;
END $guards$;

-- Even privileged legacy handlers cannot issue a regular payment handoff for Specials.
CREATE FUNCTION specials_private.guard_payment_handoff() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.orders WHERE id=NEW.order_id AND order_type='specials')
 OR EXISTS(SELECT 1 FROM public.payment_transactions t JOIN public.orders o ON o.id=t.order_id WHERE t.id=NEW.payment_transaction_id AND o.order_type='specials') THEN
  RAISE EXCEPTION 'Use Specials payment verification';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION specials_private.guard_payment_handoff() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER specials_payment_handoff_guard BEFORE INSERT OR UPDATE ON public.payment_handoff_sessions
FOR EACH ROW EXECUTE FUNCTION specials_private.guard_payment_handoff();
-- Regular checkout's Stripe selector must never change the Specials payment rail.
CREATE FUNCTION specials_private.pin_payment_mode() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.orders WHERE id=NEW.order_id AND order_type='specials') THEN
  NEW.payment_mode:='kshop_master';
  NEW.provider:='easyslip';
  NEW.rail:='promptpay';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION specials_private.pin_payment_mode() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER zz_specials_payment_mode BEFORE INSERT ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION specials_private.pin_payment_mode();

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261009025239','joko_specials_payment_compatibility_v1',ARRAY['-- Restore Specials guards after regular payment timeout/reactivation replaces expiry.
BEGIN;
DO $guards$
DECLARE signature text; definition text; injection text;
BEGIN
 FOREACH signature IN ARRAY ARRAY[''public.expire_payment_transaction_v1(uuid)'',''public.reactivate_expired_online_order_v1(uuid)'',''public.expire_own_payment_transaction_v1(uuid)''] LOOP
  definition:=pg_get_functiondef(signature::regprocedure);
  IF definition !~* E''\\mBEGIN\\M[[:space:]]*\n'' THEN RAISE EXCEPTION ''Unexpected RPC body: %'',signature; END IF;
  IF signature=''public.expire_payment_transaction_v1(uuid)'' THEN
   injection:=E''BEGIN\n  IF EXISTS(SELECT 1 FROM public.specials_checkouts c JOIN public.payment_transactions t ON t.order_id=c.order_id WHERE t.id=p_payment_transaction_id) THEN PERFORM specials_private.reap_batch((SELECT c.batch_id FROM public.specials_checkouts c JOIN public.payment_transactions t ON t.order_id=c.order_id WHERE t.id=p_payment_transaction_id)); RETURN jsonb_build_object(''''state'''',''''specials_swept''''); END IF;\n'';
  ELSIF signature=''public.reactivate_expired_online_order_v1(uuid)'' THEN
   injection:=E''BEGIN\n  IF EXISTS(SELECT 1 FROM public.orders WHERE id=p_order_id AND order_type=''''specials'''') THEN RAISE EXCEPTION ''''Use the authorized Specials workflow''''; END IF;\n'';
  ELSE
   injection:=E''BEGIN\n  IF EXISTS(SELECT 1 FROM public.orders o JOIN public.payment_transactions t ON t.order_id=o.id WHERE t.id=p_payment_transaction_id AND o.order_type=''''specials'''') THEN RAISE EXCEPTION ''''Use the authorized Specials workflow''''; END IF;\n'';
  END IF;
  EXECUTE regexp_replace(definition,E''\\mBEGIN\\M[[:space:]]*\n'',injection,''i'');
 END LOOP;
END $guards$;

-- Even privileged legacy handlers cannot issue a regular payment handoff for Specials.
CREATE FUNCTION specials_private.guard_payment_handoff() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.orders WHERE id=NEW.order_id AND order_type=''specials'')
 OR EXISTS(SELECT 1 FROM public.payment_transactions t JOIN public.orders o ON o.id=t.order_id WHERE t.id=NEW.payment_transaction_id AND o.order_type=''specials'') THEN
  RAISE EXCEPTION ''Use Specials payment verification'';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION specials_private.guard_payment_handoff() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER specials_payment_handoff_guard BEFORE INSERT OR UPDATE ON public.payment_handoff_sessions
FOR EACH ROW EXECUTE FUNCTION specials_private.guard_payment_handoff();
-- Regular checkout''s Stripe selector must never change the Specials payment rail.
CREATE FUNCTION specials_private.pin_payment_mode() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.orders WHERE id=NEW.order_id AND order_type=''specials'') THEN
  NEW.payment_mode:=''kshop_master'';
  NEW.provider:=''easyslip'';
  NEW.rail:=''promptpay'';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION specials_private.pin_payment_mode() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER zz_specials_payment_mode BEFORE INSERT ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION specials_private.pin_payment_mode();
COMMIT;
']);

-- 20261010144000_pickup_handover_v1.sql
-- JOKO TODAY Pickup Handover v1
-- Paid online orders are handed over by staff, then completed by a short-lived
-- customer receipt-confirmation QR. Only token hashes are persisted.

CREATE TABLE IF NOT EXISTS public.pickup_handover_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  staff_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','confirmed','bypassed','expired','cancelled')),
  expires_at timestamptz NOT NULL,
  customer_confirmed_at timestamptz,
  completed_at timestamptz,
  bypass_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pickup_handover_sessions_order_idx
  ON public.pickup_handover_sessions(order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pickup_handover_sessions_staff_idx
  ON public.pickup_handover_sessions(staff_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS pickup_handover_sessions_one_active_per_order
  ON public.pickup_handover_sessions(order_id)
  WHERE status = 'active';

ALTER TABLE public.pickup_handover_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pickup_handover_sessions FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.pickup_handover_sessions IS
'Short-lived pickup handover sessions. Staff initiates handover; customer receipt confirmation or an audited staff bypass completes pickup. Plain bearer tokens are never stored.';

CREATE OR REPLACE FUNCTION public.finalize_pickup_handover_v1(
  p_handoff_id uuid,
  p_bypass_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $pickup$
DECLARE
  v_role text := COALESCE(auth.role(), '');
  v_handoff public.pickup_handover_sessions%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_customer_id uuid;
  v_existing_earn_at timestamptz;
  v_bypass_reason text := NULLIF(btrim(COALESCE(p_bypass_reason, '')), '');
BEGIN
  IF v_role <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  IF p_handoff_id IS NULL THEN
    RAISE EXCEPTION 'Handover id is required';
  END IF;

  SELECT * INTO v_handoff
  FROM public.pickup_handover_sessions
  WHERE id = p_handoff_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pickup handover not found';
  END IF;

  IF v_handoff.status IN ('confirmed','bypassed') THEN
    SELECT * INTO v_order FROM public.orders WHERE id = v_handoff.order_id;
    RETURN jsonb_build_object(
      'handover', to_jsonb(v_handoff),
      'order', to_jsonb(v_order),
      'idempotent_replay', true
    );
  END IF;

  IF v_handoff.status <> 'active' THEN
    RAISE EXCEPTION 'Pickup handover is no longer active';
  END IF;

  IF now() >= v_handoff.expires_at THEN
    UPDATE public.pickup_handover_sessions
    SET status = 'expired', updated_at = now()
    WHERE id = v_handoff.id;
    RAISE EXCEPTION 'Pickup handover has expired';
  END IF;

  SELECT o.customer_id INTO v_customer_id
  FROM public.orders o
  WHERE o.id = v_handoff.order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_customer_id IS NOT NULL THEN
    PERFORM 1
    FROM public.customers c
    WHERE c.id = v_customer_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Customer record not found';
    END IF;
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_handoff.order_id
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

  IF COALESCE(v_order.payment_status, 'unpaid') <> 'paid' THEN
    RAISE EXCEPTION 'Payment must be verified before pickup';
  END IF;

  IF v_order.payment_method IS NULL
     OR v_order.payment_method NOT IN ('cash','qr_code','qr','promptpay_online') THEN
    RAISE EXCEPTION 'Valid payment method must be recorded before pickup';
  END IF;

  IF COALESCE(v_order.loyalty_discount_amount, 0) > 0 THEN
    IF v_order.amount_paid IS DISTINCT FROM round(v_order.total_amount - v_order.loyalty_discount_amount, 2) THEN
      RAISE EXCEPTION 'Discounted order payment amount is inconsistent';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.loyalty_redemptions r
      WHERE r.order_id = v_order.id
        AND r.status = 'reserved'
        AND (r.reward_snapshot ->> 'reward_type') IN ('fixed_discount','percentage_discount')
    ) THEN
      RAISE EXCEPTION 'Loyalty reward must be consumed by the payment flow before pickup';
    END IF;
  END IF;

  IF v_order.status NOT IN ('picked_up','completed') THEN
    UPDATE public.orders
    SET status = 'picked_up',
        picked_up_at = COALESCE(picked_up_at, now()),
        staff_id = COALESCE(staff_id, v_handoff.staff_id),
        updated_at = now()
    WHERE id = v_order.id
    RETURNING * INTO v_order;
  END IF;

  IF v_order.customer_id IS NOT NULL
     AND COALESCE(v_order.loyalty_points_earned, 0) > 0
     AND v_order.loyalty_points_awarded_at IS NULL THEN
    SELECT e.created_at INTO v_existing_earn_at
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
        v_handoff.staff_id,
        'Points awarded at pickup/completion',
        jsonb_build_object(
          'purchase_type', COALESCE(v_order.purchase_type, 'online'),
          'loyalty_rate', v_order.loyalty_multiplier,
          'gross_amount', v_order.total_amount,
          'loyalty_discount_amount', COALESCE(v_order.loyalty_discount_amount, 0),
          'amount_paid', v_order.amount_paid,
          'pickup_handover_id', v_handoff.id,
          'customer_receipt_confirmed', v_bypass_reason IS NULL
        )
      );
      v_existing_earn_at := now();
    END IF;

    UPDATE public.orders
    SET loyalty_points_awarded_at = COALESCE(v_existing_earn_at, now())
    WHERE id = v_order.id
    RETURNING * INTO v_order;
  END IF;

  UPDATE public.pickup_handover_sessions
  SET status = CASE WHEN v_bypass_reason IS NULL THEN 'confirmed' ELSE 'bypassed' END,
      customer_confirmed_at = CASE WHEN v_bypass_reason IS NULL THEN now() ELSE customer_confirmed_at END,
      completed_at = now(),
      bypass_reason = v_bypass_reason,
      updated_at = now()
  WHERE id = v_handoff.id
  RETURNING * INTO v_handoff;

  RETURN jsonb_build_object(
    'handover', to_jsonb(v_handoff),
    'order', to_jsonb(v_order),
    'idempotent_replay', false
  );
END;
$pickup$;

REVOKE ALL ON FUNCTION public.finalize_pickup_handover_v1(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_pickup_handover_v1(uuid,text) TO service_role;

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261010144000','pickup_handover_v1',ARRAY['-- JOKO TODAY Pickup Handover v1
-- Paid online orders are handed over by staff, then completed by a short-lived
-- customer receipt-confirmation QR. Only token hashes are persisted.

CREATE TABLE IF NOT EXISTS public.pickup_handover_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  staff_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT ''active''
    CHECK (status IN (''active'',''confirmed'',''bypassed'',''expired'',''cancelled'')),
  expires_at timestamptz NOT NULL,
  customer_confirmed_at timestamptz,
  completed_at timestamptz,
  bypass_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pickup_handover_sessions_order_idx
  ON public.pickup_handover_sessions(order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pickup_handover_sessions_staff_idx
  ON public.pickup_handover_sessions(staff_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS pickup_handover_sessions_one_active_per_order
  ON public.pickup_handover_sessions(order_id)
  WHERE status = ''active'';

ALTER TABLE public.pickup_handover_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pickup_handover_sessions FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.pickup_handover_sessions IS
''Short-lived pickup handover sessions. Staff initiates handover; customer receipt confirmation or an audited staff bypass completes pickup. Plain bearer tokens are never stored.'';

CREATE OR REPLACE FUNCTION public.finalize_pickup_handover_v1(
  p_handoff_id uuid,
  p_bypass_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''public''
AS $pickup$
DECLARE
  v_role text := COALESCE(auth.role(), '''');
  v_handoff public.pickup_handover_sessions%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_customer_id uuid;
  v_existing_earn_at timestamptz;
  v_bypass_reason text := NULLIF(btrim(COALESCE(p_bypass_reason, '''')), '''');
BEGIN
  IF v_role <> ''service_role'' THEN
    RAISE EXCEPTION ''Service role required'' USING ERRCODE = ''42501'';
  END IF;

  IF p_handoff_id IS NULL THEN
    RAISE EXCEPTION ''Handover id is required'';
  END IF;

  SELECT * INTO v_handoff
  FROM public.pickup_handover_sessions
  WHERE id = p_handoff_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION ''Pickup handover not found'';
  END IF;

  IF v_handoff.status IN (''confirmed'',''bypassed'') THEN
    SELECT * INTO v_order FROM public.orders WHERE id = v_handoff.order_id;
    RETURN jsonb_build_object(
      ''handover'', to_jsonb(v_handoff),
      ''order'', to_jsonb(v_order),
      ''idempotent_replay'', true
    );
  END IF;

  IF v_handoff.status <> ''active'' THEN
    RAISE EXCEPTION ''Pickup handover is no longer active'';
  END IF;

  IF now() >= v_handoff.expires_at THEN
    UPDATE public.pickup_handover_sessions
    SET status = ''expired'', updated_at = now()
    WHERE id = v_handoff.id;
    RAISE EXCEPTION ''Pickup handover has expired'';
  END IF;

  SELECT o.customer_id INTO v_customer_id
  FROM public.orders o
  WHERE o.id = v_handoff.order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION ''Order not found'';
  END IF;

  IF v_customer_id IS NOT NULL THEN
    PERFORM 1
    FROM public.customers c
    WHERE c.id = v_customer_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION ''Customer record not found'';
    END IF;
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_handoff.order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION ''Order not found'';
  END IF;

  IF v_order.customer_id IS DISTINCT FROM v_customer_id THEN
    RAISE EXCEPTION ''Order customer changed while confirming pickup; retry'';
  END IF;

  IF v_order.status = ''cancelled'' THEN
    RAISE EXCEPTION ''Cancelled orders cannot be picked up'';
  END IF;

  IF COALESCE(v_order.payment_status, ''unpaid'') <> ''paid'' THEN
    RAISE EXCEPTION ''Payment must be verified before pickup'';
  END IF;

  IF v_order.payment_method IS NULL
     OR v_order.payment_method NOT IN (''cash'',''qr_code'',''qr'',''promptpay_online'') THEN
    RAISE EXCEPTION ''Valid payment method must be recorded before pickup'';
  END IF;

  IF COALESCE(v_order.loyalty_discount_amount, 0) > 0 THEN
    IF v_order.amount_paid IS DISTINCT FROM round(v_order.total_amount - v_order.loyalty_discount_amount, 2) THEN
      RAISE EXCEPTION ''Discounted order payment amount is inconsistent'';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.loyalty_redemptions r
      WHERE r.order_id = v_order.id
        AND r.status = ''reserved''
        AND (r.reward_snapshot ->> ''reward_type'') IN (''fixed_discount'',''percentage_discount'')
    ) THEN
      RAISE EXCEPTION ''Loyalty reward must be consumed by the payment flow before pickup'';
    END IF;
  END IF;

  IF v_order.status NOT IN (''picked_up'',''completed'') THEN
    UPDATE public.orders
    SET status = ''picked_up'',
        picked_up_at = COALESCE(picked_up_at, now()),
        staff_id = COALESCE(staff_id, v_handoff.staff_id),
        updated_at = now()
    WHERE id = v_order.id
    RETURNING * INTO v_order;
  END IF;

  IF v_order.customer_id IS NOT NULL
     AND COALESCE(v_order.loyalty_points_earned, 0) > 0
     AND v_order.loyalty_points_awarded_at IS NULL THEN
    SELECT e.created_at INTO v_existing_earn_at
    FROM public.loyalty_point_events e
    WHERE e.order_id = v_order.id
      AND e.event_type = ''earn''
    LIMIT 1;

    IF v_existing_earn_at IS NULL THEN
      PERFORM public.apply_loyalty_points_delta_v2(
        v_order.customer_id,
        v_order.loyalty_points_earned,
        ''earn'',
        v_order.id,
        NULL,
        v_handoff.staff_id,
        ''Points awarded at pickup/completion'',
        jsonb_build_object(
          ''purchase_type'', COALESCE(v_order.purchase_type, ''online''),
          ''loyalty_rate'', v_order.loyalty_multiplier,
          ''gross_amount'', v_order.total_amount,
          ''loyalty_discount_amount'', COALESCE(v_order.loyalty_discount_amount, 0),
          ''amount_paid'', v_order.amount_paid,
          ''pickup_handover_id'', v_handoff.id,
          ''customer_receipt_confirmed'', v_bypass_reason IS NULL
        )
      );
      v_existing_earn_at := now();
    END IF;

    UPDATE public.orders
    SET loyalty_points_awarded_at = COALESCE(v_existing_earn_at, now())
    WHERE id = v_order.id
    RETURNING * INTO v_order;
  END IF;

  UPDATE public.pickup_handover_sessions
  SET status = CASE WHEN v_bypass_reason IS NULL THEN ''confirmed'' ELSE ''bypassed'' END,
      customer_confirmed_at = CASE WHEN v_bypass_reason IS NULL THEN now() ELSE customer_confirmed_at END,
      completed_at = now(),
      bypass_reason = v_bypass_reason,
      updated_at = now()
  WHERE id = v_handoff.id
  RETURNING * INTO v_handoff;

  RETURN jsonb_build_object(
    ''handover'', to_jsonb(v_handoff),
    ''order'', to_jsonb(v_order),
    ''idempotent_replay'', false
  );
END;
$pickup$;

REVOKE ALL ON FUNCTION public.finalize_pickup_handover_v1(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_pickup_handover_v1(uuid,text) TO service_role;
']);

-- 20261011161020_joko_specials_catalogue_products_v1.sql
-- Specials may contain any active catalogue product, including other makers
-- and non-bakery categories. Preserve the existing admin and stock controls.
DO $catalogue$
DECLARE
  target regprocedure := coalesce(
    to_regprocedure('specials_private.preparation_action(text,jsonb,uuid)'),
    to_regprocedure('specials_private.admin_action(text,jsonb,uuid)'));
  definition text;
  provenance_guard text := $guard$    IF (p_request->>'made_by_joko_confirmed')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'Confirm this product is made by JOKO'; END IF;$guard$;
BEGIN
  IF target IS NULL THEN RAISE EXCEPTION 'Specials preparation function missing'; END IF;
  definition := pg_get_functiondef(target);
  IF strpos(definition, provenance_guard) = 0
     OR strpos(definition, 'made_by_joko_confirmed_by') = 0 THEN
    RAISE EXCEPTION 'Unexpected Specials preparation function; review before applying';
  END IF;
  definition := replace(definition, provenance_guard, '');
  definition := replace(definition, 'made_by_joko_confirmed_by', 'created_by');
  definition := replace(definition, 'Offer price and Made by JOKO attestation', 'Catalogue offer and price setup');
  ALTER TABLE public.specials_items RENAME COLUMN made_by_joko_confirmed_by TO created_by;
  EXECUTE definition;
END;
$catalogue$;
COMMENT ON COLUMN public.specials_items.created_by IS
'Admin who created the Specials offer. Historical values retain the original attesting admin; no maker restriction applies to new offers.';

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261011161020','joko_specials_catalogue_products_v1',ARRAY['-- Specials may contain any active catalogue product, including other makers
-- and non-bakery categories. Preserve the existing admin and stock controls.
DO $catalogue$
DECLARE
  target regprocedure := coalesce(
    to_regprocedure(''specials_private.preparation_action(text,jsonb,uuid)''),
    to_regprocedure(''specials_private.admin_action(text,jsonb,uuid)''));
  definition text;
  provenance_guard text := $guard$    IF (p_request->>''made_by_joko_confirmed'')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION ''Confirm this product is made by JOKO''; END IF;$guard$;
BEGIN
  IF target IS NULL THEN RAISE EXCEPTION ''Specials preparation function missing''; END IF;
  definition := pg_get_functiondef(target);
  IF strpos(definition, provenance_guard) = 0
     OR strpos(definition, ''made_by_joko_confirmed_by'') = 0 THEN
    RAISE EXCEPTION ''Unexpected Specials preparation function; review before applying'';
  END IF;
  definition := replace(definition, provenance_guard, '''');
  definition := replace(definition, ''made_by_joko_confirmed_by'', ''created_by'');
  definition := replace(definition, ''Offer price and Made by JOKO attestation'', ''Catalogue offer and price setup'');
  ALTER TABLE public.specials_items RENAME COLUMN made_by_joko_confirmed_by TO created_by;
  EXECUTE definition;
END;
$catalogue$;
COMMENT ON COLUMN public.specials_items.created_by IS
''Admin who created the Specials offer. Historical values retain the original attesting admin; no maker restriction applies to new offers.'';
']);

-- 20261012094221_joko_specials_pickup_handover_v1.sql
-- Shared receipt QR infrastructure, with Specials eligibility enforced at both ends.
ALTER TABLE public.pickup_handover_sessions ADD COLUMN pickup_location_id uuid REFERENCES public.cms_pickup_locations(id);

CREATE FUNCTION specials_private.handover_eligible(p_order uuid,p_location uuid,p_staff uuid)
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.specials_checkouts%ROWTYPE; b public.specials_batches%ROWTYPE; o public.orders%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles u WHERE u.id=p_staff AND
   (u.role::text='admin' OR (u.role::text='staff' AND EXISTS(SELECT 1 FROM specials_private.staff_locations s WHERE s.user_id=u.id AND s.location_id=p_location)))) THEN
   RAISE EXCEPTION 'Not authorized for this pickup location' USING ERRCODE='42501';
 END IF;
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order;
 IF NOT FOUND THEN RAISE EXCEPTION 'Specials checkout not found'; END IF;
 SELECT * INTO b FROM public.specials_batches WHERE id=c.batch_id FOR UPDATE;
 PERFORM specials_private.reap_batch(b.id);
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order FOR UPDATE;
 SELECT * INTO o FROM public.orders WHERE id=p_order FOR UPDATE;
 IF o.order_type<>'specials' OR o.pickup_location_id IS DISTINCT FROM p_location THEN RAISE EXCEPTION 'Wrong Specials pickup location'; END IF;
 IF c.inventory_state<>'committed' OR c.financial_state<>'verified' OR c.fulfillment_state<>'ready'
    OR o.status<>'confirmed' OR o.payment_status<>'paid' OR o.amount_paid IS DISTINCT FROM o.total_amount THEN
    RAISE EXCEPTION 'Payment is not complete or order is not eligible';
 END IF;
 IF clock_timestamp()<(o.specials_pickup_snapshot->>'start_at')::timestamptz
    OR clock_timestamp()>=(o.specials_pickup_snapshot->>'end_at')::timestamptz
    OR b.business_date<>(clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date THEN
    RAISE EXCEPTION 'Outside same-day pickup window';
 END IF;
 RETURN o;
END $$;
REVOKE ALL ON FUNCTION specials_private.handover_eligible(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.create_specials_pickup_handover_v1(p_order uuid,p_location uuid,p_staff uuid,p_token_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.orders%ROWTYPE; h public.pickup_handover_sessions%ROWTYPE;
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
 IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid token hash'; END IF;
 o:=specials_private.handover_eligible(p_order,p_location,p_staff);
 UPDATE public.pickup_handover_sessions SET status='cancelled',updated_at=clock_timestamp() WHERE order_id=p_order AND status='active';
 INSERT INTO public.pickup_handover_sessions(order_id,customer_id,staff_id,token_hash,expires_at,pickup_location_id)
 VALUES(p_order,o.customer_id,p_staff,p_token_hash,least(clock_timestamp()+interval '15 minutes',(o.specials_pickup_snapshot->>'end_at')::timestamptz),p_location)
 RETURNING * INTO h;
 RETURN jsonb_build_object('state','active','handoffId',h.id,'expiresAt',h.expires_at,'orderNumber',o.order_number);
END $$;
REVOKE ALL ON FUNCTION public.create_specials_pickup_handover_v1(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_specials_pickup_handover_v1(uuid,uuid,uuid,text) TO service_role;

ALTER FUNCTION public.finalize_pickup_handover_v1(uuid,text) RENAME TO finalize_regular_pickup_handover_v1;
DO $guard$
DECLARE definition text;
BEGIN
 definition:=pg_get_functiondef('public.finalize_regular_pickup_handover_v1(uuid,text)'::regprocedure);
 IF strpos(definition,'IF p_handoff_id IS NULL THEN')=0 THEN RAISE EXCEPTION 'Unexpected regular handover function'; END IF;
 definition:=replace(definition,'IF p_handoff_id IS NULL THEN',
  'IF EXISTS(SELECT 1 FROM public.pickup_handover_sessions h JOIN public.orders o ON o.id=h.order_id WHERE h.id=p_handoff_id AND o.order_type=''specials'') THEN RAISE EXCEPTION ''Use the Specials handover workflow''; END IF; IF p_handoff_id IS NULL THEN');
 EXECUTE definition;
END $guard$;
CREATE FUNCTION public.finalize_pickup_handover_v1(p_handoff_id uuid,p_bypass_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE h public.pickup_handover_sessions%ROWTYPE; o public.orders%ROWTYPE;
 reason text:=nullif(btrim(coalesce(p_bypass_reason,'')),'');
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
 SELECT * INTO h FROM public.pickup_handover_sessions WHERE id=p_handoff_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pickup handover not found'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=h.order_id;
 IF o.order_type<>'specials' THEN RETURN public.finalize_regular_pickup_handover_v1(p_handoff_id,p_bypass_reason); END IF;
 PERFORM 1 FROM public.specials_batches b JOIN public.specials_checkouts c ON c.batch_id=b.id WHERE c.order_id=h.order_id FOR UPDATE OF b;
 SELECT * INTO h FROM public.pickup_handover_sessions WHERE id=p_handoff_id FOR UPDATE;
 SELECT * INTO o FROM public.orders WHERE id=h.order_id;
 IF h.status IN ('confirmed','bypassed') THEN RETURN jsonb_build_object('handover',to_jsonb(h),'order',to_jsonb(o),'idempotent_replay',true); END IF;
 IF h.status<>'active' OR clock_timestamp()>=h.expires_at THEN RAISE EXCEPTION 'Pickup handover is inactive or expired'; END IF;
 IF reason IS NOT NULL AND length(reason) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'A short bypass reason is required'; END IF;
 o:=specials_private.handover_eligible(h.order_id,h.pickup_location_id,h.staff_id);
 IF o.customer_id IS DISTINCT FROM h.customer_id THEN RAISE EXCEPTION 'Order customer changed'; END IF;
 UPDATE public.specials_checkouts SET fulfillment_state='picked_up',updated_at=clock_timestamp() WHERE order_id=o.id;
 UPDATE public.orders SET status='picked_up',picked_up_at=clock_timestamp(),staff_id=h.staff_id,loyalty_points_earned=0,updated_at=clock_timestamp() WHERE id=o.id RETURNING * INTO o;
 UPDATE public.pickup_handover_sessions SET status=CASE WHEN reason IS NULL THEN 'confirmed' ELSE 'bypassed' END,
  customer_confirmed_at=CASE WHEN reason IS NULL THEN clock_timestamp() ELSE NULL END,completed_at=clock_timestamp(),bypass_reason=reason,updated_at=clock_timestamp()
 WHERE id=h.id RETURNING * INTO h;
 RETURN jsonb_build_object('handover',to_jsonb(h),'order',to_jsonb(o),'idempotent_replay',false);
END $$;
REVOKE ALL ON FUNCTION public.finalize_pickup_handover_v1(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_pickup_handover_v1(uuid,text) TO service_role;
-- Close the legacy staff-only shortcut; explicit audited fallback uses the shared QR session.
CREATE OR REPLACE FUNCTION specials_private.pickup(p_order uuid,p_location uuid) RETURNS SETOF public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Use the pickup handover and customer receipt confirmation workflow'; END $$;

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261012094221','joko_specials_pickup_handover_v1',ARRAY['-- Shared receipt QR infrastructure, with Specials eligibility enforced at both ends.
ALTER TABLE public.pickup_handover_sessions ADD COLUMN pickup_location_id uuid REFERENCES public.cms_pickup_locations(id);

CREATE FUNCTION specials_private.handover_eligible(p_order uuid,p_location uuid,p_staff uuid)
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS $$
DECLARE c public.specials_checkouts%ROWTYPE; b public.specials_batches%ROWTYPE; o public.orders%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles u WHERE u.id=p_staff AND
   (u.role::text=''admin'' OR (u.role::text=''staff'' AND EXISTS(SELECT 1 FROM specials_private.staff_locations s WHERE s.user_id=u.id AND s.location_id=p_location)))) THEN
   RAISE EXCEPTION ''Not authorized for this pickup location'' USING ERRCODE=''42501'';
 END IF;
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order;
 IF NOT FOUND THEN RAISE EXCEPTION ''Specials checkout not found''; END IF;
 SELECT * INTO b FROM public.specials_batches WHERE id=c.batch_id FOR UPDATE;
 PERFORM specials_private.reap_batch(b.id);
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order FOR UPDATE;
 SELECT * INTO o FROM public.orders WHERE id=p_order FOR UPDATE;
 IF o.order_type<>''specials'' OR o.pickup_location_id IS DISTINCT FROM p_location THEN RAISE EXCEPTION ''Wrong Specials pickup location''; END IF;
 IF c.inventory_state<>''committed'' OR c.financial_state<>''verified'' OR c.fulfillment_state<>''ready''
    OR o.status<>''confirmed'' OR o.payment_status<>''paid'' OR o.amount_paid IS DISTINCT FROM o.total_amount THEN
    RAISE EXCEPTION ''Payment is not complete or order is not eligible'';
 END IF;
 IF clock_timestamp()<(o.specials_pickup_snapshot->>''start_at'')::timestamptz
    OR clock_timestamp()>=(o.specials_pickup_snapshot->>''end_at'')::timestamptz
    OR b.business_date<>(clock_timestamp() AT TIME ZONE ''Asia/Bangkok'')::date THEN
    RAISE EXCEPTION ''Outside same-day pickup window'';
 END IF;
 RETURN o;
END $$;
REVOKE ALL ON FUNCTION specials_private.handover_eligible(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.create_specials_pickup_handover_v1(p_order uuid,p_location uuid,p_staff uuid,p_token_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS $$
DECLARE o public.orders%ROWTYPE; h public.pickup_handover_sessions%ROWTYPE;
BEGIN
 IF coalesce(auth.role(),'''')<>''service_role'' THEN RAISE EXCEPTION ''Service role required'' USING ERRCODE=''42501''; END IF;
 IF p_token_hash IS NULL OR p_token_hash !~ ''^[0-9a-f]{64}$'' THEN RAISE EXCEPTION ''Invalid token hash''; END IF;
 o:=specials_private.handover_eligible(p_order,p_location,p_staff);
 UPDATE public.pickup_handover_sessions SET status=''cancelled'',updated_at=clock_timestamp() WHERE order_id=p_order AND status=''active'';
 INSERT INTO public.pickup_handover_sessions(order_id,customer_id,staff_id,token_hash,expires_at,pickup_location_id)
 VALUES(p_order,o.customer_id,p_staff,p_token_hash,least(clock_timestamp()+interval ''15 minutes'',(o.specials_pickup_snapshot->>''end_at'')::timestamptz),p_location)
 RETURNING * INTO h;
 RETURN jsonb_build_object(''state'',''active'',''handoffId'',h.id,''expiresAt'',h.expires_at,''orderNumber'',o.order_number);
END $$;
REVOKE ALL ON FUNCTION public.create_specials_pickup_handover_v1(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_specials_pickup_handover_v1(uuid,uuid,uuid,text) TO service_role;

ALTER FUNCTION public.finalize_pickup_handover_v1(uuid,text) RENAME TO finalize_regular_pickup_handover_v1;
DO $guard$
DECLARE definition text;
BEGIN
 definition:=pg_get_functiondef(''public.finalize_regular_pickup_handover_v1(uuid,text)''::regprocedure);
 IF strpos(definition,''IF p_handoff_id IS NULL THEN'')=0 THEN RAISE EXCEPTION ''Unexpected regular handover function''; END IF;
 definition:=replace(definition,''IF p_handoff_id IS NULL THEN'',
  ''IF EXISTS(SELECT 1 FROM public.pickup_handover_sessions h JOIN public.orders o ON o.id=h.order_id WHERE h.id=p_handoff_id AND o.order_type=''''specials'''') THEN RAISE EXCEPTION ''''Use the Specials handover workflow''''; END IF; IF p_handoff_id IS NULL THEN'');
 EXECUTE definition;
END $guard$;
CREATE FUNCTION public.finalize_pickup_handover_v1(p_handoff_id uuid,p_bypass_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS $$
DECLARE h public.pickup_handover_sessions%ROWTYPE; o public.orders%ROWTYPE;
 reason text:=nullif(btrim(coalesce(p_bypass_reason,'''')),'''');
BEGIN
 IF coalesce(auth.role(),'''')<>''service_role'' THEN RAISE EXCEPTION ''Service role required'' USING ERRCODE=''42501''; END IF;
 SELECT * INTO h FROM public.pickup_handover_sessions WHERE id=p_handoff_id;
 IF NOT FOUND THEN RAISE EXCEPTION ''Pickup handover not found''; END IF;
 SELECT * INTO o FROM public.orders WHERE id=h.order_id;
 IF o.order_type<>''specials'' THEN RETURN public.finalize_regular_pickup_handover_v1(p_handoff_id,p_bypass_reason); END IF;
 PERFORM 1 FROM public.specials_batches b JOIN public.specials_checkouts c ON c.batch_id=b.id WHERE c.order_id=h.order_id FOR UPDATE OF b;
 SELECT * INTO h FROM public.pickup_handover_sessions WHERE id=p_handoff_id FOR UPDATE;
 SELECT * INTO o FROM public.orders WHERE id=h.order_id;
 IF h.status IN (''confirmed'',''bypassed'') THEN RETURN jsonb_build_object(''handover'',to_jsonb(h),''order'',to_jsonb(o),''idempotent_replay'',true); END IF;
 IF h.status<>''active'' OR clock_timestamp()>=h.expires_at THEN RAISE EXCEPTION ''Pickup handover is inactive or expired''; END IF;
 IF reason IS NOT NULL AND length(reason) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION ''A short bypass reason is required''; END IF;
 o:=specials_private.handover_eligible(h.order_id,h.pickup_location_id,h.staff_id);
 IF o.customer_id IS DISTINCT FROM h.customer_id THEN RAISE EXCEPTION ''Order customer changed''; END IF;
 UPDATE public.specials_checkouts SET fulfillment_state=''picked_up'',updated_at=clock_timestamp() WHERE order_id=o.id;
 UPDATE public.orders SET status=''picked_up'',picked_up_at=clock_timestamp(),staff_id=h.staff_id,loyalty_points_earned=0,updated_at=clock_timestamp() WHERE id=o.id RETURNING * INTO o;
 UPDATE public.pickup_handover_sessions SET status=CASE WHEN reason IS NULL THEN ''confirmed'' ELSE ''bypassed'' END,
  customer_confirmed_at=CASE WHEN reason IS NULL THEN clock_timestamp() ELSE NULL END,completed_at=clock_timestamp(),bypass_reason=reason,updated_at=clock_timestamp()
 WHERE id=h.id RETURNING * INTO h;
 RETURN jsonb_build_object(''handover'',to_jsonb(h),''order'',to_jsonb(o),''idempotent_replay'',false);
END $$;
REVOKE ALL ON FUNCTION public.finalize_pickup_handover_v1(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_pickup_handover_v1(uuid,text) TO service_role;
-- Close the legacy staff-only shortcut; explicit audited fallback uses the shared QR session.
CREATE OR REPLACE FUNCTION specials_private.pickup(p_order uuid,p_location uuid) RETURNS SETOF public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS $$
BEGIN RAISE EXCEPTION ''Use the pickup handover and customer receipt confirmation workflow''; END $$;
']);

-- 20261012100247_joko_specials_main_payment_guards_v1.sql
-- Later regular payment migrations replace these functions. Reapply Specials
-- boundaries after the current main migrations while preserving regular bodies.
DO $guards$
DECLARE f record; definition text; injection text;
BEGIN
 FOR f IN SELECT p.oid,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('finalize_verified_payment_v1','cancel_online_order_v2') LOOP
  definition:=pg_get_functiondef(f.oid);
  IF definition !~* E'\\mBEGIN\\M[[:space:]]*\n' THEN RAISE EXCEPTION 'Unexpected payment function: %',f.proname; END IF;
  IF f.proname='finalize_verified_payment_v1' THEN
   injection:=E'BEGIN\n  PERFORM pg_advisory_xact_lock(hashtextextended(''easyslip:''||p_provider_transaction_ref,811));\n  IF EXISTS(SELECT 1 FROM specials_private.receipts WHERE provider_ref=p_provider_transaction_ref) OR EXISTS(SELECT 1 FROM public.orders o JOIN public.payment_transactions t ON t.order_id=o.id WHERE t.id=p_payment_transaction_id AND o.order_type=''specials'') THEN RAISE EXCEPTION ''Use Specials payment verification''; END IF;\n';
  ELSE
   injection:=E'BEGIN\n  IF EXISTS(SELECT 1 FROM public.orders WHERE id=p_order_id AND order_type=''specials'') THEN RAISE EXCEPTION ''Use the authorized Specials workflow''; END IF;\n';
  END IF;
  EXECUTE regexp_replace(definition,E'\\mBEGIN\\M[[:space:]]*\n',injection,'i');
 END LOOP;
END $guards$;

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261012100247','joko_specials_main_payment_guards_v1',ARRAY['-- Later regular payment migrations replace these functions. Reapply Specials
-- boundaries after the current main migrations while preserving regular bodies.
DO $guards$
DECLARE f record; definition text; injection text;
BEGIN
 FOR f IN SELECT p.oid,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname=''public'' AND p.proname IN (''finalize_verified_payment_v1'',''cancel_online_order_v2'') LOOP
  definition:=pg_get_functiondef(f.oid);
  IF definition !~* E''\\mBEGIN\\M[[:space:]]*\n'' THEN RAISE EXCEPTION ''Unexpected payment function: %'',f.proname; END IF;
  IF f.proname=''finalize_verified_payment_v1'' THEN
   injection:=E''BEGIN\n  PERFORM pg_advisory_xact_lock(hashtextextended(''''easyslip:''''||p_provider_transaction_ref,811));\n  IF EXISTS(SELECT 1 FROM specials_private.receipts WHERE provider_ref=p_provider_transaction_ref) OR EXISTS(SELECT 1 FROM public.orders o JOIN public.payment_transactions t ON t.order_id=o.id WHERE t.id=p_payment_transaction_id AND o.order_type=''''specials'''') THEN RAISE EXCEPTION ''''Use Specials payment verification''''; END IF;\n'';
  ELSE
   injection:=E''BEGIN\n  IF EXISTS(SELECT 1 FROM public.orders WHERE id=p_order_id AND order_type=''''specials'''') THEN RAISE EXCEPTION ''''Use the authorized Specials workflow''''; END IF;\n'';
  END IF;
  EXECUTE regexp_replace(definition,E''\\mBEGIN\\M[[:space:]]*\n'',injection,''i'');
 END LOOP;
END $guards$;
']);

-- 20261012144155_joko_specials_dual_payment_rails_v1.sql
-- New checkouts default to Stripe. Existing snapshots retain their original rail.
ALTER TABLE specials_private.settings ADD COLUMN payment_mode text NOT NULL DEFAULT 'stripe_promptpay' CHECK(payment_mode IN ('stripe_promptpay','kshop_master'));
ALTER TABLE public.specials_checkouts ADD COLUMN payment_mode text NOT NULL DEFAULT 'kshop_master' CHECK(payment_mode IN ('stripe_promptpay','kshop_master'));
ALTER TABLE specials_private.settings DROP CONSTRAINT specials_static_merchant_qr;
ALTER TABLE specials_private.settings ADD CONSTRAINT specials_static_merchant_qr CHECK(NOT enabled OR payment_mode='stripe_promptpay' OR specials_private.valid_merchant_qr(qr_payload));

ALTER FUNCTION specials_private.admin_action(text,jsonb,uuid) RENAME TO single_rail_admin_action;
CREATE FUNCTION specials_private.admin_action(p_action text,p_request jsonb,p_operation_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s specials_private.settings%ROWTYPE; mode text:=coalesce(p_request->>'payment_mode','stripe_promptpay');
BEGIN
 IF p_action IS DISTINCT FROM 'settings' THEN RETURN specials_private.single_rail_admin_action(p_action,p_request,p_operation_key); END IF;
 IF NOT specials_private.is_admin() OR p_operation_key IS NULL THEN RAISE EXCEPTION 'Admin and operation key required' USING ERRCODE='42501'; END IF;
 IF mode NOT IN ('stripe_promptpay','kshop_master') THEN RAISE EXCEPTION 'Unsupported payment method'; END IF;
 IF mode='kshop_master' AND coalesce((p_request->>'enabled')::boolean,false) AND
 (NOT specials_private.valid_merchant_qr(p_request->>'qr_payload') OR coalesce(p_request->>'receiver_bank_code','')='' OR length(regexp_replace(coalesce(p_request->>'receiver_bank_number',''),'[^0-9]','','g'))<6 OR coalesce(p_request->>'receiver_label','')='') THEN RAISE EXCEPTION 'Approved merchant QR and exact registered receiver required'; END IF;
 UPDATE specials_private.settings SET payment_mode=mode,enabled=coalesce((p_request->>'enabled')::boolean,false),qr_payload=coalesce(p_request->>'qr_payload',''),receiver_bank_code=upper(trim(coalesce(p_request->>'receiver_bank_code',''))),receiver_bank_number=coalesce(p_request->>'receiver_bank_number',''),receiver_label=coalesce(p_request->>'receiver_label',''),updated_by=auth.uid(),updated_at=clock_timestamp() WHERE id RETURNING * INTO s;
 RETURN jsonb_build_object('settings',to_jsonb(s));
END $$;
REVOKE ALL ON FUNCTION specials_private.single_rail_admin_action(text,jsonb,uuid),specials_private.admin_action(text,jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION specials_private.admin_action(text,jsonb,uuid) TO authenticated;

DO $patch$
DECLARE definition text;
BEGIN
 definition:=pg_get_functiondef('specials_private.checkout(uuid,jsonb,uuid)'::regprocedure);
 IF strpos(definition,'operation_key,request,inventory_state,payment_deadline')=0 THEN RAISE EXCEPTION 'Unexpected checkout function'; END IF;
 definition:=replace(definition,'operation_key,request,inventory_state,payment_deadline','operation_key,request,payment_mode,inventory_state,payment_deadline');
 definition:=replace(definition,'VALUES(oid,b.id,auth.uid(),p_key,p_cart,''held'',','VALUES(oid,b.id,auth.uid(),p_key,p_cart,s.payment_mode,''held'',');
 definition:=replace(definition,'IF t>=b.sales_end_at-interval ''5 minutes''', 'IF s.payment_mode=''stripe_promptpay'' AND total<1000 THEN RAISE EXCEPTION ''Stripe PromptPay requires at least THB 10''; END IF; IF t>=b.sales_end_at-interval ''5 minutes''');
 EXECUTE definition;
 -- EasySlip cannot attest to a checkout frozen to Stripe.
 definition:=pg_get_functiondef('specials_private.begin_verification(uuid,uuid,uuid,text)'::regprocedure);
 definition:=replace(definition,'IF NOT FOUND THEN RAISE EXCEPTION ''Checkout not found''; END IF;', 'IF NOT FOUND THEN RAISE EXCEPTION ''Checkout not found''; END IF; IF c.payment_mode<>''kshop_master'' THEN RAISE EXCEPTION ''This checkout requires Stripe payment''; END IF;');
 EXECUTE definition;
 -- Return the frozen rail and existing transaction ID to the owner, never credentials.
 definition:=pg_get_functiondef('specials_private.customer_state(uuid,boolean)'::regprocedure);
 definition:=replace(definition,'''checkout'',to_jsonb(c),','''payment'',(SELECT jsonb_build_object(''id'',id,''mode'',payment_mode) FROM public.payment_transactions WHERE order_id=c.order_id),''checkout'',to_jsonb(c),');
 EXECUTE definition;
 -- The regular minimum trigger must not select the Specials rail globally.
 IF to_regprocedure('public.enforce_online_payment_provider_minimum_v1()') IS NOT NULL THEN
  definition:=pg_get_functiondef('public.enforce_online_payment_provider_minimum_v1()'::regprocedure);
  EXECUTE regexp_replace(definition,E'\\mBEGIN\\M[[:space:]]*\n',E'BEGIN\n IF NEW.order_type=''specials'' THEN RETURN NEW; END IF;\n','i');
 END IF;
END $patch$;
CREATE OR REPLACE FUNCTION specials_private.pin_payment_mode() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE mode text;
BEGIN
 IF EXISTS(SELECT 1 FROM public.orders WHERE id=NEW.order_id AND order_type='specials') THEN
  SELECT payment_mode INTO mode FROM public.specials_checkouts WHERE order_id=NEW.order_id;
  IF mode IS NULL THEN RAISE EXCEPTION 'Specials checkout snapshot missing'; END IF;
  NEW.payment_mode:=mode; NEW.provider:=CASE WHEN mode='stripe_promptpay' THEN 'stripe' ELSE 'easyslip' END; NEW.rail:='promptpay';
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION public.specials_finish_stripe_v1(p_order uuid,p_intent text,p_amount_satang integer,p_paid_at timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.specials_checkouts%ROWTYPE; b public.specials_batches%ROWTYPE; o public.orders%ROWTYPE; t public.payment_transactions%ROWTYPE; r specials_private.receipts%ROWTYPE; l record; good boolean; ref text:='stripe:'||p_intent;
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order;
 IF NOT FOUND OR c.payment_mode<>'stripe_promptpay' THEN RAISE EXCEPTION 'Not a Stripe Specials checkout'; END IF;
 SELECT * INTO b FROM public.specials_batches WHERE id=c.batch_id FOR UPDATE;
 PERFORM specials_private.reap_batch(b.id);
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order FOR UPDATE;
 SELECT * INTO o FROM public.orders WHERE id=p_order FOR UPDATE;
 SELECT * INTO t FROM public.payment_transactions WHERE order_id=p_order FOR UPDATE;
 IF t.provider<>'stripe' OR t.provider_transaction_ref IS DISTINCT FROM p_intent OR p_amount_satang IS DISTINCT FROM round(o.total_amount*100)::integer OR p_paid_at IS NULL THEN RAISE EXCEPTION 'Stripe payment evidence mismatch'; END IF;
 SELECT * INTO r FROM specials_private.receipts WHERE provider_ref=ref;
 IF FOUND AND r.order_id IS DISTINCT FROM p_order THEN RAISE EXCEPTION 'Stripe receipt belongs to another order'; END IF;
 IF FOUND THEN RETURN jsonb_build_object('state',CASE WHEN r.disposition='credited' THEN 'verified' WHEN r.disposition='refunded' THEN 'refunded' ELSE 'refund_required' END); END IF;
 good:=c.inventory_state='held' AND clock_timestamp()<c.payment_deadline AND p_paid_at>=date_trunc('second',c.created_at) AND p_paid_at<=c.payment_deadline AND b.status<>'cancelled';
 INSERT INTO specials_private.receipts(provider_ref,order_id,amount,received_at,disposition) VALUES(ref,p_order,o.total_amount,p_paid_at,CASE WHEN good THEN 'credited' ELSE 'refund_pending' END);
 IF NOT good THEN
  PERFORM specials_private.release_hold(p_order,'expired');
  UPDATE public.specials_checkouts SET financial_state='refund_pending',updated_at=clock_timestamp() WHERE order_id=p_order;
  RETURN jsonb_build_object('state','refund_required');
 END IF;
 FOR l IN SELECT * FROM specials_private.hold_lines WHERE order_id=p_order ORDER BY item_id LOOP
  UPDATE public.specials_items SET quantity_held=quantity_held-l.quantity,quantity_committed=quantity_committed+l.quantity,version=version+1,updated_at=clock_timestamp() WHERE id=l.item_id;
 END LOOP;
 UPDATE public.specials_checkouts SET inventory_state='committed',financial_state='verified',fulfillment_state='ready',updated_at=clock_timestamp() WHERE order_id=p_order;
 UPDATE public.orders SET payment_status='paid',payment_method='promptpay_online',amount_paid=total_amount,status='confirmed',loyalty_points_earned=0,loyalty_multiplier=0,updated_at=clock_timestamp() WHERE id=p_order;
 UPDATE public.payment_transactions SET status='verified',verified_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=t.id;
 INSERT INTO public.order_notification_events(order_id,notification_type,status) VALUES(p_order,'payment_confirmation','pending'),(p_order,'admin_new_order','pending') ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('state','verified');
END $$;
REVOKE ALL ON FUNCTION public.specials_finish_stripe_v1(uuid,text,integer,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.specials_finish_stripe_v1(uuid,text,integer,timestamptz) TO service_role;

CREATE FUNCTION public.specials_stripe_refund_v1(p_order uuid,p_intent text,p_refund text,p_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE receipt specials_private.receipts%ROWTYPE;
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
 IF p_refund IS NULL OR p_refund !~ '^re_' OR p_status NOT IN ('pending','succeeded','failed','canceled','requires_action') THEN RAISE EXCEPTION 'Invalid refund evidence'; END IF;
 -- This handler owns refunds for released holds only; ordinary Admin refunds use their own workflow.
 SELECT * INTO receipt FROM specials_private.receipts WHERE order_id=p_order AND provider_ref='stripe:'||p_intent FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Refund receipt not found'; END IF;
 IF receipt.disposition IN ('refunded','credited') THEN RETURN; END IF;
 UPDATE specials_private.receipts SET refund_reference=p_refund,refund_reason='Stripe payment after stock hold release',disposition=CASE WHEN p_status='succeeded' THEN 'refunded' ELSE 'refund_pending' END,refunded_amount=CASE WHEN p_status='succeeded' THEN amount ELSE 0 END WHERE order_id=p_order AND provider_ref='stripe:'||p_intent AND disposition IN ('refund_pending','refunded');
 IF NOT FOUND THEN RAISE EXCEPTION 'Refund receipt not found'; END IF;
 UPDATE public.specials_checkouts SET financial_state=CASE WHEN p_status='succeeded' THEN 'refunded' ELSE 'refund_pending' END,updated_at=clock_timestamp() WHERE order_id=p_order AND inventory_state='released';
END $$;
REVOKE ALL ON FUNCTION public.specials_stripe_refund_v1(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.specials_stripe_refund_v1(uuid,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_specials_action_v1(p_action text,p_request jsonb,p_operation_key uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT specials_private.admin_action(p_action,p_request,p_operation_key) $$;

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261012144155','joko_specials_dual_payment_rails_v1',ARRAY['-- New checkouts default to Stripe. Existing snapshots retain their original rail.
ALTER TABLE specials_private.settings ADD COLUMN payment_mode text NOT NULL DEFAULT ''stripe_promptpay'' CHECK(payment_mode IN (''stripe_promptpay'',''kshop_master''));
ALTER TABLE public.specials_checkouts ADD COLUMN payment_mode text NOT NULL DEFAULT ''kshop_master'' CHECK(payment_mode IN (''stripe_promptpay'',''kshop_master''));
ALTER TABLE specials_private.settings DROP CONSTRAINT specials_static_merchant_qr;
ALTER TABLE specials_private.settings ADD CONSTRAINT specials_static_merchant_qr CHECK(NOT enabled OR payment_mode=''stripe_promptpay'' OR specials_private.valid_merchant_qr(qr_payload));

ALTER FUNCTION specials_private.admin_action(text,jsonb,uuid) RENAME TO single_rail_admin_action;
CREATE FUNCTION specials_private.admin_action(p_action text,p_request jsonb,p_operation_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS $$
DECLARE s specials_private.settings%ROWTYPE; mode text:=coalesce(p_request->>''payment_mode'',''stripe_promptpay'');
BEGIN
 IF p_action IS DISTINCT FROM ''settings'' THEN RETURN specials_private.single_rail_admin_action(p_action,p_request,p_operation_key); END IF;
 IF NOT specials_private.is_admin() OR p_operation_key IS NULL THEN RAISE EXCEPTION ''Admin and operation key required'' USING ERRCODE=''42501''; END IF;
 IF mode NOT IN (''stripe_promptpay'',''kshop_master'') THEN RAISE EXCEPTION ''Unsupported payment method''; END IF;
 IF mode=''kshop_master'' AND coalesce((p_request->>''enabled'')::boolean,false) AND
 (NOT specials_private.valid_merchant_qr(p_request->>''qr_payload'') OR coalesce(p_request->>''receiver_bank_code'','''')='''' OR length(regexp_replace(coalesce(p_request->>''receiver_bank_number'',''''),''[^0-9]'','''',''g''))<6 OR coalesce(p_request->>''receiver_label'','''')='''') THEN RAISE EXCEPTION ''Approved merchant QR and exact registered receiver required''; END IF;
 UPDATE specials_private.settings SET payment_mode=mode,enabled=coalesce((p_request->>''enabled'')::boolean,false),qr_payload=coalesce(p_request->>''qr_payload'',''''),receiver_bank_code=upper(trim(coalesce(p_request->>''receiver_bank_code'',''''))),receiver_bank_number=coalesce(p_request->>''receiver_bank_number'',''''),receiver_label=coalesce(p_request->>''receiver_label'',''''),updated_by=auth.uid(),updated_at=clock_timestamp() WHERE id RETURNING * INTO s;
 RETURN jsonb_build_object(''settings'',to_jsonb(s));
END $$;
REVOKE ALL ON FUNCTION specials_private.single_rail_admin_action(text,jsonb,uuid),specials_private.admin_action(text,jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION specials_private.admin_action(text,jsonb,uuid) TO authenticated;

DO $patch$
DECLARE definition text;
BEGIN
 definition:=pg_get_functiondef(''specials_private.checkout(uuid,jsonb,uuid)''::regprocedure);
 IF strpos(definition,''operation_key,request,inventory_state,payment_deadline'')=0 THEN RAISE EXCEPTION ''Unexpected checkout function''; END IF;
 definition:=replace(definition,''operation_key,request,inventory_state,payment_deadline'',''operation_key,request,payment_mode,inventory_state,payment_deadline'');
 definition:=replace(definition,''VALUES(oid,b.id,auth.uid(),p_key,p_cart,''''held'''','',''VALUES(oid,b.id,auth.uid(),p_key,p_cart,s.payment_mode,''''held'''','');
 definition:=replace(definition,''IF t>=b.sales_end_at-interval ''''5 minutes'''''', ''IF s.payment_mode=''''stripe_promptpay'''' AND total<1000 THEN RAISE EXCEPTION ''''Stripe PromptPay requires at least THB 10''''; END IF; IF t>=b.sales_end_at-interval ''''5 minutes'''''');
 EXECUTE definition;
 -- EasySlip cannot attest to a checkout frozen to Stripe.
 definition:=pg_get_functiondef(''specials_private.begin_verification(uuid,uuid,uuid,text)''::regprocedure);
 definition:=replace(definition,''IF NOT FOUND THEN RAISE EXCEPTION ''''Checkout not found''''; END IF;'', ''IF NOT FOUND THEN RAISE EXCEPTION ''''Checkout not found''''; END IF; IF c.payment_mode<>''''kshop_master'''' THEN RAISE EXCEPTION ''''This checkout requires Stripe payment''''; END IF;'');
 EXECUTE definition;
 -- Return the frozen rail and existing transaction ID to the owner, never credentials.
 definition:=pg_get_functiondef(''specials_private.customer_state(uuid,boolean)''::regprocedure);
 definition:=replace(definition,''''''checkout'''',to_jsonb(c),'',''''''payment'''',(SELECT jsonb_build_object(''''id'''',id,''''mode'''',payment_mode) FROM public.payment_transactions WHERE order_id=c.order_id),''''checkout'''',to_jsonb(c),'');
 EXECUTE definition;
 -- The regular minimum trigger must not select the Specials rail globally.
 IF to_regprocedure(''public.enforce_online_payment_provider_minimum_v1()'') IS NOT NULL THEN
  definition:=pg_get_functiondef(''public.enforce_online_payment_provider_minimum_v1()''::regprocedure);
  EXECUTE regexp_replace(definition,E''\\mBEGIN\\M[[:space:]]*\n'',E''BEGIN\n IF NEW.order_type=''''specials'''' THEN RETURN NEW; END IF;\n'',''i'');
 END IF;
END $patch$;
CREATE OR REPLACE FUNCTION specials_private.pin_payment_mode() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS $$
DECLARE mode text;
BEGIN
 IF EXISTS(SELECT 1 FROM public.orders WHERE id=NEW.order_id AND order_type=''specials'') THEN
  SELECT payment_mode INTO mode FROM public.specials_checkouts WHERE order_id=NEW.order_id;
  IF mode IS NULL THEN RAISE EXCEPTION ''Specials checkout snapshot missing''; END IF;
  NEW.payment_mode:=mode; NEW.provider:=CASE WHEN mode=''stripe_promptpay'' THEN ''stripe'' ELSE ''easyslip'' END; NEW.rail:=''promptpay'';
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION public.specials_finish_stripe_v1(p_order uuid,p_intent text,p_amount_satang integer,p_paid_at timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS $$
DECLARE c public.specials_checkouts%ROWTYPE; b public.specials_batches%ROWTYPE; o public.orders%ROWTYPE; t public.payment_transactions%ROWTYPE; r specials_private.receipts%ROWTYPE; l record; good boolean; ref text:=''stripe:''||p_intent;
BEGIN
 IF coalesce(auth.role(),'''')<>''service_role'' THEN RAISE EXCEPTION ''Service role required'' USING ERRCODE=''42501''; END IF;
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order;
 IF NOT FOUND OR c.payment_mode<>''stripe_promptpay'' THEN RAISE EXCEPTION ''Not a Stripe Specials checkout''; END IF;
 SELECT * INTO b FROM public.specials_batches WHERE id=c.batch_id FOR UPDATE;
 PERFORM specials_private.reap_batch(b.id);
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order FOR UPDATE;
 SELECT * INTO o FROM public.orders WHERE id=p_order FOR UPDATE;
 SELECT * INTO t FROM public.payment_transactions WHERE order_id=p_order FOR UPDATE;
 IF t.provider<>''stripe'' OR t.provider_transaction_ref IS DISTINCT FROM p_intent OR p_amount_satang IS DISTINCT FROM round(o.total_amount*100)::integer OR p_paid_at IS NULL THEN RAISE EXCEPTION ''Stripe payment evidence mismatch''; END IF;
 SELECT * INTO r FROM specials_private.receipts WHERE provider_ref=ref;
 IF FOUND AND r.order_id IS DISTINCT FROM p_order THEN RAISE EXCEPTION ''Stripe receipt belongs to another order''; END IF;
 IF FOUND THEN RETURN jsonb_build_object(''state'',CASE WHEN r.disposition=''credited'' THEN ''verified'' WHEN r.disposition=''refunded'' THEN ''refunded'' ELSE ''refund_required'' END); END IF;
 good:=c.inventory_state=''held'' AND clock_timestamp()<c.payment_deadline AND p_paid_at>=date_trunc(''second'',c.created_at) AND p_paid_at<=c.payment_deadline AND b.status<>''cancelled'';
 INSERT INTO specials_private.receipts(provider_ref,order_id,amount,received_at,disposition) VALUES(ref,p_order,o.total_amount,p_paid_at,CASE WHEN good THEN ''credited'' ELSE ''refund_pending'' END);
 IF NOT good THEN
  PERFORM specials_private.release_hold(p_order,''expired'');
  UPDATE public.specials_checkouts SET financial_state=''refund_pending'',updated_at=clock_timestamp() WHERE order_id=p_order;
  RETURN jsonb_build_object(''state'',''refund_required'');
 END IF;
 FOR l IN SELECT * FROM specials_private.hold_lines WHERE order_id=p_order ORDER BY item_id LOOP
  UPDATE public.specials_items SET quantity_held=quantity_held-l.quantity,quantity_committed=quantity_committed+l.quantity,version=version+1,updated_at=clock_timestamp() WHERE id=l.item_id;
 END LOOP;
 UPDATE public.specials_checkouts SET inventory_state=''committed'',financial_state=''verified'',fulfillment_state=''ready'',updated_at=clock_timestamp() WHERE order_id=p_order;
 UPDATE public.orders SET payment_status=''paid'',payment_method=''promptpay_online'',amount_paid=total_amount,status=''confirmed'',loyalty_points_earned=0,loyalty_multiplier=0,updated_at=clock_timestamp() WHERE id=p_order;
 UPDATE public.payment_transactions SET status=''verified'',verified_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=t.id;
 INSERT INTO public.order_notification_events(order_id,notification_type,status) VALUES(p_order,''payment_confirmation'',''pending''),(p_order,''admin_new_order'',''pending'') ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object(''state'',''verified'');
END $$;
REVOKE ALL ON FUNCTION public.specials_finish_stripe_v1(uuid,text,integer,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.specials_finish_stripe_v1(uuid,text,integer,timestamptz) TO service_role;

CREATE FUNCTION public.specials_stripe_refund_v1(p_order uuid,p_intent text,p_refund text,p_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS $$
DECLARE receipt specials_private.receipts%ROWTYPE;
BEGIN
 IF coalesce(auth.role(),'''')<>''service_role'' THEN RAISE EXCEPTION ''Service role required'' USING ERRCODE=''42501''; END IF;
 IF p_refund IS NULL OR p_refund !~ ''^re_'' OR p_status NOT IN (''pending'',''succeeded'',''failed'',''canceled'',''requires_action'') THEN RAISE EXCEPTION ''Invalid refund evidence''; END IF;
 -- This handler owns refunds for released holds only; ordinary Admin refunds use their own workflow.
 SELECT * INTO receipt FROM specials_private.receipts WHERE order_id=p_order AND provider_ref=''stripe:''||p_intent FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION ''Refund receipt not found''; END IF;
 IF receipt.disposition IN (''refunded'',''credited'') THEN RETURN; END IF;
 UPDATE specials_private.receipts SET refund_reference=p_refund,refund_reason=''Stripe payment after stock hold release'',disposition=CASE WHEN p_status=''succeeded'' THEN ''refunded'' ELSE ''refund_pending'' END,refunded_amount=CASE WHEN p_status=''succeeded'' THEN amount ELSE 0 END WHERE order_id=p_order AND provider_ref=''stripe:''||p_intent AND disposition IN (''refund_pending'',''refunded'');
 IF NOT FOUND THEN RAISE EXCEPTION ''Refund receipt not found''; END IF;
 UPDATE public.specials_checkouts SET financial_state=CASE WHEN p_status=''succeeded'' THEN ''refunded'' ELSE ''refund_pending'' END,updated_at=clock_timestamp() WHERE order_id=p_order AND inventory_state=''released'';
END $$;
REVOKE ALL ON FUNCTION public.specials_stripe_refund_v1(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.specials_stripe_refund_v1(uuid,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_specials_action_v1(p_action text,p_request jsonb,p_operation_key uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='''' AS $$ SELECT specials_private.admin_action(p_action,p_request,p_operation_key) $$;
']);

-- 20261013024901_joko_specials_receipt_compatibility_v1.sql
-- Preserve the regular receipt workflow while preventing Specials side effects.
-- Runs after the deployed customer-receipt migration replaces claim_order_notification.
DO $guards$
DECLARE definition text;
BEGIN
 definition := pg_get_functiondef('public.claim_order_notification(uuid,text)'::regprocedure);
 IF definition !~* E'\\mBEGIN\\M[[:space:]]*\n' THEN
  RAISE EXCEPTION 'Unexpected claim_order_notification body';
 END IF;
 EXECUTE regexp_replace(definition,E'\\mBEGIN\\M[[:space:]]*\n',
  E'BEGIN\n  IF EXISTS (SELECT 1 FROM public.orders WHERE id=p_order_id AND order_type=''specials'' AND (payment_status<>''paid'' OR p_notification_type=''customer_confirmation'')) THEN RETURN jsonb_build_object(''outcome'',''unavailable''); END IF;\n','i');
 definition := pg_get_functiondef('public.complete_order_customer_receipt(text,text,timestamptz,jsonb)'::regprocedure);
 IF definition !~* E'\\mBEGIN\\M[[:space:]]*\n' THEN
  RAISE EXCEPTION 'Unexpected complete_order_customer_receipt body';
 END IF;
 EXECUTE regexp_replace(definition,E'\\mBEGIN\\M[[:space:]]*\n',
  E'BEGIN\n  IF EXISTS (SELECT 1 FROM public.pickup_handoff_sessions h JOIN public.orders o ON o.id=h.order_id WHERE h.token_hash=p_token_hash AND o.order_type=''specials'') THEN RAISE EXCEPTION ''Use the Specials receipt confirmation workflow''; END IF;\n','i');
END $guards$;

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261013024901','joko_specials_receipt_compatibility_v1',ARRAY['-- Preserve the regular receipt workflow while preventing Specials side effects.
-- Runs after the deployed customer-receipt migration replaces claim_order_notification.
DO $guards$
DECLARE definition text;
BEGIN
 definition := pg_get_functiondef(''public.claim_order_notification(uuid,text)''::regprocedure);
 IF definition !~* E''\\mBEGIN\\M[[:space:]]*\n'' THEN
  RAISE EXCEPTION ''Unexpected claim_order_notification body'';
 END IF;
 EXECUTE regexp_replace(definition,E''\\mBEGIN\\M[[:space:]]*\n'',
  E''BEGIN\n  IF EXISTS (SELECT 1 FROM public.orders WHERE id=p_order_id AND order_type=''''specials'''' AND (payment_status<>''''paid'''' OR p_notification_type=''''customer_confirmation'''')) THEN RETURN jsonb_build_object(''''outcome'''',''''unavailable''''); END IF;\n'',''i'');
 definition := pg_get_functiondef(''public.complete_order_customer_receipt(text,text,timestamptz,jsonb)''::regprocedure);
 IF definition !~* E''\\mBEGIN\\M[[:space:]]*\n'' THEN
  RAISE EXCEPTION ''Unexpected complete_order_customer_receipt body'';
 END IF;
 EXECUTE regexp_replace(definition,E''\\mBEGIN\\M[[:space:]]*\n'',
  E''BEGIN\n  IF EXISTS (SELECT 1 FROM public.pickup_handoff_sessions h JOIN public.orders o ON o.id=h.order_id WHERE h.token_hash=p_token_hash AND o.order_type=''''specials'''') THEN RAISE EXCEPTION ''''Use the Specials receipt confirmation workflow''''; END IF;\n'',''i'');
END $guards$;
']);

-- 20261014040517_joko_specials_noncard_refund_evidence_v1.sql
-- Stripe non-card refund objects use pyr_ as well as re_.
-- Keep service-role-only evidence and final success gating unchanged.

CREATE OR REPLACE FUNCTION public.specials_stripe_refund_v1(p_order uuid,p_intent text,p_refund text,p_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE receipt specials_private.receipts%ROWTYPE;
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
 IF p_refund IS NULL OR p_refund !~ '^(re|pyr)_[A-Za-z0-9]+$' OR p_status NOT IN ('pending','succeeded','failed','canceled','requires_action') THEN RAISE EXCEPTION 'Invalid refund evidence'; END IF;
 -- This handler owns refunds for released holds only; ordinary Admin refunds use their own workflow.
 SELECT * INTO receipt FROM specials_private.receipts WHERE order_id=p_order AND provider_ref='stripe:'||p_intent FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Refund receipt not found'; END IF;
 IF receipt.disposition IN ('refunded','credited') THEN RETURN; END IF;
 UPDATE specials_private.receipts SET refund_reference=p_refund,refund_reason='Stripe payment after stock hold release',disposition=CASE WHEN p_status='succeeded' THEN 'refunded' ELSE 'refund_pending' END,refunded_amount=CASE WHEN p_status='succeeded' THEN amount ELSE 0 END WHERE order_id=p_order AND provider_ref='stripe:'||p_intent AND disposition IN ('refund_pending','refunded');
 IF NOT FOUND THEN RAISE EXCEPTION 'Refund receipt not found'; END IF;
 UPDATE public.specials_checkouts SET financial_state=CASE WHEN p_status='succeeded' THEN 'refunded' ELSE 'refund_pending' END,updated_at=clock_timestamp() WHERE order_id=p_order AND inventory_state='released';
END $$;
REVOKE ALL ON FUNCTION public.specials_stripe_refund_v1(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.specials_stripe_refund_v1(uuid,text,text,text) TO service_role;

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261014040517','joko_specials_noncard_refund_evidence_v1',ARRAY['-- Stripe non-card refund objects use pyr_ as well as re_.
-- Keep service-role-only evidence and final success gating unchanged.
BEGIN;
CREATE OR REPLACE FUNCTION public.specials_stripe_refund_v1(p_order uuid,p_intent text,p_refund text,p_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS $$
DECLARE receipt specials_private.receipts%ROWTYPE;
BEGIN
 IF coalesce(auth.role(),'''')<>''service_role'' THEN RAISE EXCEPTION ''Service role required'' USING ERRCODE=''42501''; END IF;
 IF p_refund IS NULL OR p_refund !~ ''^(re|pyr)_[A-Za-z0-9]+$'' OR p_status NOT IN (''pending'',''succeeded'',''failed'',''canceled'',''requires_action'') THEN RAISE EXCEPTION ''Invalid refund evidence''; END IF;
 -- This handler owns refunds for released holds only; ordinary Admin refunds use their own workflow.
 SELECT * INTO receipt FROM specials_private.receipts WHERE order_id=p_order AND provider_ref=''stripe:''||p_intent FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION ''Refund receipt not found''; END IF;
 IF receipt.disposition IN (''refunded'',''credited'') THEN RETURN; END IF;
 UPDATE specials_private.receipts SET refund_reference=p_refund,refund_reason=''Stripe payment after stock hold release'',disposition=CASE WHEN p_status=''succeeded'' THEN ''refunded'' ELSE ''refund_pending'' END,refunded_amount=CASE WHEN p_status=''succeeded'' THEN amount ELSE 0 END WHERE order_id=p_order AND provider_ref=''stripe:''||p_intent AND disposition IN (''refund_pending'',''refunded'');
 IF NOT FOUND THEN RAISE EXCEPTION ''Refund receipt not found''; END IF;
 UPDATE public.specials_checkouts SET financial_state=CASE WHEN p_status=''succeeded'' THEN ''refunded'' ELSE ''refund_pending'' END,updated_at=clock_timestamp() WHERE order_id=p_order AND inventory_state=''released'';
END $$;
REVOKE ALL ON FUNCTION public.specials_stripe_refund_v1(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.specials_stripe_refund_v1(uuid,text,text,text) TO service_role;
COMMIT;
']);

-- 20261014041822_joko_specials_release_guards_v1.sql
-- Preserve Specials exclusions after notification preferences replace the legacy claim.
-- Keep bank-transfer refund records separate from automatic Stripe refund evidence.

DO $guards$
DECLARE definition text;
BEGIN
 definition := pg_get_functiondef('public.claim_order_notification(uuid,text)'::regprocedure);
 IF position('order_type=''specials''' IN definition)=0 THEN
  IF definition !~* E'\\mBEGIN\\M[[:space:]]*\n' THEN RAISE EXCEPTION 'Unexpected claim_order_notification body'; END IF;
  EXECUTE regexp_replace(definition,E'\\mBEGIN\\M[[:space:]]*\n',
   E'BEGIN\n  IF EXISTS (SELECT 1 FROM public.orders WHERE id=p_order_id AND order_type=''specials'' AND (payment_status<>''paid'' OR p_notification_type=''customer_confirmation'')) THEN RETURN jsonb_build_object(''outcome'',''unavailable''); END IF;\n','i');
 END IF;
 definition := pg_get_functiondef('specials_private.operational_action(text,jsonb,uuid)'::regprocedure);
 IF position('Use automatic Stripe refund reconciliation' IN definition)=0 THEN
  IF definition !~* E'\\mBEGIN\\M[[:space:]]*\n' THEN RAISE EXCEPTION 'Unexpected operational_action body'; END IF;
  EXECUTE regexp_replace(definition,E'\\mBEGIN\\M[[:space:]]*\n',
   E'BEGIN\n  IF p_action IN (''refund'',''refund_pending'') AND coalesce(p_request->>''reference'','''') LIKE ''stripe:%'' THEN RAISE EXCEPTION ''Use automatic Stripe refund reconciliation''; END IF;\n','i');
 END IF;
END $guards$;

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261014041822','joko_specials_release_guards_v1',ARRAY['-- Preserve Specials exclusions after notification preferences replace the legacy claim.
-- Keep bank-transfer refund records separate from automatic Stripe refund evidence.
BEGIN;
DO $guards$
DECLARE definition text;
BEGIN
 definition := pg_get_functiondef(''public.claim_order_notification(uuid,text)''::regprocedure);
 IF position(''order_type=''''specials'''''' IN definition)=0 THEN
  IF definition !~* E''\\mBEGIN\\M[[:space:]]*\n'' THEN RAISE EXCEPTION ''Unexpected claim_order_notification body''; END IF;
  EXECUTE regexp_replace(definition,E''\\mBEGIN\\M[[:space:]]*\n'',
   E''BEGIN\n  IF EXISTS (SELECT 1 FROM public.orders WHERE id=p_order_id AND order_type=''''specials'''' AND (payment_status<>''''paid'''' OR p_notification_type=''''customer_confirmation'''')) THEN RETURN jsonb_build_object(''''outcome'''',''''unavailable''''); END IF;\n'',''i'');
 END IF;
 definition := pg_get_functiondef(''specials_private.operational_action(text,jsonb,uuid)''::regprocedure);
 IF position(''Use automatic Stripe refund reconciliation'' IN definition)=0 THEN
  IF definition !~* E''\\mBEGIN\\M[[:space:]]*\n'' THEN RAISE EXCEPTION ''Unexpected operational_action body''; END IF;
  EXECUTE regexp_replace(definition,E''\\mBEGIN\\M[[:space:]]*\n'',
   E''BEGIN\n  IF p_action IN (''''refund'''',''''refund_pending'''') AND coalesce(p_request->>''''reference'''','''''''') LIKE ''''stripe:%'''' THEN RAISE EXCEPTION ''''Use automatic Stripe refund reconciliation''''; END IF;\n'',''i'');
 END IF;
END $guards$;
COMMIT;
']);

UPDATE specials_private.settings SET enabled=false,payment_mode='stripe_promptpay';
COMMIT;
