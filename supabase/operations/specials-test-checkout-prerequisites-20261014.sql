-- PREPARED ONLY. Explicit test-only schema approval required. Never apply to production.
BEGIN;
SET LOCAL lock_timeout='10s';
DO $$ BEGIN IF to_regclass('public.cms_makers') IS NOT NULL THEN RAISE EXCEPTION 'Makers exists; inspect history before proceeding'; END IF; IF NOT EXISTS(SELECT 1 FROM cms_pickup_locations WHERE id='20000000-0000-0000-0000-000000000001' AND name_en='Test Mae Rim') THEN RAISE EXCEPTION 'Expected test project fixture absent'; END IF; END $$;

-- Additive Makers catalogue foundation. Existing origins are left unclassified;
-- the application retains its legacy fallback until Admin reviews each product.

CREATE TABLE public.cms_makers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_en text NOT NULL CHECK (btrim(name_en) <> ''),
  name_th text NOT NULL CHECK (btrim(name_th) <> ''),
  name_zh text,
  intro_en text NOT NULL DEFAULT '', intro_th text NOT NULL DEFAULT '', intro_zh text,
  story_en text NOT NULL DEFAULT '', story_th text NOT NULL DEFAULT '', story_zh text,
  joko_note_en text NOT NULL DEFAULT '', joko_note_th text NOT NULL DEFAULT '', joko_note_zh text,
  location text NOT NULL DEFAULT '',
  hero_image text CHECK (hero_image IS NULL OR hero_image ~ '^https://'),
  website_url text CHECK (website_url IS NULL OR website_url ~ '^https?://'),
  is_published boolean NOT NULL DEFAULT false,
  show_on_homepage boolean NOT NULL DEFAULT false,
  is_ordering_enabled boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cms_makers_ordering_requires_publication CHECK (NOT is_ordering_enabled OR is_published)
);
ALTER TABLE public.cms_makers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cms_makers FROM anon, authenticated;
GRANT SELECT ON public.cms_makers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cms_makers TO authenticated;
GRANT ALL ON public.cms_makers TO service_role;
CREATE POLICY makers_public_read ON public.cms_makers FOR SELECT TO anon, authenticated USING (is_published);
CREATE POLICY makers_admin_read ON public.cms_makers FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);
CREATE POLICY makers_admin_insert ON public.cms_makers FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);
CREATE POLICY makers_admin_update ON public.cms_makers FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);
CREATE POLICY makers_admin_delete ON public.cms_makers FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);
CREATE TRIGGER cms_makers_updated_at BEFORE UPDATE ON public.cms_makers
FOR EACH ROW EXECUTE FUNCTION public.update_orders_updated_at();

ALTER TABLE public.cms_products
  ADD COLUMN maker_id uuid REFERENCES public.cms_makers(id) ON DELETE RESTRICT,
  ADD COLUMN product_origin text CHECK (product_origin IN ('joko', 'beyond', 'maker')),
  ADD CONSTRAINT cms_products_maker_origin_requires_profile CHECK (product_origin IS DISTINCT FROM 'maker' OR maker_id IS NOT NULL);
CREATE INDEX cms_products_maker_idx ON public.cms_products(maker_id) WHERE maker_id IS NOT NULL;
CREATE INDEX cms_makers_homepage_idx ON public.cms_makers(sort_order) WHERE is_published AND show_on_homepage;

-- Existing catalogue SELECT policies are permissive. A restrictive policy is
-- necessary to prevent draft maker products leaking through direct REST reads.
CREATE POLICY maker_products_anon_publication_guard ON public.cms_products AS RESTRICTIVE
FOR SELECT TO anon USING (
  maker_id IS NULL
  OR EXISTS (SELECT 1 FROM public.cms_makers m WHERE m.id = maker_id AND m.is_published)
);
CREATE POLICY maker_products_publication_guard ON public.cms_products AS RESTRICTIVE
FOR SELECT TO authenticated USING (
  maker_id IS NULL
  OR EXISTS (SELECT 1 FROM public.cms_makers m WHERE m.id = maker_id AND m.is_published)
  OR EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin', 'product_staff'))
);

