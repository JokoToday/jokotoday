-- Preserve Makers snapshots even when a privileged writer supplies NULL or malformed JSON.
-- No order rows, permissions or trigger bindings are changed.
BEGIN;
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
COMMIT;
