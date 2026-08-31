# Pickup v2 — Production Cutover Runbook

## Purpose

This is the controlled production sequence for completing JOKO TODAY Pickup v2.

It assumes the Pickup v2 foundation already exists in production and preserves the central invariant:

> Inventory is shared by **product + concrete pickup date**, never by pickup location.

Business configuration remains Admin-owned. This runbook does not encode fixed launch weekdays, locations, product capacities or cutoff values.

## Non-negotiable gates

Stop before any step that:

- applies a production migration;
- changes function grants / RLS;
- modifies production business data;
- enables the customer rollout setting;
- performs a real production smoke order/cancellation;
- deploys operationally sensitive backend/infrastructure changes.

The frontend can be deployed before activation because the customer flow is fail-closed when `pickup_v2_customer_enabled` is missing or false.

---

## Stage 1 — Merge and deploy dark frontend support

### 1. Admin controls

Merge the validated combined Pickup v2 Admin frontend:

- Product Pickup Capacity Admin
- recurring offered/not-offered controls
- concrete-date capacity overrides
- dedicated Pickup v2 customer rollout control

No product capacity values are seeded by code.

### 2. Customer checkout support

Merge the validated customer Pickup v2 frontend:

- safe availability client contract
- common-date intersection
- concrete pickup-date/location selector
- fail-closed checkout router
- separate `CheckoutPageV2`
- v2 order service

The legacy `CheckoutPage` remains intact.

Expected production behavior after deployment:

- `pickup_v2_customer_enabled` missing → legacy checkout
- `pickup_v2_customer_enabled = false` → legacy checkout
- unreadable/unrecognized setting → legacy checkout

### 3. Historical-order cancellation compatibility

Merge the validated My Orders compatibility change:

- `pickup_date_id IS NULL` → legacy `cancel_online_order`
- `pickup_date_id IS NOT NULL` → `cancel_online_order_v2`

This must be in production before the first v2 order exists.

### 4. Verify dark state

Read-only checks:

- customer rollout setting remains absent/false;
- v2 create/cancel RPCs remain unavailable to browser roles;
- v2 order count remains zero;
- current legacy checkout still works.

---

## Stage 2 — Apply customer-safe availability API

### 5. Apply forward availability migration

Apply only after explicit production migration approval:

`20260831121000_pickup_v2_customer_availability.sql`

Expected effects:

- creates/uses non-exposed `private` schema;
- creates privileged private availability helper;
- creates public SECURITY INVOKER wrapper;
- grants safe availability RPC execution to `anon` and `authenticated`;
- does **not** broaden SELECT access to internal inventory tables.

### 6. Post-apply verification

Verify:

- public wrapper exists and is SECURITY INVOKER;
- private helper exists and is SECURITY DEFINER with empty search path;
- `PUBLIC` has no EXECUTE privilege;
- intended browser roles can execute only the safe availability contract;
- internal Pickup v2 table RLS/policies are unchanged;
- no internal capacity source, override notes or inventory events are exposed.

If product capacity is still unconfigured, an empty availability result is expected.

---

## Stage 3 — Harden cancellation before customer grant

### 7. Apply cancellation ownership hardening

Apply only after explicit production migration/security approval:

`20260831122000_harden_pickup_v2_cancel_ownership.sql`

Expected effects:

- outer v2 cancellation boundary verifies authentication and own-order ownership;
- authoritative inventory/order cancellation runs before reserved monetary reward refund;
- internal helper repeats ownership checks;
- v2 cancellation remains dark to browser roles after this migration.

### 8. Verify hardening

Confirm:

- hardened function comment/marker exists;
- `anon`, `authenticated` and `PUBLIC` still cannot execute `cancel_online_order_v2`;
- internal helpers remain non-executable by browser roles.

---

## Stage 4 — Configure real product business data in Admin

### 9. Explicit product × schedule configuration

Through Pickup v2 Admin, configure **every active product × active recurring schedule**.

For each pair, explicitly choose:

- offered or not offered;
- recurring shared capacity when offered.

Do not infer these values from legacy:

- `available_days`
- `stock_by_day`
- `stock_total`
- `stock_remaining`

For an intentionally unavailable product/schedule pair, keep an explicit configuration row with `is_active = false`; do not rely on a missing row as business meaning.

### 10. Verify propagation

After Admin configuration, confirm:

- recurring capacity rows exist for every active product × active schedule;
- active offerings have future `product_date_inventory` rows;
- explicit date overrides remain preserved;
- inventory remains shared across locations for the same date;
- reserved quantity is never greater than capacity.

---

## Stage 5 — Run the strict cutover-readiness audit

### 11. Run

`supabase/audits/20260831_pickup_v2_cutover_readiness.sql`

Hard-stop expectations before customer grant/activation:

- missing explicit product/schedule configuration = 0
- active offering missing future inventory = 0
- future open date safety blockers = 0
- inventory bounds blockers = 0
- inventory ledger blockers = 0
- active future legacy reservations = 0

Also review:

- materialized future horizon;
- active locations;
- cutoffs;
- invariant triggers;
- v2 function privilege state.

Do not continue if any hard-stop result is non-zero.

---

## Stage 6 — Enable authenticated customer order RPCs

### 12. Apply final grant migration

Apply only after explicit production migration/security approval and after Stage 5 passes:

`20260831123000_enable_pickup_v2_customer_order_rpcs.sql`

The migration is intentionally fail-closed and refuses to grant if:

- the customer availability API is missing;
- v2 order functions are missing;
- the hardened cancellation marker is missing.

Expected grants after apply:

- `create_online_order_v2` → authenticated = true
- `cancel_online_order_v2` → authenticated = true
- anon = false for both
- PUBLIC = false for both
- internal helper RPCs remain browser-inaccessible.

### 13. Verify grants immediately

Do not enable the frontend yet.

Verify the exact function privilege matrix and rerun the relevant readiness audit sections.

---

## Stage 7 — Activate customer Pickup v2

### 14. Final pre-activation check

Immediately before activation verify again:

- no active future legacy reservation has appeared since the earlier audit;
- product configuration is complete;
- future inventory is complete;
- dates/locations/cutoffs are valid;
- reconciliation is clean;
- frontend containing v2 checkout is the current deployed release;
- My Orders dual cancellation is deployed;
- customer v2 RPC grants are correct.

### 15. Enable in Admin

Set:

`pickup_v2_customer_enabled = true`

through the dedicated Admin rollout control.

This is the activation event. No code deployment should be required at this point.

---

## Stage 8 — Controlled production smoke validation

### 16. Customer availability smoke check

With a test customer/cart verify:

- concrete materialized dates appear;
- dates after cutoff do not appear;
- cart common-date intersection is correct;
- requested quantities affect selectable dates;
- only active locations are selectable;
- multi-location date behavior is correct where applicable.

### 17. Place one controlled v2 order

Use a small real test order.

Verify:

- order has non-null `pickup_date_id`;
- selected `pickup_location_id` belongs to the selected concrete date;
- server-authoritative price snapshot is correct;
- `inventory_reserved = true`;
- `reserved_quantity` increases exactly by ordered quantities;
- matching `inventory_events` reserve rows exist;
- customer/admin notification events are created;
- loyalty behavior remains correct.

### 18. Concurrency test

For a controlled product/date capacity of 1, execute two competing reservations.

Expected:

- exactly one succeeds;
- exactly one fails cleanly;
- capacity is never oversubscribed;
- inventory-event reconciliation remains exact.

Use an isolated/testable date/product configuration; do not disrupt real customer availability.

### 19. Cancel the smoke order

Verify:

- v2 cancellation path is used;
- order status becomes cancelled;
- inventory reservation is fully released;
- matching release events exist;
- any applicable loyalty earn/reward reservation is correctly reversed/refunded;
- repeated cancellation is idempotent/safe;
- reconciliation remains exact.

---

## Stage 9 — Stabilization

### 20. Re-run readiness/reconciliation

After smoke order/cancel, rerun:

- inventory bounds checks;
- inventory-event ledger reconciliation;
- function privilege checks;
- future legacy-order gate;
- date/location safety checks.

### 21. Observe first real orders

For the initial production period, verify a sample of real orders against:

- concrete pickup date;
- location;
- inventory events;
- cancellation behavior;
- notifications;
- loyalty side effects.

Do not remove legacy compatibility immediately.

---

## Rollback

### Fast frontend rollback

Set in Admin:

`pickup_v2_customer_enabled = false`

New checkout sessions return to the legacy checkout immediately without a frontend redeploy.

### Important existing-order rule

Disabling the customer rollout does **not** convert existing v2 orders into legacy orders.

Any order with non-null `pickup_date_id` must continue to use v2 cancellation/inventory semantics. This is why My Orders version-aware cancellation must remain deployed during rollback.

### Grant rollback

If required, a separately reviewed forward migration can revoke authenticated EXECUTE on the two customer v2 order RPCs. Do not edit or reverse an applied historical migration file.

---

## Definition of Pickup v2 production-ready

Pickup v2 is production-ready only when:

- Admin configuration is explicit and complete;
- safe availability API is live;
- frontend is deployed but activation is Admin-controlled;
- customer create/cancel RPC grants are narrow and verified;
- internal helpers remain dark;
- strict readiness audit passes;
- controlled order/cancel/concurrency validation passes;
- inventory ledger reconciles exactly;
- legacy orders remain safely supported.