-- Trigger helpers stay outside the exposed public API. The definer privilege is
-- needed to check draft maker state even when the customer's SELECT policy hides it.
CREATE SCHEMA IF NOT EXISTS joko_makers_internal;
REVOKE ALL ON SCHEMA joko_makers_internal FROM PUBLIC, anon, authenticated;
CREATE FUNCTION joko_makers_internal.guard_and_snapshot_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $makers$
DECLARE
  v_item jsonb;
  v_product public.cms_products%ROWTYPE;
  v_maker public.cms_makers%ROWTYPE;
  v_items jsonb := '[]'::jsonb;
  v_origin text;
  v_is_insert boolean := TG_OP = 'INSERT';
BEGIN
  IF NEW.order_items IS NULL OR jsonb_typeof(NEW.order_items) <> 'array' THEN RETURN NEW; END IF;
  -- Status updates normally need no catalogue lookup. Reactivation must check
  -- that maker sales are still allowed. Paid historical orders remain readable.
  IF NOT v_is_insert THEN
    IF NEW.order_items IS DISTINCT FROM OLD.order_items AND (
      EXISTS (SELECT 1 FROM jsonb_array_elements(OLD.order_items) item WHERE item->>'maker_id' IS NOT NULL)
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.order_items) item JOIN public.cms_products p ON p.id::text = item->>'product_id' WHERE p.maker_id IS NOT NULL)
    ) THEN RAISE EXCEPTION 'Maker order item snapshots are immutable'; END IF;
    IF NOT (OLD.status = 'cancelled' AND NEW.status = 'pending') THEN RETURN NEW; END IF;
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(NEW.order_items) LOOP
    SELECT * INTO v_product FROM public.cms_products WHERE id::text = v_item->>'product_id' FOR SHARE;
    IF NOT FOUND THEN v_items := v_items || jsonb_build_array(v_item); CONTINUE; END IF;
    v_origin := COALESCE(v_product.product_origin, CASE WHEN v_product.is_non_bakery THEN 'beyond' ELSE 'joko' END);
    IF v_product.maker_id IS NOT NULL THEN
      SELECT * INTO v_maker FROM public.cms_makers WHERE id = v_product.maker_id FOR SHARE;
      IF v_origin = 'maker' THEN
        IF NOT FOUND OR NOT v_maker.is_published OR NOT v_maker.is_ordering_enabled
          THEN RAISE EXCEPTION 'This maker is currently preview only'; END IF;
        IF COALESCE(NEW.purchase_type, 'online') = 'online' THEN
          IF NEW.pickup_date_id IS NULL THEN RAISE EXCEPTION 'Makers requires dated pickup checkout'; END IF;
          IF NOT EXISTS (SELECT 1 FROM public.payment_settings WHERE id AND online_promptpay_enabled)
            THEN RAISE EXCEPTION 'Makers requires online payment'; END IF;
        END IF;
      END IF;
      IF v_is_insert THEN
        v_item := (v_item - 'maker_name_en' - 'maker_name_th' - 'maker_name_zh' - 'maker_id') || jsonb_build_object(
          'maker_id', v_product.maker_id, 'maker_name_en', v_maker.name_en,
          'maker_name_th', v_maker.name_th, 'maker_name_zh', COALESCE(v_maker.name_zh, '')
        );
      END IF;
    ELSIF v_is_insert THEN
      v_item := v_item - 'maker_id' - 'maker_name_en' - 'maker_name_th' - 'maker_name_zh';
    END IF;
    IF v_is_insert THEN v_item := v_item || jsonb_build_object('product_origin', v_origin); END IF;
    v_items := v_items || jsonb_build_array(v_item);
  END LOOP;
  IF v_is_insert THEN NEW.order_items := v_items; END IF;
  RETURN NEW;
