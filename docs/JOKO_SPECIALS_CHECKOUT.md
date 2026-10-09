# JOKO Specials checkout, payment, pickup and LINE

This extends the inventory foundation on draft PR #236. It reuses `orders`, `payment_transactions`, the private payment-slip bucket and the existing payment/admin email outbox. Regular and Specials carts remain separate.

## Exact lifecycle

| Event | Inventory | Financial | Fulfillment |
| --- | --- | --- | --- |
| Atomic customer checkout | Available → held | Pending | Awaiting payment |
| Complete slip upload registered before deadline | Held → verifying | Verifying | Awaiting payment |
| Exact amount, exact frozen registered receiver, new bank reference, timely transfer and result | Held → committed | Verified | Ready |
| Rejected/wrong-recipient slip before payment deadline | Verifying → held | Pending | Awaiting payment |
| Hold expiry or customer cancellation | Held → available | Pending | Cancelled |
| Positive confirmed JOKO payment with wrong amount, ambiguous duplicate, late result, cancelled batch or released stock | Hold released; never reacquired | Reconciliation required | Cancelled |
| Admin records refund intention | Committed stays committed; released stays released | Refund pending | Cancelled |
| Admin records an actual full bank refund with unique reference | No automatic restocking | Refunded, or refund pending if another receipt remains | Cancelled |
| Authorized pickup during frozen window | Committed stays committed | Verified | Picked up |
| Pickup window expires | Committed stays committed | Verified | No-show |

Payment deadline is server checkout time + 15 minutes. New checkout closes 15 minutes before sales end. A complete, uploaded slip must be registered before the original deadline to retain stock until deadline + 3 minutes. Bad slips and retries never extend either deadline. Transfer date must be between checkout creation and the payment deadline. A response arriving at or after the grace deadline cannot commit stock. Six slip submissions per order bound storage/provider use; further submissions need Admin help.

One batch row lock serializes inventory, expiry, payment completion and pickup. All cart lines, prices, quantity caps, profile snapshots, order creation and payment creation commit together. Caps count active holds and committed units. A UUID plus exact customer/batch/cart makes checkout retryable. Provider calls happen after the upload/registration transaction, outside database locks. A transport failure leaves the attempt in flight until its deadline; customers can resubmit an already-paid slip after release for reconciliation. No automatic second payment is requested.

Bank references are unique across Specials receipts and the existing regular payment finalizer, with a common advisory lock. Full refund references are also unique. Wrong-recipient transfers are evidence, not JOKO receipts. Refund recording records a bank action already completed; it does not execute a bank transfer. Partial refunds are not supported in this release.

## Customer and staff workflow

`/specials` shows the live same-day batch, frozen discount prices, available quantities, location and Bangkok pickup times. Customers sign in with a complete name/phone profile, choose quantities, then reserve and pay. The genuine merchant QR is displayed with the server-priced order total; the same amount-specific K SHOP generator used by regular checkout preserves the merchant data, and customers check the banking app's receiver name. The panel shows countdown, verification, late-payment review, cancellation and pickup status. My Orders can reopen it on another device. Regular cancellation/repeat/payment controls cannot bypass Specials rules.

Pickup Desk uses the normal member QR/member-code lookup. Staff choose their actual desk location. Specials accepts only server-verified online payment, never manual cash or a staff “QR received” override. Only Admin or staff assigned to that location can hand over an order, within its immutable Bangkok same-day window. Pickup is idempotent. Specials has no loyalty earning or redemption in this release. Closing sales preserves paid pickup rights. Emergency cancellation requires resolving uncollected paid commitments first.

Admin prepares and physically isolates stock using the foundation workflow, imports the existing server K SHOP master QR (or uploads the same bank QR), checks and snapshots its registered receiver, assigns staff locations, then publishes. Publication requires an active location, active products, enabled payment, stock and an open sales window. Refund intentions and actual refunds are separate controls. Neither refund nor no-show automatically returns committed goods to the pool; physical leftovers require an explicit counted inventory adjustment.

## LINE

Admin publishes, prepares the preview, reads the exact frozen bilingual announcement, then deliberately presses **Send this LINE announcement**. The canonical destination is `https://joko.today/specials`. The audience is eligible friends of JOKO's LINE Official Account; LINE login alone is not friendship.

One durable outbox row per batch owns its UUID retry key and exact message. Claim uses a two-minute lease; overlapping claims cannot send. The Edge Function sends the same content with `X-Line-Retry-Key` on the first request and every retry. HTTP 2xx or 409 with `x-line-accepted-request-id` means **accepted**, never delivered/read. Transport/5xx/429 outcomes stay uncertain. Manual retries use the original key and content; stop at 23 hours to stay inside LINE's 24-hour deduplication window. Closed, sold-out or stale campaigns are suppressed. A previously ambiguous send stays uncertain when suppression prevents retry; the system cannot retract a request already accepted externally.

