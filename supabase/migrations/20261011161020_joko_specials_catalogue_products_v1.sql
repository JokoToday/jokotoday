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