END;
$makers$;
REVOKE ALL ON FUNCTION joko_makers_internal.guard_and_snapshot_order() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER makers_order_guard_snapshot BEFORE INSERT OR UPDATE OF order_items, status ON public.orders
FOR EACH ROW EXECUTE FUNCTION joko_makers_internal.guard_and_snapshot_order();
COMMENT ON TABLE public.cms_makers IS 'Public editorial maker profiles. No costs, banking data or private contacts.';
COMMENT ON COLUMN public.cms_products.product_origin IS 'Editorial world; independent of food category and non-bakery classification. NULL retains legacy classification.';

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261009152636','joko_makers_v1',ARRAY['-- Additive Makers catalogue foundation. Existing origins are left unclassified;
-- the application retains its legacy fallback until Admin reviews each product.
BEGIN;
CREATE TABLE public.cms_makers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ ''^[a-z0-9]+(-[a-z0-9]+)*$''),
  name_en text NOT NULL CHECK (btrim(name_en) <> ''''),
  name_th text NOT NULL CHECK (btrim(name_th) <> ''''),
  name_zh text,
  intro_en text NOT NULL DEFAULT '''', intro_th text NOT NULL DEFAULT '''', intro_zh text,
  story_en text NOT NULL DEFAULT '''', story_th text NOT NULL DEFAULT '''', story_zh text,
  joko_note_en text NOT NULL DEFAULT '''', joko_note_th text NOT NULL DEFAULT '''', joko_note_zh text,
  location text NOT NULL DEFAULT '''',
  hero_image text CHECK (hero_image IS NULL OR hero_image ~ ''^https://''),
  website_url text CHECK (website_url IS NULL OR website_url ~ ''^https?://''),
  is_published boolean NOT NULL DEFAULT false,
  show_on_homepage boolean NOT NULL DEFAULT false,
  is_ordering_enabled boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cms_makers_ordering_requires_publication CHECK (NOT is_ordering_enabled OR is_published)
);
ALTER TABLE public.cms_makers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cms_makers FROM anon, authenticated;
GRANT SELECT ON public.cms_makers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cms_makers TO authenticated;
GRANT ALL ON public.cms_makers TO service_role;
CREATE POLICY makers_public_read ON public.cms_makers FOR SELECT TO anon, authenticated USING (is_published);
CREATE POLICY makers_admin_read ON public.cms_makers FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (SELECT auth.uid()) AND role = ''admin'')
);
CREATE POLICY makers_admin_insert ON public.cms_makers FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (SELECT auth.uid()) AND role = ''admin'')
);
CREATE POLICY makers_admin_update ON public.cms_makers FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (SELECT auth.uid()) AND role = ''admin'')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (SELECT auth.uid()) AND role = ''admin'')
);
CREATE POLICY makers_admin_delete ON public.cms_makers FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (SELECT auth.uid()) AND role = ''admin'')
);
CREATE TRIGGER cms_makers_updated_at BEFORE UPDATE ON public.cms_makers
FOR EACH ROW EXECUTE FUNCTION public.update_orders_updated_at();

ALTER TABLE public.cms_products
  ADD COLUMN maker_id uuid REFERENCES public.cms_makers(id) ON DELETE RESTRICT,
  ADD COLUMN product_origin text CHECK (product_origin IN (''joko'', ''beyond'', ''maker'')),
  ADD CONSTRAINT cms_products_maker_origin_requires_profile CHECK (product_origin IS DISTINCT FROM ''maker'' OR maker_id IS NOT NULL);
CREATE INDEX cms_products_maker_idx ON public.cms_products(maker_id) WHERE maker_id IS NOT NULL;
CREATE INDEX cms_makers_homepage_idx ON public.cms_makers(sort_order) WHERE is_published AND show_on_homepage;

-- Existing catalogue SELECT policies are permissive. A restrictive policy is
-- necessary to prevent draft maker products leaking through direct REST reads.
CREATE POLICY maker_products_anon_publication_guard ON public.cms_products AS RESTRICTIVE
FOR SELECT TO anon USING (
  maker_id IS NULL
  OR EXISTS (SELECT 1 FROM public.cms_makers m WHERE m.id = maker_id AND m.is_published)
);
CREATE POLICY maker_products_publication_guard ON public.cms_products AS RESTRICTIVE
FOR SELECT TO authenticated USING (
  maker_id IS NULL
  OR EXISTS (SELECT 1 FROM public.cms_makers m WHERE m.id = maker_id AND m.is_published)
  OR EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN (''admin'', ''product_staff''))
);

-- Trigger helpers stay outside the exposed public API. The definer privilege is
-- needed to check draft maker state even when the customer''s SELECT policy hides it.
CREATE SCHEMA IF NOT EXISTS joko_makers_internal;
REVOKE ALL ON SCHEMA joko_makers_internal FROM PUBLIC, anon, authenticated;
CREATE FUNCTION joko_makers_internal.guard_and_snapshot_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $makers$
DECLARE
  v_item jsonb;
  v_product public.cms_products%ROWTYPE;
  v_maker public.cms_makers%ROWTYPE;
  v_items jsonb := ''[]''::jsonb;
  v_origin text;
  v_is_insert boolean := TG_OP = ''INSERT'';
BEGIN
  IF NEW.order_items IS NULL OR jsonb_typeof(NEW.order_items) <> ''array'' THEN RETURN NEW; END IF;
  -- Status updates normally need no catalogue lookup. Reactivation must check
  -- that maker sales are still allowed. Paid historical orders remain readable.
  IF NOT v_is_insert THEN
    IF NEW.order_items IS DISTINCT FROM OLD.order_items AND (
      EXISTS (SELECT 1 FROM jsonb_array_elements(OLD.order_items) item WHERE item->>''maker_id'' IS NOT NULL)
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.order_items) item JOIN public.cms_products p ON p.id::text = item->>''product_id'' WHERE p.maker_id IS NOT NULL)
    ) THEN RAISE EXCEPTION ''Maker order item snapshots are immutable''; END IF;
    IF NOT (OLD.status = ''cancelled'' AND NEW.status = ''pending'') THEN RETURN NEW; END IF;
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(NEW.order_items) LOOP
    SELECT * INTO v_product FROM public.cms_products WHERE id::text = v_item->>''product_id'' FOR SHARE;
    IF NOT FOUND THEN v_items := v_items || jsonb_build_array(v_item); CONTINUE; END IF;
    v_origin := COALESCE(v_product.product_origin, CASE WHEN v_product.is_non_bakery THEN ''beyond'' ELSE ''joko'' END);
    IF v_product.maker_id IS NOT NULL THEN
      SELECT * INTO v_maker FROM public.cms_makers WHERE id = v_product.maker_id FOR SHARE;
      IF v_origin = ''maker'' THEN
        IF NOT FOUND OR NOT v_maker.is_published OR NOT v_maker.is_ordering_enabled
          THEN RAISE EXCEPTION ''This maker is currently preview only''; END IF;
        IF COALESCE(NEW.purchase_type, ''online'') = ''online'' THEN
          IF NEW.pickup_date_id IS NULL THEN RAISE EXCEPTION ''Makers requires dated pickup checkout''; END IF;
          IF NOT EXISTS (SELECT 1 FROM public.payment_settings WHERE id AND online_promptpay_enabled)
            THEN RAISE EXCEPTION ''Makers requires online payment''; END IF;
        END IF;
      END IF;
      IF v_is_insert THEN
        v_item := (v_item - ''maker_name_en'' - ''maker_name_th'' - ''maker_name_zh'' - ''maker_id'') || jsonb_build_object(
          ''maker_id'', v_product.maker_id, ''maker_name_en'', v_maker.name_en,
          ''maker_name_th'', v_maker.name_th, ''maker_name_zh'', COALESCE(v_maker.name_zh, '''')
        );
      END IF;
    ELSIF v_is_insert THEN
      v_item := v_item - ''maker_id'' - ''maker_name_en'' - ''maker_name_th'' - ''maker_name_zh'';
    END IF;
    IF v_is_insert THEN v_item := v_item || jsonb_build_object(''product_origin'', v_origin); END IF;
    v_items := v_items || jsonb_build_array(v_item);
  END LOOP;
  IF v_is_insert THEN NEW.order_items := v_items; END IF;
  RETURN NEW;