References: [LINE retry API](https://developers.line.biz/en/docs/messaging-api/retrying-api-request/), [LINE broadcast API](https://developers.line.biz/en/reference/messaging-api/#send-broadcast-message), [EasySlip bank verification](https://document.easyslip.com/en/v2/verify/bank/).

## Database and access

Migration `20261008110550_joko_specials_checkout_v1.sql` follows the inventory foundation and current payment rail. It adds three order columns, a checkout lifecycle table and a LINE outbox. Private tables contain hold lines, immutable receiver/QR snapshots, verification attempts/evidence, money receipts, staff location assignments, configuration and admin operation audit/retry records. These are operational records, not another order/payment system. The later `20261009025239_joko_specials_payment_compatibility_v1.sql` restores the expiry dispatcher after the regular timeout migration, blocks regular reactivation/customer expiry for Specials, and prevents regular payment handoff creation in both the Edge handler and a database trigger.

Browser roles cannot write operational tables. Customer RPCs derive identity from `auth.uid()`; service verification RPCs are service-role-only and the Edge Function derives the customer from `getUser`. Admin RPCs independently check the profile role. Anonymous catalog returns a curated projection only. Keep `specials_private` out of PostgREST's exposed schemas. The private schema's function/schema grants support invoker wrappers; they do not grant table access.

Legacy privileged cancellation, payment, pickup and loyalty RPCs reject Specials before side effects. The existing expiry RPC dispatches Specials to its grace-aware batch sweep. A trigger also blocks direct authenticated insert/update/relabeling of Specials orders through existing staff policies. The new minute cron closes sales, releases overdue holds and records no-shows. On installations without pg_cron, an authenticated service scheduler must invoke `specials_sweep_v1` every minute; checkout/state/pickup also reap under the batch lock.

## Deployment sequence and pilot

No production migration, deployment, real payment or LINE broadcast was performed while preparing this change.

1. Review all three Specials migrations and take the engineering-required backup/approval before any production database change. Test against a disposable full-schema Supabase database, including existing regular commerce functions and triggers.
2. Apply the foundation, checkout, then payment compatibility migrations in timestamp order with the regular payment migrations. Run the post-apply audits and confirm `joko-specials-expiry-v1` is scheduled. Keep payment disabled initially and the private schema unexposed.
3. Deploy `specials-verify-payment`, `specials-line-send`, `specials-merchant-config`, and the changed regular `create-payment-handoff`, `verify-payment-slip`, `promptpay-payment-intent`, `send-payment-confirmation` and `send-admin-order-notification` functions. Existing regular endpoints must reject Specials before they can expire or mutate its payment. Then deploy the frontend; its My Orders query requires the new schema.
4. Set server-only `EASYSLIP_API_KEY` and `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`, the existing server `KSHOP_MASTER_QR_PAYLOAD`, plus normal Supabase environment credentials. Verify the LINE token belongs to the correct JOKO OA. Never store either provider token in browser configuration.
5. Admin supplies a valid amount-free static Thai merchant QR and its exact EasySlip-registered bank short code, bank number and receiver label. TLV/currency/country/CRC and no-fixed-amount checks are enforced in the database. Check the actual receiver in a banking app; complete a small exact-amount payment/slip pilot, a rejected/mismatched slip and a late-payment refund before enabling a real batch.
6. Assign desk staff, pilot same-day handover and expiry, then preview LINE. A live broadcast needs a separately deliberate Admin send; deployment never sends automatically.

## Validation

Run the isolated PostgreSQL/PLpgSQL tests using the pinned external runtime described in `JOKO_SPECIALS_PHASE1.md`:

```sh
PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node scripts/test-specials-foundation.mjs
PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node scripts/test-specials-checkout.mjs
npm run typecheck
npm run lint
npm run build
```

The tests execute the migration unchanged and cover atomic checkout rollback, idempotency, RLS/function permissions, legacy bypass rejection, caps, cancellation/expiry conservation, timely grace after the regular expiry replacement, reactivation/handoff bypass rejection, receiver/amount validation, late money, refund records, staff authorization, location/window enforcement, no-shows, immutable receiver settings, and LINE lease/retry/acceptance behavior. The local fixture models commerce contracts; it is not a substitute for the full-schema deployment pilot or real concurrent sessions. No external banking/provider/LINE call is made by tests.

Frontend lint has existing warnings; build has the existing large-chunk warning. Chromium is unavailable here, so responsive visual QA remains part of the pilot. Direct Deno dependency resolution is blocked at jsr.io; the new handlers are also checked against local Supabase dependencies with the runtime declaration import omitted in temporary copies. Full deployed dependency resolution still needs the disposable Supabase run.
