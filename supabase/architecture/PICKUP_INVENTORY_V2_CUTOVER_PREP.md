# Pickup Inventory v2 — Production Configuration & Cutover Preparation

Status: **preparation only — no production configuration writes authorized by this file**  
Date: 2026-08-25  
Base production migration state: `20260824175100_keep_customer_v2_rpcs_dark`

## 1. Current safe production state

The Phase A database architecture is installed, but customer traffic remains on the legacy order path.

Expected state before configuration:

- 3 recurring pickup schedule definitions exist;
- 0 concrete `pickup_dates` rows;
- 0 `product_schedule_capacity` rows;
- 0 `product_date_inventory` rows;
- 0 orders with `pickup_date_id`;
- `create_online_order_v2` and `cancel_online_order_v2` remain unavailable to browser roles.

No frontend cutover should occur until all gates in this document are cleared.

## 2. Initial v2 pickup scope and approved cancellation policy

Business decision confirmed 2026-08-25:

> The initial v2 launch offers pickup only on **Saturday and Sunday**. Friday is out of scope for the initial launch.

The existing `friday_maerim` schedule definition should be retained for future use but kept **inactive in v2** during the initial launch. It should not be deleted, and no Friday concrete pickup dates should be materialized while it is inactive.

Initial v2 launch schedules:

| Schedule | Initial v2 state | Pickup | Order cutoff | Transitional cancellation cutoff | Approved v2 cancellation cutoff |
| --- | --- | --- | --- | --- | --- |
| `friday_maerim` | **inactive / future use** | Friday — Mae Rim | Wednesday 17:00 | Thursday 00:00 | not applied during initial launch |
| `saturday_maerim` | **active** | Saturday — Mae Rim | Thursday 17:00 | Friday 00:00 | **Thursday 17:00** |
| `sunday_intown` | **active** | Sunday — In-Town | Friday 17:00 | Saturday 00:00 | **Friday 17:00** |

Cancellation policy confirmed 2026-08-25:

> Customer self-cancellation closes at the exact same cutoff as ordering for each active pickup schedule. After the cutoff, cancellation requires staff assistance.

For the initial active schedules:

- Saturday: `cancellation_cutoff_days_before = 2`, `cancellation_cutoff_time = 17:00`;
- Sunday: `cancellation_cutoff_days_before = 2`, `cancellation_cutoff_time = 17:00`.

Friday remains a retained but inactive future schedule. Its cancellation settings do not need to be changed as part of the initial launch configuration.

Deactivating Friday in the v2 schedule table does **not** modify the legacy pickup tables or current legacy checkout flow. It controls only whether the v2 materializer and later v2 customer calendar treat Friday as an active recurring schedule.

## 3. Product data is not ready for capacity configuration

The current `cms_products` rows are not the final production catalog. They are placeholder / development-era product records and must not be treated as the authoritative launch assortment.

Therefore:

- do **not** derive v2 recurring capacities from the current placeholder products;
- do **not** seed capacity from `stock_by_day`, `stock_remaining`, `stock_total`, or historical demand;
- do **not** require capacity values before the real catalog is uploaded;
- do **not** make current placeholder availability metadata a launch commitment.

The current frontend's `available_days` and stock semantics remain useful only for understanding the legacy site during transition.

## 4. Capacity belongs in Admin

Capacity is business data, not infrastructure configuration.

For each real product, Admin must be able to manage recurring availability and capacity by active pickup schedule, for example:

```text
Plain Croissant
  Saturday Mae Rim   active   capacity 30
  Sunday In-Town     active   capacity 18
```

If Friday is activated later, the same product can then receive a Friday availability/capacity configuration without an architecture change.

Capacities may differ by product and by recurring schedule.

The v2 database already supports this through reviewed transactional RPCs:

- `admin_set_product_schedule_capacity_v2(...)`
- `admin_set_product_schedule_availability_v2(...)`
- `admin_set_product_date_capacity_v2(...)` for exceptional concrete dates.

`admin_set_product_schedule_capacity_v2(..., p_apply_to_future_dates = true)` is specifically designed to propagate a new/changed recurring capacity into already-materialized future pickup dates while preserving explicit date overrides.

### Required Admin UX

The frontend cutover work must provide an Admin interface where a product can be configured with:

- which active recurring pickup schedules it is offered on;
- capacity for each enabled schedule;
- enable/disable state per schedule;
- optional concrete-date capacity overrides later.

A product should not become v2-orderable for a schedule until an active recurring capacity exists for that product + schedule (or an explicit date override exists).

## 5. Materializing dates no longer depends on having the final catalog

Because customer v2 RPCs remain dark, schedule/date configuration can be validated independently of product inventory.

After the approved weekend schedule/cancellation configuration is applied, it is acceptable to materialize an initial **8-week** pickup-date horizon even while `product_schedule_capacity` is still empty.

That first materialization should create only:

- Saturday concrete `pickup_dates` and Mae Rim date-location rows;
- Sunday concrete `pickup_dates` and In-Town date-location rows;
- materialized order/cancellation cutoff timestamps for those weekend dates.

It should create **no Friday dates** while `friday_maerim.is_active = false`.

With zero recurring product capacities, it should create zero `product_date_inventory` rows. This is a safe and useful intermediate state.

Later, when real products are uploaded and Admin capacities are configured with `p_apply_to_future_dates = true`, the corresponding future `product_date_inventory` rows can be created without rematerializing the calendar architecture.

## 6. Revised Phase A3 sequence

### A3a — weekend schedule/date configuration

1. Re-run `20260825_pickup_inventory_v2_configuration_snapshot.sql`.
2. Set `friday_maerim` inactive in v2 while retaining the schedule definition.
3. Keep `saturday_maerim` and `sunday_intown` active.
4. Apply the approved cancellation cutoffs to Saturday and Sunday only.
5. Verify schedule/location/order/cancellation metadata.
6. Materialize an initial 8-week future pickup-date horizon.
7. Inspect every concrete date, location and cutoff timestamp.
8. Confirm there are Saturday/Sunday dates only and **zero Friday pickup dates**.
9. Confirm `product_schedule_capacity = 0` and `product_date_inventory = 0` while the catalog is still unconfigured.
10. Keep both customer v2 RPCs dark.

### A3b — real product onboarding and Admin capacity configuration

1. Upload / configure the real production catalog.
2. For each product, select Saturday and/or Sunday according to actual availability.
3. Enter the production capacity for each enabled product + schedule combination in Admin.
4. Use the reviewed Admin capacity RPC with future-date propagation enabled.
5. Verify future `product_date_inventory` rows exactly match the Admin configuration.
6. Use date-level overrides for exceptional dates where needed.
7. If Friday pickup is introduced later, explicitly reactivate `friday_maerim`, confirm its business rules, materialize Friday dates from the desired start date, and configure Friday product capacities through Admin.

No architecture migration is required merely because a new product, new capacity value, or future Friday pickup is introduced.

## 7. Legacy reservation gate

Before customer v2 cutover, every active future legacy reservation must either:

1. age out / be resolved under the legacy flow; or
2. be reconciled into the v2 inventory ledger in a separately reviewed operation.

Known blocker at preparation time:

- Saturday 2026-08-29 — Mae Rim;
- pending / unpaid;
- 1 × Spinach & Cheese Quiche;
- `inventory_reserved = true`;
- `pickup_date_id IS NULL`.

This reservation does not prevent schedule/date preparation. It does prevent enabling customer v2 checkout while it remains outside the v2 ledger.

## 8. Frontend cutover prerequisites

The frontend cutover remains a separate PR and must include:

- concrete weekend date calendar read from `pickup_dates`;
- no Friday date offered while the Friday schedule is inactive;
- location selection from `pickup_date_locations`;
- a safe customer-facing availability read surface for remaining stock;
- checkout using `create_online_order_v2`;
- v2-order cancellation using `cancel_online_order_v2`;
- Admin product recurring-schedule availability controls;
- Admin product capacity controls per schedule;
- Admin concrete-date capacity override controls;
- Admin schedule/date controls using transactional v2 RPCs;
- explicit migration/cutover that grants authenticated EXECUTE on customer v2 RPCs only when the frontend is ready.

Do **not** grant browser EXECUTE merely because dates or capacities have been configured.

## 9. Required cutover smoke tests

Before enabling customer traffic:

- Saturday/Sunday dates are correct in `Asia/Bangkok`;
- no Friday date appears while `friday_maerim` is inactive;
- order and cancellation cutoffs are identical for each active weekend schedule and enforce the exact boundary;
- closed/sold-out dates reject ordering;
- disabled location/date combinations reject ordering server-side;
- a product without configured schedule capacity is not orderable;
- changing a product's recurring capacity in Admin propagates correctly to future recurring-default inventory rows;
- explicit date overrides are not overwritten by recurring capacity edits;
- two locations on one date share one inventory pool if additional locations are later enabled;
- simultaneous final-unit attempts cannot oversell;
- cancellation restores the shared pool;
- idempotent retry does not double reserve;
- customer cannot call Admin RPCs;
- customer cannot cancel another customer's order;
- customer v2 RPCs remain dark until the final cutover migration;
- `reserved_quantity = SUM(inventory_events.reserved_delta)` for every v2 pool.

## 10. Production change gates

Separate explicit approval remains required before any of the following production actions:

- changing v2 schedule activation state (including deactivating Friday for initial launch);
- applying the approved Saturday/Sunday cancellation cutoffs;
- materializing concrete production pickup dates;
- reconciling a legacy reservation into the v2 ledger;
- granting browser access to v2 customer RPCs;
- merging/deploying the frontend cutover.

Normal future product capacity editing should become an Admin business operation after the Admin UI and authorization path have been reviewed and deployed; it should not require a new database migration for every product or capacity change.
