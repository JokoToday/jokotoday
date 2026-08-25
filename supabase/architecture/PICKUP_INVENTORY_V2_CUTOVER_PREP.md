# Pickup Inventory v2 — Production Configuration & Cutover Preparation

Status: **implementation + preparation only — no production configuration writes authorized by this file**  
Date: 2026-08-25  
Base production migration state: `20260824175100_keep_customer_v2_rpcs_dark`

## 1. Core operating principle

Pickup configuration is **business data managed in Admin**, not application constants.

The application/database should provide safe machinery for configuring and enforcing the rules. It should not permanently encode values such as Saturday, Sunday, Mae Rim, In-Town, 17:00, or a product capacity.

Admin-managed recurring schedule fields are:

- schedule active / inactive state;
- pickup weekday;
- customer-facing labels (EN / TH / ZH);
- one or more pickup locations;
- order cutoff days-before and time;
- cancellation cutoff days-before and time;
- sort order.

Admin-managed concrete-date fields are:

- materialization / extension range;
- date status (`open`, `closed`, `sold_out`);
- exact order cutoff timestamp;
- exact cancellation cutoff timestamp;
- date-specific locations;
- date notes (EN / TH / ZH).

Product availability and capacity also belong in Admin, but that is a later slice because the real production catalog has not yet been onboarded.

The initial business intention is Saturday + Sunday pickup only. That is an **initial Admin configuration**, not an architecture rule. Friday or any other recurring pickup pattern can be enabled later without a migration or source-code change.

Customer self-cancellation is intended to default to the same cutoff as ordering. The Admin UI supports that default while retaining the database's ability to represent an explicit exception.

## 2. Current safe rollout state

The Phase A database architecture is installed, but customer traffic remains on the legacy order path.

Expected state before live configuration:

- recurring pickup schedule definitions may exist;
- concrete `pickup_dates` may remain empty until Admin materializes them;
- `product_schedule_capacity` may remain empty until the real catalog is onboarded;
- `product_date_inventory` may remain empty until products receive recurring capacity or date overrides;
- no v2 orders have `pickup_date_id` yet;
- `create_online_order_v2` and `cancel_online_order_v2` remain unavailable to browser customer roles.

No customer frontend cutover should occur until all rollout gates are cleared.

## 3. Recurring Pickup Schedule Admin

The v2 Pickup Schedule Admin UI reads from:

- `pickup_schedules`;
- `pickup_schedule_locations`;
- `cms_pickup_locations`.

Writes use the reviewed admin-only transactional RPC:

- `admin_upsert_pickup_schedule_v2(...)`.

Admin can:

- view active and inactive recurring schedules;
- create a schedule;
- edit EN / TH / ZH labels;
- choose pickup weekday;
- assign one or more locations;
- edit order cutoff days-before + time;
- use cancellation cutoff = order cutoff by default;
- optionally set a separate cancellation cutoff;
- activate / deactivate a recurring schedule;
- edit sort order.

`schedule_key` remains a stable immutable technical identifier after creation.

### Recurring schedule versus concrete dates

A recurring schedule is a template. A concrete pickup date is a materialized customer-selectable occurrence.

Changing the recurring template must not silently rewrite already-materialized customer dates. The database deliberately blocks changing a schedule's weekday after concrete dates exist. Existing dates are managed through the concrete-date Admin workflow instead.

## 4. Concrete Pickup Date Admin

The authenticated Admin workspace now has a dedicated **Concrete Pickup Dates** section.

### 4.1 Materialization / calendar extension

Admin can choose a future date range and call:

- `materialize_pickup_dates_v2(start_date, end_date)`.

The UI defaults to an eight-week range as an operational convenience, but the range is editable and is not a business rule.

Safety behavior:

- the Admin UI only materializes future dates;
- one operation is limited to 366 days, matching the server guard;
- only currently active recurring schedules produce concrete dates;
- missing date rows are created idempotently;
- recurring schedule locations are snapshotted into `pickup_date_locations`;
- configured recurring product capacities, if any, are snapshotted into `product_date_inventory`;
- existing `source = 'manual'` concrete dates are preserved;
- customer v2 ordering remains dark regardless of materialization state.

The Admin UI requires an explicit confirmation before materialization because branch previews currently use the live Supabase environment.

### 4.2 Concrete-date settings

Each materialized date can be edited through:

- `admin_update_pickup_date_v2(...)`.

Admin can set:

- status: `open`, `closed`, or `sold_out`;
- exact order cutoff timestamp;
- cancellation cutoff, defaulting in the UI to the order cutoff;
- EN / TH / ZH date notes.

A date edited through this RPC becomes `source = 'manual'`, protecting that snapshot from later materializer resets.

Date timestamps are presented and edited in `Asia/Bangkok` and converted to UTC ISO timestamps before the RPC call.

### 4.3 Concrete-date locations

Date-specific location changes use:

- `admin_set_pickup_date_location_v2(...)`.

The UI deliberately saves each location toggle as its own explicit RPC action rather than bundling several location mutations into the date-settings save. This keeps each Admin action atomic and avoids a multi-RPC save that could partially succeed.