END;
$makers$;
REVOKE ALL ON FUNCTION joko_makers_internal.guard_and_snapshot_order() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER makers_order_guard_snapshot BEFORE INSERT OR UPDATE OF order_items, status ON public.orders
FOR EACH ROW EXECUTE FUNCTION joko_makers_internal.guard_and_snapshot_order();
COMMENT ON TABLE public.cms_makers IS ''Public editorial maker profiles. No costs, banking data or private contacts.'';
COMMENT ON COLUMN public.cms_products.product_origin IS ''Editorial world; independent of food category and non-bakery classification. NULL retains legacy classification.'';
COMMIT;
']);
-- Preserve Makers snapshots even when a privileged writer supplies NULL or malformed JSON.
-- No order rows, permissions or trigger bindings are changed.

CREATE OR REPLACE FUNCTION joko_makers_internal.guard_and_snapshot_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $makers$
DECLARE
  v_item jsonb;
  v_product public.cms_products%ROWTYPE;
  v_maker public.cms_makers%ROWTYPE;
  v_items jsonb := '[]'::jsonb;
  v_origin text;
  v_is_insert boolean := TG_OP = 'INSERT';
BEGIN
  -- Status updates normally need no catalogue lookup. Reactivation must check
  -- that maker sales are still allowed. Paid historical orders remain readable.
  IF NOT v_is_insert THEN
    IF NEW.order_items IS DISTINCT FROM OLD.order_items AND (
      EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(OLD.order_items) = 'array' THEN OLD.order_items ELSE '[]'::jsonb END) item WHERE item->>'maker_id' IS NOT NULL)
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW.order_items) = 'array' THEN NEW.order_items ELSE '[]'::jsonb END) item JOIN public.cms_products p ON p.id::text = item->>'product_id' WHERE p.maker_id IS NOT NULL)
    ) THEN RAISE EXCEPTION 'Maker order item snapshots are immutable'; END IF;
    IF NOT (OLD.status = 'cancelled' AND NEW.status = 'pending') THEN RETURN NEW; END IF;
  END IF;
  -- Check existing snapshots before accepting legacy NULL/non-array items.
  IF NEW.order_items IS NULL OR jsonb_typeof(NEW.order_items) <> 'array' THEN RETURN NEW; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(NEW.order_items) LOOP
    SELECT * INTO v_product FROM public.cms_products WHERE id::text = v_item->>'product_id' FOR SHARE;
    IF NOT FOUND THEN v_items := v_items || jsonb_build_array(v_item); CONTINUE; END IF;
    v_origin := COALESCE(v_product.product_origin, CASE WHEN v_product.is_non_bakery THEN 'beyond' ELSE 'joko' END);
    IF v_product.maker_id IS NOT NULL THEN
      SELECT * INTO v_maker FROM public.cms_makers WHERE id = v_product.maker_id FOR SHARE;
      IF v_origin = 'maker' THEN
        IF NOT FOUND OR NOT v_maker.is_published OR NOT v_maker.is_ordering_enabled
          THEN RAISE EXCEPTION 'This maker is currently preview only'; END IF;
        IF COALESCE(NEW.purchase_type, 'online') = 'online' THEN
          IF NEW.pickup_date_id IS NULL THEN RAISE EXCEPTION 'Makers requires dated pickup checkout'; END IF;
          IF NOT EXISTS (SELECT 1 FROM public.payment_settings WHERE id AND online_promptpay_enabled)
            THEN RAISE EXCEPTION 'Makers requires online payment'; END IF;
        END IF;
      END IF;
      IF v_is_insert THEN
        v_item := (v_item - 'maker_name_en' - 'maker_name_th' - 'maker_name_zh' - 'maker_id') || jsonb_build_object(
          'maker_id', v_product.maker_id, 'maker_name_en', v_maker.name_en,
          'maker_name_th', v_maker.name_th, 'maker_name_zh', COALESCE(v_maker.name_zh, '')
        );
      END IF;
    ELSIF v_is_insert THEN
      v_item := v_item - 'maker_id' - 'maker_name_en' - 'maker_name_th' - 'maker_name_zh';
    END IF;
    IF v_is_insert THEN v_item := v_item || jsonb_build_object('product_origin', v_origin); END IF;
    v_items := v_items || jsonb_build_array(v_item);
  END LOOP;
  IF v_is_insert THEN NEW.order_items := v_items; END IF;
  RETURN NEW;
