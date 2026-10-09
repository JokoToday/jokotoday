# JOKO Specials — Phase 1 inventory preparation

Implemented scope: `/admin/specials`, private same-day batches, catalogue-based offers, manual counted stock intake/release, Admin preview, and transactional audit history. This phase does not publish a batch, create a customer hold/order/payment, send LINE, or change existing ordering behavior. `prepared` means reviewed for a later launch, never live/public.

## Findings from the read-only implementation audit (8 October 2026)

- Current production matches the relevant `cms_products`, `cms_pickup_locations`, `payment_settings` and `payment_transactions` structures on main at `01f5d11`.
- `product_date_inventory` and legacy `cms_products` stock represent scheduled availability/capacity. JOKO POS does not supply a verified shared physical surplus balance. Taking Specials stock from these fields would confuse production planning with real units.
- There is no provenance field identifying Made by JOKO. Phase 1 records an explicit Admin attestation per offer instead of guessing from a category/name or adding a catalogue taxonomy prematurely.
- Server-managed profile role is protected by column UPDATE grants. Existing own-profile INSERT policy restricts role to customer. Specials authorization uses this role and `auth.uid()`, never localStorage or browser PIN flags.
- Existing payment expiry/finalization treats the payment deadline as terminal, including verification in progress. Recipient/QR configuration is not frozen per transaction. These need Specials-specific integration before money can be accepted.
- Existing orders allow staff UPDATE under RLS. Later Specials order integration must restrict generic status/payment mutations and cancellation/stock functions, not just add a new strict policy.
- An order notification outbox already exists. Reuse it at payment confirmation; LINE login is not proof of Messaging API eligibility.

No customer records, slips or secrets were read for this audit. No production mutations were made.

## Operational flow

1. Create today's draft. All inputs represent Bangkok time regardless of the browser's location.
2. Add an active catalogue product. Reference price comes from the database and is frozen. Confirm Made by JOKO. Enter a positive special price no higher than reference and optional positive integer customer limit.
3. Count unallocated good-quality stock. Physically segregate it and remove/block it from all competing selling channels, including an external POS if used.
4. Transfer in, recording quantity, source, reason and both isolation/quality attestations.
5. Review pickup/price/inventory preview. Prepare batch. Only one prepared batch is allowed at a time, including stale prepared batches: close the old batch explicitly before preparing another.
6. Close/cancel when appropriate. Closure changes lifecycle only; it never silently returns stock.
7. Release each remaining available unit to a recorded destination (walk-in, donation, disposal, etc.). Available stock can be released from closed/cancelled batches. Held or committed units cannot be released through a transfer.

Drafts can be edited. Prepared/closed/cancelled batches cannot change price/pickup details in this slice. Additional intake to today's prepared batch is permitted before sales end, with the same physical isolation contract. Closed batches cannot reopen. Past drafts cannot receive stock or become prepared. There is no scheduled publication or expiry job in this private preparation phase.

## Database and authorization

Three tables: `specials_batches`, `specials_items`, `specials_audit_events`. Every table has RLS, explicit SELECT-only grants and an Admin-only read policy. Anonymous users have no access; customer, pickup staff and Product Staff cannot see internal rows or invoke mutations. Even Admin cannot directly INSERT/UPDATE/DELETE these tables.

The public RPC is an invoker wrapper. Its privileged implementation is in unexposed `specials_private`, has a fixed empty search path and rechecks authenticated Admin authorization. Default PUBLIC execution is revoked. The private schema must remain absent from the Data API's exposed-schema list.

Every mutation locks its operation key, locks batch before item, checks optimistic batch/item version, applies the mutation and writes one audit event in the same transaction. An exact retry with the original key returns the original result, even if the batch changed afterward. Reusing a key for a different actor/payload is rejected. Stale commands fail rather than overwrite another staff member's work.

Transfer accounting:

`quantity_allocated = quantity_available + quantity_held + quantity_committed`

`quantity_allocated = sum(transfer-in deltas + transfer-out deltas)`

No write is made to regular catalogue stock or date capacity. This is an audited manual intake, not automated synchronization with Shopchamp. Physical segregation is required for correctness outside the database.

The browser persists an unresolved operation (including UUID and exact payload) in sessionStorage before submission, and offers retry with the same key after a transport error or reload. Known transactional validation errors clear it. Server-side idempotency and constraints are authoritative.

## Validation

Run frontend checks:

```bash
npm ci
npm run typecheck
npx eslint src/features/specials src/components/AdminWorkspace.tsx
npm run build
```

Run the isolated Postgres/PLpgSQL/RLS tests without connecting to production:

```bash
npm install --prefix /tmp/joko-specials-sql-test @electric-sql/pglite@0.5.8 --no-audit --no-fund
PGLITE_MODULE=/tmp/joko-specials-sql-test/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-specials-foundation.mjs
```

The fixture creates only the prerequisite table/role contract. It then applies the real phase-1 migration unchanged. Tests cover Admin/anon/customer/staff/Product Staff permissions, replay/idempotency, stale writes, valid same-day windows, inactive references, quality/isolation attestations, integer stock, price bounds, release limits including held/committed safeguards, one prepared batch, closeout and unchanged normal product capacity. Time-dependent tests require at least 80 minutes until Bangkok midnight and fail explicitly outside that window.

This embedded single-connection Postgres test is not a full Supabase baseline/stack replay or a real concurrent-session load test. A staging PostgreSQL/Supabase replay and concurrent transfer/checkout tests remain required before activation. Browser visual review was not completed here because the Chromium download failed; review the Admin screen on a staging build before deployment. No customer hold/payment implementation is claimed by these tests.

## Rollout and rollback

Migration prepared by Supabase CLI; not applied to production by this work. Apply it before deploying the Admin frontend, after migration review/production authorization. Frontend before migration shows an Admin load error; no customer route is affected. Run `supabase/audits/20261008_specials_foundation_post_apply.sql` after migration and validate using an authorized test Admin and denied customer/staff sessions. Confirm table/RPC grants and that `specials_private` is not exposed. After applying the migration, run the configured Supabase database advisors and review notices.

Rollback the frontend to remove Admin access if necessary. Retain tables and audit records while reconciling physically segregated goods. Do not drop tables or return units to normal stock automatically. There is no payment state or customer obligation created in this phase.

## Next implementation slice

Before publishing any real batch, add atomic all-or-nothing holds tied to pending existing orders; 5-minute deadlines and two-minute bounded verification; immutable prices/pickup/recipient snapshots; late-payment reconciliation/refund records; safe expiry; Specials-specific generic-order/payment/cancellation guards; My Orders and Pickup Desk integration; and a verified payment recipient/QR pilot. Validate the current business-account QR rail independently of this inventory preparation.

After checkout is validated, publish `/specials` with an empty state/current batch and conditional homepage entry. Add prepared LINE message/manual send, then Messaging API outbox/retry flow when its audience and credentials are verified. This phase intentionally has no send button or published URL to avoid announcing unavailable stock.


Customer checkout, payment holds, pickup and LINE are now implemented in the subsequent checkout migration. See [JOKO_SPECIALS_CHECKOUT.md](JOKO_SPECIALS_CHECKOUT.md) for the complete lifecycle, access boundaries, validation and deployment sequence.
