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

The stable internal `schedule_key` is intentionally immutable after creation. It is technical identity, not a business setting.

Product availability and capacity are also Admin-managed business data:

- product enabled / disabled per recurring pickup schedule;
- recurring capacity per product + schedule;
- concrete-date capacity overrides.

## 2. Current safe production state

The Phase A v2 database architecture is installed, but customer traffic remains on the legacy order path.

Current expected state before v2 configuration/cutover:

- recurring schedule definitions exist in `pickup_schedules`;
- 0 concrete `pickup_dates` rows;
- 0 `product_schedule_capacity` rows;
- 0 `product_date_inventory` rows;
- 0 orders with `pickup_date_id`;
- `create_online_order_v2` and `cancel_online_order_v2` remain unavailable to browser roles.

No customer frontend cutover should occur until all cutover gates are cleared.

## 3. Initial business configuration — not hard-coded behavior

The current intended launch configuration is:

- Saturday pickup: enabled;
- Sunday pickup: enabled;
- Friday pickup: disabled for now.

This is an **initial Admin configuration choice**, not an architectural rule. Admin must be able to enable Friday later, disable Sunday, add another weekday, change locations, or add another recurring schedule without a code change or database migration.

The approved operating policy is:

> Customer self-cancellation closes at the same cutoff as ordering for the active schedule.

The Admin UI therefore defaults cancellation cutoff to the order cutoff, while the database remains capable of storing a separate cancellation cutoff if the business later chooses a different policy.

## 4. Recurring configuration vs concrete-date snapshots

Admin editability does not mean historical/customer-bound dates should mutate silently.

The v2 model intentionally separates:

1. **Recurring schedule configuration** (`pickup_schedules`, `pickup_schedule_locations`) — editable in Admin.
2. **Concrete pickup dates** (`pickup_dates`, `pickup_date_locations`) — stable snapshots used by customer orders.

When future dates are materialized, they copy the then-current recurring schedule rules. Later changes to the recurring template do not silently rewrite existing concrete dates or existing orders.

Important lifecycle rule already enforced by the database:

- after concrete dates exist for a schedule, that schedule's weekday cannot simply be changed;
- date-specific exceptions belong on concrete-date controls;
- a materially different recurring pattern can be represented by a new schedule / reviewed transition.

This preserves customer/order integrity while keeping normal business configuration flexible.

## 5. v2 Pickup Schedule Admin UI

PR #44 now starts the v2 Admin implementation rather than manually writing launch values directly to production.

The Pickup Schedule Admin surface uses the existing transactional RPC:

- `admin_upsert_pickup_schedule_v2(...)`

The initial UI supports:

- viewing active and inactive v2 recurring schedules;
- creating a recurring schedule;
- editing EN / TH / ZH labels;
- selecting the pickup weekday;
- assigning one or more pickup locations;
- setting order cutoff days-before and time;
- defaulting cancellation cutoff to the order cutoff;
- optionally setting a separate cancellation cutoff;
- enabling/disabling the recurring schedule;
- setting display sort order.

Authorization remains server-side. The Admin page already requires an authenticated Supabase account whose `user_profiles.role = 'admin'`, and the RPC independently checks the same role.

The legacy Holiday Overrides and Cancellation Cutoff tabs remain temporarily available and are explicitly labelled **Legacy** while current customer checkout remains on v1.

## 6. Product capacity belongs in Admin

The current `cms_products` rows are development/placeholder data and are not the final production catalog. Do not derive launch capacities from them.

No product capacity values are required at this stage.

Once the real products are onboarded, Admin must manage:

- which recurring schedules a product is offered on;
- capacity for each enabled product + schedule combination;
- enable/disable state per schedule;
- concrete-date capacity overrides.

The v2 database already supports this with:

- `admin_set_product_schedule_capacity_v2(...)`;
- `admin_set_product_schedule_availability_v2(...)`;
- `admin_set_product_date_capacity_v2(...)`.

`admin_set_product_schedule_capacity_v2(..., p_apply_to_future_dates = true)` can create/update recurring-default inventory rows for already-materialized future dates while preserving explicit date overrides.

## 7. Date materialization should also become an Admin operation

