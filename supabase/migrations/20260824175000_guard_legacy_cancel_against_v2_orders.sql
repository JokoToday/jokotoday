/*
  Pickup / inventory architecture v2 — legacy cancellation compatibility guard.

  The existing frontend and cached clients may still call cancel_online_order().
  Once v2 orders exist, that legacy RPC must never process them because it
  restores cms_products.stock_by_day rather than product_date_inventory.

  Preserve the proven legacy implementation under an internal name, revoke
  browser execution on it, and expose a wrapper that rejects v2 orders before
  delegating legacy orders unchanged.
*/

BEGIN;

ALTER FUNCTION public.cancel_online_order(uuid)
  RENAME TO cancel_online_order_legacy_v1;

REVOKE ALL ON FUNCTION public.cancel_online_order_legacy_v1(uuid)
FROM PUBLIC, anon, authenticated;

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

REVOKE ALL ON FUNCTION public.cancel_online_order(uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_online_order(uuid)
TO authenticated;

COMMENT ON FUNCTION public.cancel_online_order(uuid) IS
  'Legacy-order cancellation entrypoint. Rejects orders linked to pickup_date_id so v2 inventory cannot be released through the legacy stock_by_day path.';
COMMENT ON FUNCTION public.cancel_online_order_legacy_v1(uuid) IS
  'Internal preserved legacy cancellation implementation. Direct client EXECUTE revoked; call through cancel_online_order(uuid).';

COMMIT;
