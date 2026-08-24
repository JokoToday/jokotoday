# Pickup Date + Multi-Location + Shared Inventory Architecture v2

Status: **design/preparation only — not approved for production apply**  
Date: 2026-08-24  
Scope: JOKO TODAY pickup scheduling and online-order inventory

## 1. Why this exists

The legacy model identifies a customer pickup primarily by a recurring `day_key` such as `friday_maerim`. That key currently combines recurrence and location. The secure order RPC derives the next calendar occurrence at order time and decrements mutable `cms_products.stock_by_day` using the recurring key.

That model cannot cleanly support all three desired behaviors at once:

1. the customer chooses an **explicit calendar date**;
2. one date can offer **multiple pickup locations**; and
3. all locations consume **one shared product capacity for that date**.

The legacy cancellation flow also resolves schedule metadata through the order's historical text label. That makes customer-facing schedule renames unsafe for pending historical orders.

This architecture separates recurring configuration, concrete pickup occurrences, location choice, and inventory identity.

## 2. Core business invariant

**Inventory belongs to `(pickup_date, product)`, never to `(pickup_date, location, product)`.**

Example:

```text
Friday 28 Aug — Plain Croissant
capacity: 20

Mae Rim orders        5
Nimman orders         4
Old City orders       3
Hang Dong orders      2
                     --
reserved             14
remaining             6
```

All four locations reserve against the same `product_date_inventory` row.

The database schema deliberately gives `product_date_inventory` **no `location_id` column**.

## 3. Target entities

### `pickup_schedules`

Recurring template such as "Friday" or "Sunday".

Important fields:

- stable `schedule_key`
- localized labels
- `pickup_weekday`
- order cutoff as **days-before + time**
- cancellation cutoff as **days-before + time**
- active state / sort order

The initial metadata backfill keeps current `cms_pickup_days.day_key` as `schedule_key` and `legacy_day_key` for transition compatibility.

### `pickup_schedule_locations`

Many-to-many default locations for a recurring schedule.

A Friday schedule can therefore offer Mae Rim, Nimman, Old City and Hang Dong simultaneously without creating four separate inventory pools.

### `pickup_dates`

Concrete customer-selectable occurrence, e.g. `2026-08-28`.

It stores materialized:

- `pickup_date`
- `order_cutoff_at`
- `cancellation_cutoff_at`
- status: `open`, `closed`, `sold_out`
- manual/legacy override notes

Runtime checkout no longer needs to translate weekday names into a date or cutoff.

### `pickup_date_locations`

Concrete locations available on one date.

They are snapshots of recurring schedule locations so a one-off event can disable one location without changing every future Friday.

### `product_schedule_capacity`

Recurring production default per schedule + product.

Example:

```text
Friday / Plain Croissant / 20
Friday / Almond Croissant / 12
Friday / Sourdough / 10
```

No location dimension exists here.

### `product_date_inventory`

Authoritative concrete inventory pool per pickup date + product.

Key fields:

- `capacity`
- `reserved_quantity`
- `capacity_source`: recurring default or date override
- optional override note

Invariant:

```text
0 <= reserved_quantity <= capacity
remaining = capacity - reserved_quantity
```

### `inventory_events`

Append-only reservation ledger.

`reserved_delta` convention:

- positive = reservation/increase
- negative = release/cancellation

For v2-managed inventory, the mutable balance must reconcile to the event ledger.

### `orders.pickup_date_id`

Stable foreign key from a v2 order to the concrete occurrence.

The existing snapshot fields remain:

- `pickup_date`
- `pickup_location_id`
- `pickup_day`

Those remain useful for display/history, but the new ID becomes the business identity.

A composite foreign key ensures that a v2 order's selected location is actually attached to that concrete date.

## 4. Schedule and date semantics

Recurring schedules are templates. Concrete dates are snapshots.

Editing a Friday schedule does **not** silently rewrite already materialized dates. This is intentional: a date that customers may already be ordering against must not change unexpectedly because a recurring template was edited.

Recommended operating model:

- keep approximately 8–12 weeks of future dates materialized;
- materialize new dates on a recurring maintenance job later;
- after a recurring schedule edit, explicitly materialize/generate the desired future horizon;
- use date-level Admin controls for exceptions already materialized.

The provided materializer allows at most 366 days per call as a safety bound.

## 5. Cutoff model

The recurring configuration uses relative values rather than weekday-name joins:

```text
Friday pickup
order cutoff:        2 days before at 17:00
cancellation cutoff: 1 day before at 00:00
```

