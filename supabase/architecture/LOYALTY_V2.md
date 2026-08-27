# JOKO TODAY — Loyalty / Rewards v2

## Purpose

Build a production-safe loyalty foundation where customers earn generic points and JOKO TODAY controls, from Admin, what those points can be exchanged for.

There must be **no hard-coded point-to-currency conversion**. A point remains a point. Rewards are separately configured business rules.

Examples that must be representable without code changes:

- 100 points → ฿50 off
- 150 points → 10% off
- 120 points → free Butter Croissant
- 200 points → free sourdough loaf
- 250 points → birthday surprise
- 300 points → limited weekend goodie / custom reward

## Current production state (before Loyalty v2)

- `customers.loyalty_points` is the current balance field.
- `loyalty_settings` controls earning rates by `purchase_type`.
- `orders.loyalty_points_earned` snapshots points calculated for an order.
- Online orders currently calculate and credit points at order insertion; cancellation reverses them.
- Walk-in purchases calculate and credit points atomically in `record_walk_in_purchase`.
- Customer account UI displays the current balance.
- Order confirmation / history can display points earned.
- There is no reward catalogue, redemption ledger, or generic redemption workflow.

Current configured earning rules at the time this document was written:

- online: 10%
- pickup: 10%
- walk-in: 5%

These are business configuration, not architecture constants.

## Core model

### 1. Generic points

Points do not have an intrinsic baht value. The customer owns a points balance; rewards define what a given number of points can buy.

### 2. Immutable point-event ledger

All future balance mutations must be represented by an append-only `loyalty_point_events` record.

Supported event families should include:

- `migration_opening_balance`
- `earn`
- `redeem`
- `reverse_earn`
- `refund_redemption`
- `admin_adjustment`

Each event records at least:

- customer
- signed points delta
- balance after the event
- event type
- related order when applicable
- related redemption when applicable
- actor when applicable
- reason / metadata
- timestamp

`customers.loyalty_points` may remain as a cached/current balance for compatibility and fast reads, but it is not an independently editable source of truth.

### 3. Admin-managed reward catalogue

Create `loyalty_rewards` with Admin-configurable fields including:

- stable reward key
- EN / TH / ZH name
- EN / TH / ZH description
- reward type
- points required
- active / inactive
- sort order
- valid-from / valid-until window
- allowed redemption channels
- optional minimum order amount
- optional per-customer redemption limit
- optional total redemption limit

Initial reward types:

- `fixed_discount`
- `percentage_discount`
- `free_product`
- `free_item`
- `custom`

Type-specific configuration:

- fixed discount → amount in THB
- percentage discount → percentage, with optional maximum discount
- free product → linked `cms_products.id`
- free item / custom → fulfillment is represented by the reward snapshot and description; no fake monetary value is required

A free product must not be modeled merely as an equivalent cash discount.

### 4. Redemption snapshot

Create `loyalty_redemptions` so every redemption preserves what the customer actually exchanged points for, even if Admin changes the reward later.

Snapshot at least:

- reward id (nullable for historical survivability)
- reward key
- reward names
- reward type
- points spent
- configured value / percentage / linked product as applicable
- channel
- customer
- related order when applicable
- status
- timestamps

Changing a reward from 120 to 150 points tomorrow must not rewrite yesterday’s 120-point redemption.

## Earning lifecycle

Before customer redemption can be enabled, points must not become spendable merely because an unpaid preorder was created.

Target behavior:

- Online/pre-order: calculate the order’s prospective points at order creation, but credit the customer only when the order is actually picked up/completed.
- Walk-in paid purchase: credit immediately because the purchase is already completed/paid.
- Cancellation before pickup: no earn credit exists to reverse for new orders.
- Cancellation/refund after an earn event: any reversal must be an explicit ledger event and must be idempotent.

For migration safety, existing historical balances become an opening ledger balance rather than attempting to reconstruct every historical earn/reversal from old orders.

Existing orders that were already credited under the legacy trigger must be marked so later pickup processing cannot award them twice.

## Balance security invariant

A browser client must never be able to set `customers.loyalty_points` directly.

All balance changes must go through reviewed server-side database functions / triggers that:

1. authenticate and authorize the actor,
2. lock the customer balance row,
3. validate that the resulting balance cannot be negative,
4. update the cached balance,
5. insert the corresponding point event in the same transaction.

Existing broad customer self-update behavior must be prevented from mutating `loyalty_points` without breaking legitimate profile synchronization.

## Admin controls

Add a dedicated **Loyalty & Rewards** Admin workspace.

Admin must be able to configure:

### Earning rules

- online points percentage / rate
- pickup points percentage / rate
- walk-in points percentage / rate

These should continue to use the existing `loyalty_settings` model where practical, but writes must go through an admin-authorized RPC rather than browser-direct table mutation.

### Reward catalogue

Admin can:

- create reward
- edit reward
- activate / deactivate reward
- set points required
- choose reward type
- configure type-specific value/product
- select channels
- configure validity dates
- configure optional minimum order / limits
- set display order
- edit EN / TH / ZH customer-facing copy

## RPC/security requirements

Admin RPCs must:

- be `SECURITY DEFINER` only where needed,
- pin `search_path`,
- verify `auth.uid()` and DB-derived `user_profiles.role = 'admin'`,
- revoke `EXECUTE` from `PUBLIC` and `anon`,
- explicitly grant only to `authenticated` where appropriate.

New exposed tables must have RLS enabled and minimal grants.

Customer-facing redemption RPCs must remain **dark** in the initial foundation rollout. Do not grant customer execution merely because the function exists.

## Channel integration

Reward configuration and redemption accounting are independent from fulfillment.

Later integrations may include:

- online checkout
- pickup desk
- walk-in desk

For online checkout, discount/free-product fulfillment must be integrated into the atomic order transaction so points are never deducted without the corresponding order reward being applied, and inventory-backed free products must participate in the same pickup-date inventory rules as paid products.

For staff-presented rewards, redemption must be atomic with the staff fulfillment action.

## Rollout sequence

1. Add ledger + reward catalogue + redemption snapshot schema.
2. Backfill opening-balance ledger records without changing customer balances.
3. Make loyalty balance server-controlled.
4. Add Admin earning-rule and reward-catalogue RPCs/UI.
5. Harden earning lifecycle so online points settle on pickup/completion, not preorder creation.
6. Validate existing orders cannot be double-awarded.
7. Keep customer redemption dark.
8. Later integrate reward fulfillment into checkout / pickup / walk-in flows under a separate reviewed rollout.
9. Only then grant customer redemption execution where intended.

## Non-goals for the foundation PR

- No hard-coded `1 point = ฿1` or any other conversion.
- No customer redemption enablement.
- No automatic production reward seeding beyond structurally necessary data.
- No inferred reward prices or point costs.
- No product-capacity onboarding.
- No customer Pickup v2 checkout enablement.
- No production migration application without a separate explicit approval.

## Acceptance criteria

- Current customer balances are preserved exactly by migration/backfill.
- Every post-cutover balance mutation is ledgered atomically.
- Direct client mutation of `loyalty_points` is blocked.
- Admin can manage earning rules and rewards without code changes.
- Reward snapshots remain historically stable after Admin edits.
- Free-product rewards reference real products rather than masquerading as cash discounts.
- Customer redemption remains uncallable after the foundation migration.
- Existing Pickup v2 customer create/cancel rollout gates remain unchanged.
