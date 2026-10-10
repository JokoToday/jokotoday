# Pickup windows v1 foundation

This change implements approximate pickup windows. It does not activate customer notifications, implement notification scheduling, or change payment workflows. Thank-you after committed pickup and no-pickup after operation closing remain required follow-up events in the unified notification architecture.

## Data and behavior

Recurring schedule/location associations hold nullable opening time, closing time and interval. New concrete date/location associations copy those defaults once. Existing associations require deliberate configuration; recurring edits do not rewrite them. Concrete associations have a revision. Intervals are 15, 30 or 60 minutes; hours must fit complete intervals within one Bangkok business date. Windows are informational and have no capacity counter.

Online checkout sends date, location, selected interval and operation revision. PostgreSQL validates the interval against the current operation and snapshots start/end, revision and localized location names/maps in the same order transaction. Existing inventory, payment, loyalty and Makers triggers remain in place. Both existing online-order RPC entry points reject new slotless orders when enforcement is enabled. Historical orders remain valid; ordinary Admin use of customer checkout follows the customer rule.

The request reference remains idempotent. A matching retry returns the original snapshot even after cutoff; a different slot under the same committed reference is rejected. Cancellation reactivation checks that a snapshotted window still belongs to the current operation. Snapshots are never rewritten by Admin hours edits.

Admin RPCs check the authenticated trusted profile role, use an empty search path, lock the parent operation and reject stale editor timestamps. Changes are audited in a private RLS table. Configured operations with active online orders cannot be retimed in this first change: an amendment/notification workflow is needed before allowing that action.

## Rollout

1. Review the migration and compare the live definitions of `create_online_order`, `create_online_order_v2`, and `private.customer_pickup_availability_v2` with the source captured by this change. These functions contain existing order logic; reconcile intervening changes before applying. Confirm orders have `client_request_reference` and `online_order_number_seq` is present.
2. Apply `20261010141700_pickup_windows_v1_foundation.sql` only through the approved database rollout. It defaults `pickup_windows_required` to false and does not backfill invented hours or historical slots.
3. Deploy the frontend. Configure actual recurring defaults and every existing future bookable concrete operation in Admin. Concrete operations created before configuration do not automatically inherit later recurring edits.
4. Check EN/TH/ZH checkout, account order detail, date/location changes, unavailable hours, stale selections, offline retry and cancellation/reactivation against a representative staging database, including existing payment and Makers triggers.
5. Enable the Admin rollout toggle. The server refuses activation until pickup v2 is enabled and all currently bookable operations have hours. Older slotless checkout clients receive `PICKUP_WINDOW_REQUIRED` and must refresh.
6. Monitor checkout failures and audit records. Disable the toggle for a reversible enforcement rollback; retain schema and snapshots. Do not drop populated columns as a rollback.

Concurrent creation/reactivation of unconfigured operations during activation can cause those operations to reject new checkout until configured. Server validation fails safely; Admin should configure defaults before materialization and avoid concurrent schedule changes during rollout. Direct CMS writes are already Admin-only, but the toggle RPC is the supported path because it performs readiness checks and writes audit history.

## Verification

Run `npm ci`, `npm run typecheck`, `npm run build`, and `node scripts/test-pickup-windows.mjs`.

For an isolated PostgreSQL integration test, install `@electric-sql/pglite` outside the app, then run:

```sh
PGLITE_MODULE=/absolute/path/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-pickup-windows-db.mjs
```

The fixture exercises migration execution, default copying, Admin authorization, optimistic edits, slot validation, snapshot retention, retry deduplication, inventory/outbox counts and legacy null slots. It deliberately does not recreate all production Auth/payment/Makers triggers or claim end-to-end provider coverage. No production migration or provider sends are part of these checks.

## Next notification changes

Build event/channel delivery rows and the transactional outbox before provider scheduling. Reminder eligibility must use operation opening time; no-pickup must revalidate uncollected state at operation closing (grace policy still requires final configuration); thank-you must originate from the authoritative pickup transition. Email and LINE deliveries must remain independently retryable and auditable, with EN/TH/ZH templates and separate LINE identity/friendship eligibility. Existing confirmation email has not yet been extended to render the new window snapshot in this foundation change.