When Friday 28 August is materialized, concrete timestamps are stored in `pickup_dates` using `Asia/Bangkok`.

One-off date edits change those concrete timestamps directly.

This removes weekday/date ambiguity from customer order creation.

## 6. Multiple locations

The customer flow after frontend cutover becomes:

```text
1. Choose Friday, 28 August 2026
2. Choose an enabled location for that date
3. Choose products / quantities
4. Place order
```

If only one location is available, the UI may auto-select it.

Changing location never changes the product inventory pool.

## 7. Capacity model

### Recurring default

Admin sets one capacity per product + recurring schedule.

Future dates copy that capacity when materialized.

### Date override

Admin may override one product on one concrete date.

Example:

```text
28 Aug  Plain Croissant 20  recurring default
04 Sep  Plain Croissant 30  date override
11 Sep  Plain Croissant 10  date override
18 Sep  date closed
25 Sep  Plain Croissant 20  recurring default
```

A capacity reduction below already reserved quantity is rejected transactionally.

## 8. Why legacy `stock_by_day` is not backfilled as capacity

The existing secure order function decrements `cms_products.stock_by_day` when an order is placed. Therefore a value such as:

```text
friday_maerim: 6
```

may mean **6 remaining**, not **6 original production capacity**.

Consequently neither migration automatically populates `product_schedule_capacity`.

Before frontend cutover, recurring capacities must be explicitly established as business data after running the preflight audit.

This avoids silently converting a mutable remaining balance into a recurring production rule.

## 9. Transactional RPC boundary

Direct writes to the new scheduling/inventory tables are not granted to browser roles.

Prepared functions:

- `materialize_pickup_dates_v2`
- `admin_upsert_pickup_schedule_v2`
- `admin_set_product_schedule_capacity_v2`
- `admin_set_product_date_capacity_v2`
- `admin_update_pickup_date_v2`
- `admin_set_pickup_date_location_v2`
- `create_online_order_v2`
- `cancel_online_order_v2`

All write functions are `SECURITY DEFINER`, pin `search_path = public`, and perform explicit authorization/ownership checks.

The Admin schedule function writes the schedule and its location links inside one PostgreSQL transaction. This replaces the unsafe browser pattern of updating related tables with independent requests.

## 10. `create_online_order_v2`

The v2 order RPC receives:

```text
order_number
pickup_date_id
pickup_location_id
items
notes
```

It verifies and locks, in one transaction:

1. authenticated/completed customer;
2. idempotent order reference;
3. concrete pickup date exists, is open, is not past, and is before cutoff;
4. selected location is active for that exact date;
5. products still exist and are active;
6. a date-level inventory row exists for every requested product;
7. shared remaining capacity is sufficient;
8. product inventory rows are locked in deterministic product-ID order;
9. order snapshot is inserted;
10. reservations are incremented;
11. append-only inventory events are written.

A Mae Rim order and a Nimman order therefore contend for the exact same locked product/date row.

## 11. `cancel_online_order_v2`

Only orders containing `pickup_date_id` use the v2 cancellation function.

It:

- locks the order and concrete pickup date;
- checks ownership/status/payment/pickup state;
- uses the materialized concrete cancellation cutoff;
- locks and releases the same product/date inventory rows;
- writes negative reservation ledger events;
- preserves the existing loyalty-point reversal behavior;
- marks the order cancelled atomically.

Legacy orders continue to use the existing `cancel_online_order()` until separately reconciled or aged out.

## 12. Legacy override bridge

During transition, `materialize_pickup_dates_v2` can apply current active `pickup_overrides` to generated legacy schedules.

This bridge assumes the current legacy model in which each legacy `day_key` identifies a single pickup location. Once the v2 Admin/date UI becomes authoritative, legacy overrides should stop being written and the bridge should eventually be retired.

Manual v2 date edits are never overwritten by rematerialization.

## 13. Existing orders

The foundation migration does not populate `orders.pickup_date_id` for historical/current orders.

Reason: resolving old orders through text labels is exactly the ambiguity this architecture is removing.

The preflight script identifies future orders that do not resolve to exactly one legacy schedule. Only after that audit should an optional, separately reviewed order-link reconciliation be considered.

There is no requirement to backfill old completed orders merely to launch v2.

## 14. RLS / privileges

Public/customer direct read is limited to schedule/calendar/location metadata.

Direct browser writes are revoked for all new tables.