END;
$makers$;
REVOKE ALL ON FUNCTION joko_makers_internal.guard_and_snapshot_order() FROM PUBLIC, anon, authenticated;

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261010102901','makers_snapshot_immutability_fix',ARRAY['-- Preserve Makers snapshots even when a privileged writer supplies NULL or malformed JSON.
-- No order rows, permissions or trigger bindings are changed.
BEGIN;
CREATE OR REPLACE FUNCTION joko_makers_internal.guard_and_snapshot_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $makers$
DECLARE
  v_item jsonb;
  v_product public.cms_products%ROWTYPE;
  v_maker public.cms_makers%ROWTYPE;
  v_items jsonb := ''[]''::jsonb;
  v_origin text;
  v_is_insert boolean := TG_OP = ''INSERT'';
BEGIN
  -- Status updates normally need no catalogue lookup. Reactivation must check
  -- that maker sales are still allowed. Paid historical orders remain readable.
  IF NOT v_is_insert THEN
    IF NEW.order_items IS DISTINCT FROM OLD.order_items AND (
      EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(OLD.order_items) = ''array'' THEN OLD.order_items ELSE ''[]''::jsonb END) item WHERE item->>''maker_id'' IS NOT NULL)
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW.order_items) = ''array'' THEN NEW.order_items ELSE ''[]''::jsonb END) item JOIN public.cms_products p ON p.id::text = item->>''product_id'' WHERE p.maker_id IS NOT NULL)
    ) THEN RAISE EXCEPTION ''Maker order item snapshots are immutable''; END IF;
    IF NOT (OLD.status = ''cancelled'' AND NEW.status = ''pending'') THEN RETURN NEW; END IF;
  END IF;
  -- Check existing snapshots before accepting legacy NULL/non-array items.
  IF NEW.order_items IS NULL OR jsonb_typeof(NEW.order_items) <> ''array'' THEN RETURN NEW; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(NEW.order_items) LOOP
    SELECT * INTO v_product FROM public.cms_products WHERE id::text = v_item->>''product_id'' FOR SHARE;
    IF NOT FOUND THEN v_items := v_items || jsonb_build_array(v_item); CONTINUE; END IF;
    v_origin := COALESCE(v_product.product_origin, CASE WHEN v_product.is_non_bakery THEN ''beyond'' ELSE ''joko'' END);
    IF v_product.maker_id IS NOT NULL THEN
      SELECT * INTO v_maker FROM public.cms_makers WHERE id = v_product.maker_id FOR SHARE;
      IF v_origin = ''maker'' THEN
        IF NOT FOUND OR NOT v_maker.is_published OR NOT v_maker.is_ordering_enabled
          THEN RAISE EXCEPTION ''This maker is currently preview only''; END IF;
        IF COALESCE(NEW.purchase_type, ''online'') = ''online'' THEN
          IF NEW.pickup_date_id IS NULL THEN RAISE EXCEPTION ''Makers requires dated pickup checkout''; END IF;
          IF NOT EXISTS (SELECT 1 FROM public.payment_settings WHERE id AND online_promptpay_enabled)
            THEN RAISE EXCEPTION ''Makers requires online payment''; END IF;
        END IF;
      END IF;
      IF v_is_insert THEN
        v_item := (v_item - ''maker_name_en'' - ''maker_name_th'' - ''maker_name_zh'' - ''maker_id'') || jsonb_build_object(
          ''maker_id'', v_product.maker_id, ''maker_name_en'', v_maker.name_en,
          ''maker_name_th'', v_maker.name_th, ''maker_name_zh'', COALESCE(v_maker.name_zh, '''')
        );
      END IF;
    ELSIF v_is_insert THEN
      v_item := v_item - ''maker_id'' - ''maker_name_en'' - ''maker_name_th'' - ''maker_name_zh'';
    END IF;
    IF v_is_insert THEN v_item := v_item || jsonb_build_object(''product_origin'', v_origin); END IF;
    v_items := v_items || jsonb_build_array(v_item);
  END LOOP;
  IF v_is_insert THEN NEW.order_items := v_items; END IF;
  RETURN NEW;
END;
$makers$;
REVOKE ALL ON FUNCTION joko_makers_internal.guard_and_snapshot_order() FROM PUBLIC, anon, authenticated;
COMMIT;
']);
-- TEST ONLY: JOKO Specials Test, szijiljpasxddzgzckra.
-- Prepared fixtures. Never include this file in the production rollout.

DO $check$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM cms_products WHERE id='10000000-0000-0000-0000-000000000002' AND name_en='TEST — Butter Croissant') THEN RAISE EXCEPTION 'Expected sandbox product absent; wrong project or changed fixture'; END IF;
 IF NOT EXISTS(SELECT 1 FROM cms_pickup_locations WHERE id='20000000-0000-0000-0000-000000000001' AND name_en='Test Mae Rim') THEN RAISE EXCEPTION 'Expected sandbox location absent'; END IF;
END $check$;
INSERT INTO pickup_schedules(id,schedule_key,label_en,label_th,pickup_weekday,order_cutoff_days_before,order_cutoff_time,cancellation_cutoff_days_before,cancellation_cutoff_time)
VALUES('30000000-0000-4000-8000-000000000014','test-specials-regression-saturday','TEST ONLY — Saturday checkout','ทดสอบเท่านั้น — รับวันเสาร์',6,2,'17:00',1,'00:00')
ON CONFLICT(id) DO NOTHING;
INSERT INTO pickup_schedule_locations(schedule_id,location_id,pickup_open_time,pickup_close_time,pickup_slot_minutes)
VALUES('30000000-0000-4000-8000-000000000014','20000000-0000-0000-0000-000000000001','09:00','17:00',30)
ON CONFLICT(schedule_id,location_id) DO NOTHING;
INSERT INTO pickup_dates(id,schedule_id,pickup_date,order_cutoff_at,cancellation_cutoff_at,status,source,note_en)
VALUES('40000000-0000-4000-8000-000000000014','30000000-0000-4000-8000-000000000014','2026-10-17','2026-10-15 17:00:00+07','2026-10-16 00:00:00+07','open','manual','TEST ONLY — Specials release regular-checkout regression')
ON CONFLICT(id) DO NOTHING;
INSERT INTO pickup_date_locations(pickup_date_id,location_id,pickup_open_time,pickup_close_time,pickup_slot_minutes)
VALUES('40000000-0000-4000-8000-000000000014','20000000-0000-0000-0000-000000000001','09:00','17:00',30)
ON CONFLICT(pickup_date_id,location_id) DO NOTHING;
INSERT INTO product_date_inventory(pickup_date_id,product_id,capacity,capacity_source,override_note)
VALUES('40000000-0000-4000-8000-000000000014','10000000-0000-0000-0000-000000000002',10,'manual_seed','TEST ONLY — no real stock')
ON CONFLICT(pickup_date_id,product_id) DO NOTHING;
INSERT INTO cms_settings(setting_key,value) VALUES('pickup_v2_customer_enabled','true'),('pickup_windows_required','true')
ON CONFLICT(setting_key) DO UPDATE SET value=EXCLUDED.value;

COMMIT;
