-- Additive Makers catalogue foundation. Existing origins are left unclassified;
-- the application retains its legacy fallback until Admin reviews each product.
BEGIN;
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
COMMIT;