Capacity, concrete inventory, and inventory-event tables are direct-readable only by authenticated Admin sessions under RLS.

Order and Admin mutation occurs through narrowly scoped RPCs.

A future frontend cutover will need a safe customer-facing availability read surface that exposes remaining availability without exposing private operational/event data. That read surface is deliberately not added in this preparation PR because the current frontend does not consume the v2 model yet.

## 15. Multi-vendor readiness

Phase A deliberately does **not** add vendor ownership columns. JOKO TODAY remains the single operator while the date/inventory semantics are stabilized.

The model is designed so a later vendor phase can add `vendor_id` to schedules/products/capacities without changing the crucial invariant that inventory is scoped by product + concrete pickup date, not pickup location.

For a future marketplace, one transactional order should normally belong to one vendor. A mixed-vendor checkout should create multiple vendor orders under a parent checkout rather than force one order to span incompatible schedules/cutoffs.

## 16. Rollout sequence

### Phase A0 — current PR: prepare only

- additive schema migration
- metadata-only recurring schedule backfill
- RLS/privilege design
- transactional v2 RPCs
- preflight/post-apply audit SQL
- no frontend switch
- no production apply

### Phase A1 — mandatory production preflight

Run `supabase/audits/20260824_pickup_inventory_v2_preflight.sql` PRE-APPLY section.

Stop if any hard-stop query returns rows.

Confirm explicitly:

- current schedule/location/cutoff mapping;
- future reserved orders;
- no ambiguous future order schedule resolution;
- recurring production capacities for every product/schedule intended for v2 ordering.

### Phase A2 — foundation apply

Only after explicit approval:

1. apply foundation migration;
2. run post-apply structural/RLS checks;
3. confirm existing checkout still functions unchanged;
4. confirm `product_schedule_capacity` is still empty unless explicitly populated.

### Phase A3 — configure capacity + materialize dates

Through reviewed Admin RPC calls:

1. set recurring capacities;
2. materialize 8–12 weeks;
3. inspect concrete dates/locations/cutoffs;
4. reconcile inventory rows and event baseline if any already-reserved orders are intentionally linked.

### Phase A4 — frontend cutover PR

Separate PR:

- calendar reads concrete `pickup_dates`;
- date selection stores `pickup_date_id`;
- location selector reads `pickup_date_locations`;
- product availability uses a safe v2 read surface;
- checkout calls `create_online_order_v2`;
- v2 orders call `cancel_online_order_v2`;
- Admin Pickup Schedule write UI is re-enabled against transactional RPCs.

### Phase A5 — stabilization / legacy retirement

After a stable production period:

- stop writing legacy `stock_by_day` for v2 orders;
- stop writing legacy pickup overrides;
- retire label-based cancellation dependencies;
- deprecate legacy recurring schedule mirrors in a separate reviewed migration.

## 17. Required test matrix before frontend cutover

### Date correctness

- next Friday/Saturday/Sunday match Bangkok calendar dates;
- past dates cannot be ordered;
- exact order cutoff boundary rejects correctly;
- custom concrete cutoff rejects correctly;
- closed/sold-out date rejects correctly.

### Multi-location

- one date exposes 1, 2 and 4 locations correctly;
- disabled date/location combination rejects server-side;
- globally inactive location rejects even if stale date link exists;
- changing location does not change remaining product inventory.

### Shared capacity

For capacity 20:

- Mae Rim reserves 5 -> remaining 15;
- Nimman reserves 4 -> remaining 11;
- simultaneous final-unit attempts cannot oversell;
- order cancellation restores the shared pool regardless of pickup location;
- capacity cannot be reduced below current reservations.

### Atomicity

Force failures at validation boundaries and confirm no partial order or reservation survives.

### Idempotency

Retry the same order reference and verify no duplicate order/reservation/event is created.

### RLS / authorization

- anon cannot execute write RPCs;
- customer cannot execute Admin RPCs;
- customer cannot cancel another customer's order;
- customer cannot directly mutate schedule/inventory tables;
- Admin can configure schedules/capacities through RPCs;
- SECURITY DEFINER functions retain pinned `search_path`.

### Reconciliation

For every v2 product/date pool:

```text
reserved_quantity = SUM(inventory_events.reserved_delta)
```

Any mismatch is a release blocker.

## 18. Production boundary

Nothing in this branch should be applied to Supabase merely because the PR exists or is merged.

Applying either migration changes schema/RLS/function surface and therefore requires the explicit production approval gate.
