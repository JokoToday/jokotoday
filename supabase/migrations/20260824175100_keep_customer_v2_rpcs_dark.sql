/*
  Pickup / inventory architecture v2 — customer RPC rollout gate.

  This PR prepares the v2 database architecture but does not cut customer
  traffic over to it. Keep the customer create/cancel functions unavailable to
  browser roles after schema preparation. A later, separately reviewed cutover
  migration must explicitly GRANT authenticated EXECUTE once:

    - production preflight/reconciliation is complete,
    - recurring capacities are configured,
    - concrete pickup dates are materialized and verified,
    - frontend uses the v2 contract, and
    - v2 create/cancel smoke tests are approved.
*/

BEGIN;

REVOKE ALL ON FUNCTION public.create_online_order_v2(text, uuid, uuid, jsonb, text)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.cancel_online_order_v2(uuid)
FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.create_online_order_v2(text, uuid, uuid, jsonb, text) IS
  'Prepared v2 customer checkout RPC. Browser EXECUTE intentionally revoked until a separately approved frontend cutover migration.';
COMMENT ON FUNCTION public.cancel_online_order_v2(uuid) IS
  'Prepared v2 customer cancellation RPC. Browser EXECUTE intentionally revoked until a separately approved frontend cutover migration.';

COMMIT;
