# JOKO Makers v1

JOKO buys selected products from external makers and retail shops, sets its own selling prices and prepares a single customer pickup. Makers have no seller accounts or automated payouts. Existing verified-payment confirmation and dated inventory reservation remain authoritative.

## Implemented scope

| Area | Integration |
| --- | --- |
| Foundation | `cms_makers` profiles, Admin-only mutations, public published-profile reads, separate publication/ordering flags |
| Product assignment | Nullable `cms_products.maker_id` and `product_origin`; Admin Product Editor; strict Product Staff write path unchanged |
| Public | `/makers`, `/makers/:slug`, featured homepage cards, both navigation headers, localized product/cart attribution |
| Commerce | One dated mixed basket, retail sourcing/refund/substitution disclosure, preview-only purchase gates, current-profile checks on insert/reactivation, server-authored historical maker names |
| Inventory | Existing product/date capacity, existing date cutoff, existing location availability; no separate Makers inventory |
| Settlement | JOKO purchases at retail; no commissions or supplier payout schema |

`product_origin` separates BAKED / BEYOND / MAKERS from food category and `is_non_bakery`. Existing rows retain NULL and the legacy classification fallback. No historical makers are inferred or seeded. Existing order snapshots without maker fields continue to render normally. Linked draft-maker products are hidden from public reads; Admin and Product Staff can inspect their product rows. Draft maker profiles remain Admin-only.

## Rollout order

1. Makers migration was applied to JOKO Today production on 2026-10-09 after explicit approval, recorded as `20261009154855_joko_makers_v1`. The source file remains `20261009152636_joko_makers_v1.sql`; the connector assigned the applied history timestamp. Do not reapply this migration. Schema, RLS, trigger and anonymous REST embedding were verified; all 9 products and 63 existing orders remained intact.
2. Deploy this frontend after the migration. Product queries embed the new relation, so deploying the frontend first would break catalogue reads. The older frontend remains compatible after migration.
3. Create maker profiles and assign products in Admin. Publish stories with ordering disabled. Feature selected makers on the homepage; existing six-item branding menus remain readable and gain Makers.
4. Configure existing dated capacity and pickup locations. The existing `pickup_v2_customer_enabled` and `online_promptpay_enabled` settings must be enabled for online Makers orders.
5. Verify in staging on desktop/mobile: profile/list navigation, Admin edit/upload/save, product assignment, mixed BAKED/BEYOND/MAKERS basket, common pickup dates, verified payment, pause/unpublish, and historical order display. Then enable ordering per maker.

The additive production migration is complete. Frontend merge and deployment remain separate approval steps. Payment verification, cancellation/refund operations and notification services are reused, not reimplemented. The disclosure is a customer promise; it does not add automatic item-level refunds or substitutions.

## Validation

- `npm run typecheck`
- `npm run build`
- Focused ESLint on changed TS/TSX files: zero errors; five pre-existing hook/fast-refresh warnings.
- `node scripts/tests/makers-ui.mjs`: EN/TH/ZH attribution, escaping, links, historical fallback, Admin default flags, old-menu compatibility and three-world common pickup/quantity behavior. This renders components; it does not replace browser interaction tests.
- `scripts/tests/makers-db.mjs`: isolated PostgreSQL via PGlite; executes the new migration and the repository baseline dated-order RPC with minimal fixtures. Tests anonymous/customer/Product Staff/Admin visibility, denied writes, mixed order price/reservation, idempotent retry, shortage rollback, cutoff/date/payment gates, paused sales and immutable snapshots after rename. It does not replay every existing Supabase migration or test payment provider services.
- Existing Tailwind compatibility and LINE auth/onboarding audits passed. Design-system audit completed and reports existing style usage.
- `scripts/tests/makers-browser.mjs`: real Chromium desktop/mobile checks passed using intercepted backend responses: listing/profile/product/homepage navigation, mobile menu and width, preview-only purchase gate, Admin create/edit/save, required maker selection and product assignment, three-world basket disclosure, dated order submission, Stripe payment-panel rendering and returned historical attribution. Screenshots were inspected. HTTP backend requests and external WebSockets are intercepted; no production products, orders, emails or payments are created.
- PR #256 includes current main through `fc424277f8d411ceabf65a` (PRs #257–#259), preserving recent Stripe/payment email changes.
- Actual Makers-specific provider confirmation, media upload and operational sourcing/refund rehearsal remain launch checks before enabling maker ordering. The user reports the existing Stripe issue resolved.

Run the isolated SQL check without adding a project dependency:

```sh
npm install --prefix /tmp/joko-makers-tests @electric-sql/pglite@0.5.8
JOKO_TEST_PGLITE_MODULE=/tmp/joko-makers-tests/node_modules/@electric-sql/pglite/dist/index.js node scripts/tests/makers-db.mjs
```

The browser test accepts `JOKO_TEST_PLAYWRIGHT_MODULE` (absolute path to `playwright-core/index.mjs`) and `JOKO_TEST_CHROMIUM` (an installed Chromium executable). Optional `JOKO_TEST_SCREENSHOTS` saves intermediate visual QA. It starts its own local Vite server on port 5196. No browser package or runtime dependency was added to the application.

## Recovery

Disable ordering on a maker to stop new sales while preserving stories and historical order names. Disable ordering before unpublishing. Roll back the frontend revision if needed; retain the additive schema and snapshot trigger while investigating. Do not drop maker data or remove the trigger from live orders without a separately reviewed recovery migration.