UI guards include:

- an open date must keep at least one active pickup location;
- a globally inactive location cannot be newly enabled for a concrete date;
- disabling the last active location on an open date is blocked;
- every live location change requires explicit confirmation.

Existing orders retain their stable `pickup_date_id` / location identity even if Admin later closes a date or disables that location for new orders.

## 5. Product data is not ready for capacity configuration

The current `cms_products` rows are not the final production catalog. They are placeholder / development-era product records and must not be treated as authoritative launch-capacity inputs.

Therefore:

- do **not** derive v2 recurring capacities from current placeholder products;
- do **not** seed capacity from `stock_by_day`, `stock_remaining`, `stock_total`, or historical demand;
- do **not** require capacity values before the real catalog is uploaded;
- do **not** make placeholder availability metadata a launch commitment.

## 6. Product availability and capacity belong in Admin

For each real product, Admin must later be able to manage recurring availability and capacity by recurring pickup schedule.

The v2 database already supports this through:

- `admin_set_product_schedule_capacity_v2(...)`;
- `admin_set_product_schedule_availability_v2(...)`;
- `admin_set_product_date_capacity_v2(...)` for exceptional concrete dates.

`admin_set_product_schedule_capacity_v2(..., p_apply_to_future_dates = true)` can populate/update future materialized recurring-default inventory while preserving explicit date overrides.

This product/inventory Admin UI is the next implementation slice after recurring schedules + concrete dates.

## 7. Revised Phase A3 sequence

### A3a — Admin configuration tooling

1. recurring Pickup Schedule Admin UI;
2. Concrete Pickup Date Admin UI;
3. product recurring availability + capacity Admin UI;
4. product concrete-date capacity override Admin UI;
5. validate Admin authorization and all server-side invariants.

### A3b — initial business configuration through Admin

Only after the Admin tooling is reviewed and deployed:

1. configure the intended launch recurring schedules through Admin;
2. configure order/cancellation cutoffs through Admin;
3. materialize the desired future pickup horizon through Admin;
4. inspect every concrete date, location and cutoff;
5. keep product capacity empty until the real catalog is onboarded;
6. keep customer v2 RPCs dark.

### A3c — real product onboarding

1. upload/configure the real production catalog;
2. choose recurring schedule availability per product;
3. enter production capacity per product + schedule;
4. propagate recurring defaults to future dates;
5. use concrete-date capacity overrides where required;
6. verify `product_date_inventory` against Admin configuration.

### A4 — customer frontend cutover

Only after schedule/date/product Admin flows are stable and the legacy reservation gate is clear:

- customer calendar reads concrete dates;
- customer location selection reads concrete date locations;
- customer stock reads a safe v2 availability surface;
- checkout uses `create_online_order_v2`;
- v2 cancellation uses `cancel_online_order_v2`;
- authenticated EXECUTE is granted to customer v2 RPCs only in the separately reviewed final cutover migration.

## 8. Legacy reservation gate

Before customer v2 cutover, every active future legacy reservation must either:

1. age out / resolve under the legacy flow; or
2. be reconciled into the v2 inventory ledger in a separately reviewed operation.

The read-only audit treats nullable order status fail-closed by coalescing null to an active/pending state.

No schedule or concrete-date Admin tooling removes this gate.

## 9. Transition clarity

Current customer checkout remains on v1.

Legacy Admin sections remain labelled explicitly as legacy where they still support current v1 checkout. The v2 recurring schedule and concrete-date controls do not themselves activate customer v2 ordering.

No browser customer role receives v2 RPC EXECUTE merely because schedules or dates exist.

## 10. Required cutover smoke tests

Before enabling v2 customer traffic:

- active recurring schedules are driven entirely by Admin configuration;
- materialization creates dates only for active recurring schedules;
- Bangkok order/cancellation timestamps are correct;
- manual concrete-date settings survive later materializer runs;
- closed/sold-out dates reject ordering;
- disabled date/location combinations reject ordering server-side;
- an open date cannot be left without an active location through normal Admin UI;
- a product without configured capacity is not orderable;
- recurring product capacity changes propagate correctly to future recurring-default inventory;
- explicit product/date overrides are not overwritten by recurring edits;
- simultaneous final-unit attempts cannot oversell;
- cancellation restores the shared pool;
- idempotent retry does not double reserve;
- customer cannot call Admin RPCs;
- customer cannot cancel another customer's order;
- customer v2 RPCs remain dark until final cutover;
- `reserved_quantity = SUM(inventory_events.reserved_delta)` for every v2 pool.

## 11. Production change gates

Separate explicit approval remains required during rollout preparation before production actions including:

- changing live recurring schedule configuration;
- materializing live concrete pickup dates;
- changing live concrete-date status/cutoffs/locations;
- reconciling a legacy reservation into the v2 ledger;
- applying any new migration/RLS/grant/auth change;
- granting browser access to customer v2 RPCs;
- merging/deploying the eventual customer cutover.

After the Admin system itself is reviewed and deployed, ordinary schedule/date/product configuration is intended to become normal authorized Admin business operation rather than requiring a source-code change or migration each time.
