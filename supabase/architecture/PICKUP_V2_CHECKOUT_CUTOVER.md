# Pickup v2 checkout cutover boundary

## Purpose

This note records the customer checkout activation boundary for Phase 3.

The deployed frontend is intentionally dual-path:

- `pickup_v2_customer_enabled` missing / false / unreadable → existing legacy `CheckoutPage`
- `pickup_v2_customer_enabled` true → `CheckoutPageV2`

The setting is stored in `cms_settings` and is Admin-managed. There is no hard-coded rollout date, weekday, location, capacity, or launch constant in the customer flow.

## Required prerequisites before enabling

Do not enable `pickup_v2_customer_enabled` until all of the following are true:

1. The customer-safe Pickup v2 availability API has been applied and verified.
2. Every active product × active schedule has explicit Admin configuration.
3. Active product offerings have materialized future `product_date_inventory` rows.
4. The Phase 3.8 cutover-readiness audit has no blockers.
5. `create_online_order_v2` and `cancel_online_order_v2` have the reviewed authenticated customer grants.
6. The frontend build containing `CheckoutRouterPage`, `CheckoutPageV2`, and `PickupDateSelectorV2` is deployed.
7. A controlled smoke order and cancellation can be performed immediately after activation.

## Rollback

If customer Pickup v2 must be disabled after deployment, set `pickup_v2_customer_enabled` to `false` through Admin.

The router then returns customers to the legacy checkout without requiring a frontend rollback. Existing v2 orders remain identifiable through `orders.pickup_date_id` and must continue to use `cancel_online_order_v2` for cancellation.

## Customer v2 flow

1. Checkout router reads `pickup_v2_customer_enabled`.
2. V2 checkout builds cart requirements from product IDs and requested quantities.
3. `PickupDateSelectorV2` loads the safe availability RPC.
4. Common pickup dates are calculated as the intersection of dates that can satisfy every cart item quantity.
5. Customer chooses a concrete pickup date and active location.
6. Checkout calls `create_online_order_v2` with `pickup_date_id`, `pickup_location_id`, and product quantities.
7. Server remains authoritative for cutoff, location validity, price, inventory reservation, order creation and loyalty side effects.
8. Confirmation notifications continue through the existing notification Edge Functions.
9. Cancellation uses the v2 cancellation RPC for orders with `pickup_date_id`.

## Safety properties

- Legacy checkout code remains intact.
- Rollout is fail-closed if the setting cannot be read.
- No customer availability is derived from legacy `available_days`, `stock_by_day`, `stock_total`, or `stock_remaining` on the v2 path.
- No production capacity values exist in frontend source.
- Inventory remains shared by product + concrete pickup date, never by pickup location.
- Database/server validation remains authoritative even if the browser availability snapshot becomes stale.
