# Pickup Inventory v2 — Production Configuration & Cutover Preparation

Status: **preparation only — no production configuration writes authorized by this file**  
Date: 2026-08-25  
Base production migration state: `20260824175100_keep_customer_v2_rpcs_dark`

## 1. Current safe production state

The Phase A database architecture is installed, but customer traffic remains on the legacy order path.

Expected state before configuration:

- 3 recurring pickup schedules exist;
- 0 concrete `pickup_dates` rows;
- 0 `product_schedule_capacity` rows;
- 0 `product_date_inventory` rows;
- 0 orders with `pickup_date_id`;
- `create_online_order_v2` and `cancel_online_order_v2` remain unavailable to browser roles.

No frontend cutover should occur until all gates in this document are cleared.

## 2. Recurring schedules

| Schedule | Pickup | Order cutoff | Current transitional cancellation cutoff | Recommended cancellation cutoff |
| --- | --- | --- | --- | --- |
| `friday_maerim` | Friday — Mae Rim | Wednesday 17:00 | Thursday 00:00 | **Wednesday 17:00** |
| `saturday_maerim` | Saturday — Mae Rim | Thursday 17:00 | Friday 00:00 | **Thursday 17:00** |
| `sunday_intown` | Sunday — In-Town | Friday 17:00 | Saturday 00:00 | **Friday 17:00** |

### Recommendation: align cancellation cutoff with order cutoff

The current transitional fallback allows cancellation for seven hours after new ordering has already closed. That creates a period where a customer can release capacity but another customer can no longer book it, and production may already have been committed.

Recommended v2 policy:

> Customer self-cancellation remains available until the exact order cutoff for that pickup date. After the order cutoff, cancellation requires staff assistance.

In relative schedule fields, all three schedules therefore use:

- `cancellation_cutoff_days_before = 2`
- `cancellation_cutoff_time = 17:00`

This is a business-policy recommendation only. Apply only after explicit production-data approval.

## 3. Product offering semantics inherited from the current site

The current frontend treats an empty `cms_products.available_days` array as **available on every configured pickup day**.

Therefore the current recurring offering matrix is:

| Product | Friday Mae Rim | Saturday Mae Rim | Sunday In-Town |
| --- | ---: | ---: | ---: |
| Chocolate Cake | offered | offered | offered |
| Chocolate Croissant | offered | — | offered |
| Sourdough Loaf | offered | offered | offered |
| Spinach & Cheese Quiche | — | offered | offered |
| Multigrain Bread | offered | offered | offered |
| Mushroom Pizza | offered | offered | offered |
| Plain Croissant | offered | offered | offered |
| Strawberry Shortcake | offered | offered | offered |
| Almond Croissant | offered | offered | offered |

That produces **25 recurring product × schedule capacity decisions**.

## 4. Capacity decision sheet

Capacity means the **maximum number of units of that product available for the entire concrete pickup date across all pickup locations combined**.

Do not copy current `stock_by_day` or `stock_remaining` into these fields automatically. Those are mutable legacy balances.

Fill each offered cell with an explicit production maximum:

| Product | Friday capacity | Saturday capacity | Sunday capacity |
| --- | ---: | ---: | ---: |
| Chocolate Cake | TBD | TBD | TBD |
| Chocolate Croissant | TBD | — | TBD |
| Sourdough Loaf | TBD | TBD | TBD |
| Spinach & Cheese Quiche | — | TBD | TBD |
| Multigrain Bread | TBD | TBD | TBD |
| Mushroom Pizza | TBD | TBD | TBD |
| Plain Croissant | TBD | TBD | TBD |
| Strawberry Shortcake | TBD | TBD | TBD |
| Almond Croissant | TBD | TBD | TBD |

### Demand reference only

Recent production order history is too sparse to define capacity safely. It can be used only as a lower-bound demand reference:

- Spinach & Cheese Quiche: recent observed maximum = 6 units on one pickup date;
- Chocolate Croissant: recent observed maximum = 5 units on one pickup date.

Observed demand is **not** a production-capacity recommendation.

## 5. Legacy reservation gate

Before customer v2 cutover, every active future legacy reservation must either:

1. age out / be resolved under the legacy flow; or
2. be reconciled into the v2 inventory ledger in a separately reviewed operation.

Current known blocker at preparation time:

- Saturday 2026-08-29 — Mae Rim;
- pending / unpaid;
- 1 × Spinach & Cheese Quiche;
- `inventory_reserved = true`;
- `pickup_date_id IS NULL`.

Do not enable v2 customer checkout while that reservation remains outside the v2 ledger.

## 6. Phase A3 configuration sequence

After capacity numbers and cancellation policy are approved:

1. Re-run `20260825_pickup_inventory_v2_configuration_snapshot.sql`.
2. Update recurring cancellation cutoffs.
3. Set the 25 recurring product capacities through reviewed Admin RPC calls.
4. Verify `product_schedule_capacity` exactly matches the approved matrix.
5. Materialize an initial **8-week** horizon rather than 12 weeks for the first production cycle.
6. Inspect every materialized date, location, order cutoff and cancellation cutoff.
7. Verify `product_date_inventory` rows exactly mirror the approved recurring offering/capacity matrix.
8. Keep both customer v2 RPCs dark.
9. Resolve/age out the final legacy reservation blocker.
10. Only then prepare the frontend cutover PR.

### Why start with 8 weeks

Eight weeks is long enough to exercise recurrence and exceptions while keeping the first operational review bounded. Once stable, the horizon can be extended to the architecture target of 8–12 weeks.

## 7. Materialization expectations

For each generated pickup date:

- one globally unique `pickup_dates` row exists for that calendar date;
- the schedule's active default location is copied to `pickup_date_locations`;
- each active recurring product capacity creates one `product_date_inventory` row;
- inventory identity remains `(pickup_date_id, product_id)`, never location-specific;
- order and cancellation timestamps are materialized in Bangkok time.

No materialization should occur until the cancellation policy and recurring capacities are approved.

## 8. Frontend cutover prerequisites

The frontend cutover remains a separate PR and must include:

- concrete date calendar read from `pickup_dates`;
- location selection from `pickup_date_locations`;
- a safe customer-facing availability read surface for remaining stock;
- checkout using `create_online_order_v2`;
- v2-order cancellation using `cancel_online_order_v2`;
- Admin schedule/capacity/date controls using transactional v2 RPCs;
- explicit migration/cutover that grants authenticated EXECUTE on customer v2 RPCs only when the frontend is ready.

Do **not** grant browser EXECUTE merely because capacities/dates have been configured.

## 9. Required cutover smoke tests

Before enabling customer traffic:

- Friday/Saturday/Sunday dates are correct in `Asia/Bangkok`;
- exact cutoff boundary behavior is correct;
- closed/sold-out dates reject ordering;
- disabled location/date combinations reject ordering server-side;
- two locations on one date share one inventory pool;
- simultaneous final-unit attempts cannot oversell;
- cancellation restores the shared pool;
- idempotent retry does not double reserve;
- customer cannot call Admin RPCs;
- customer cannot cancel another customer's order;
- customer v2 RPCs remain dark until the final cutover migration;
- `reserved_quantity = SUM(inventory_events.reserved_delta)` for every v2 pool.

## 10. Production change gates

Separate explicit approval is required before any of the following:

- changing recurring cancellation cutoffs;
- inserting recurring capacities;
- materializing concrete production pickup dates;
- reconciling a legacy reservation into the v2 ledger;
- granting browser access to v2 customer RPCs;
- merging/deploying the frontend cutover.