`materialize_pickup_dates_v2(start_date, end_date)` already materializes dates only for schedules that are active at execution time.

Therefore the intended workflow is:

1. Admin configures the recurring schedules.
2. Admin reviews those settings.
3. Admin materializes/extends the future calendar horizon.
4. Admin reviews concrete dates and date-specific exceptions.

The initial target may still be an 8-week horizon, but the weekday composition of that horizon comes from the active Admin configuration — not hard-coded Saturday/Sunday logic.

With no recurring product capacities configured, materializing dates creates schedule/date/location/cutoff snapshots but no product inventory rows. That is valid while customer v2 ordering remains dark.

## 8. Revised implementation sequence

### A3a — Admin schedule control

1. Implement and review v2 Pickup Schedule Admin UI.
2. Ensure schedule writes use `admin_upsert_pickup_schedule_v2(...)`, never direct browser table mutation.
3. Verify only authenticated database admins can save.
4. Keep current customer v2 RPCs dark.
5. Do not change production schedule values merely to test the UI.

### A3b — concrete-date Admin controls

1. Add an Admin action to materialize/extend a chosen future date horizon.
2. Add concrete-date list/calendar controls.
3. Support open / closed / sold-out state and date-level location/cutoff changes through reviewed v2 RPCs.
4. Preserve stable snapshots for orders already using a concrete date.

### A3c — real product onboarding and capacity Admin

1. Upload/configure the real product catalog.
2. Configure product availability per recurring schedule.
3. Configure recurring product capacity per schedule.
4. Propagate recurring defaults to future materialized dates.
5. Use concrete-date capacity overrides for exceptions.

### A3d — customer frontend cutover

Only after Admin configuration and concrete-date operations are stable:

1. customer calendar reads `pickup_dates` and `pickup_date_locations`;
2. product availability reads v2 date inventory;
3. checkout uses `create_online_order_v2`;
4. cancellation uses `cancel_online_order_v2`;
5. a separately reviewed migration grants authenticated customer EXECUTE only at the final cutover point.

## 9. Legacy reservation gate

Before customer v2 cutover, every active future legacy reservation must either:

1. age out / be resolved under the legacy flow; or
2. be reconciled into the v2 inventory ledger in a separately reviewed operation.

Known preparation-time blocker:

- Saturday 2026-08-29 — Mae Rim;
- pending / unpaid;
- 1 × Spinach & Cheese Quiche;
- `inventory_reserved = true`;
- `pickup_date_id IS NULL`.

This does not block building or reviewing the Admin UI. It does block enabling customer v2 checkout while the reservation remains outside the v2 ledger.

## 10. Required cutover behavior tests

Before enabling customer traffic:

- Admin can create/edit/enable/disable recurring pickup schedules without source-code changes;
- only database-role admins can call Admin RPCs;
- active schedule location requirements are enforced;
- materialization follows whatever schedules are active in Admin;
- schedule changes do not silently rewrite existing concrete-date snapshots;
- exact Bangkok cutoff timestamps are correct;
- closed/sold-out dates reject ordering;
- disabled location/date combinations reject ordering server-side;
- a product without configured v2 capacity is not orderable;
- recurring capacity changes propagate only to recurring-default future inventory rows;
- explicit date overrides remain intact;
- shared inventory cannot oversell under concurrent final-unit attempts;
- cancellation restores shared inventory;
- idempotent retry does not double reserve;
- customer cannot call Admin RPCs;
- customer cannot cancel another customer's order;
- customer v2 RPCs remain dark until the final cutover migration;
- `reserved_quantity = SUM(inventory_events.reserved_delta)` for every v2 pool.

## 11. Production change gates

Separate explicit approval remains required before production actions such as:

- changing live v2 recurring schedule configuration;
- materializing concrete production pickup dates;
- changing production RLS/schema/RPC authorization;
- reconciling legacy reservations;
- granting customer v2 RPC access;
- merging/deploying a customer frontend cutover with operational/security impact.

Once the reviewed Admin UI is deployed, routine business configuration (weekday activation, labels, locations, cutoffs, product availability/capacity) should be normal authorized Admin operation and should not require a new code change for every value change.
