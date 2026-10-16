# JOKO Store — Phase A findings and Phase B implementation gate

## Verified 2026-10-16 (read-only)
- GitHub main matched reviewed commit 595e1b564199a8e030e22ce07533eaf3db0b93c3 at investigation start.
- Live Supabase project: JOKO Today (not Specials Test).
- Live cms_settings pickup_v2_customer_enabled = true.
- cms_products has maker_id and product_origin. Current rows: 3 maker origin and 9 null origin; origin cannot act as storefront assignment.
- product_date_inventory has per-date capacity/reserved_quantity; it is not physical stock.
- Existing cart merges on product.id and checkout depends on one pickup context.
- Existing shipping/address/courier workflows are not part of approved Store release.
- No Store-specific DDL or deployed feature was changed during these checks.

## Phase B code in this branch
- /store route registered inside the existing shared shell.
- Browse-only, three-language preview page which reads explicit Store product assignments and renders product name, image and price; no add-to-cart or payment actions.
- Safe behavior when Store assignment table has not been migrated: display the preparation/empty state; do not fall back to Beyond.
- Top-menu redesign must remain coordinated with the separate header/navigation work; this branch does not overwrite published Admin menu configuration.

## Proposed Store assignment schema (DESIGN ONLY; NOT APPLIED)
Prefer `store_product_assignments` with
- product_id uuid primary key references cms_products(id) on delete cascade,
- is_published boolean not null default false,
- assigned_at timestamptz not null default now(),
- optionally store_category_id nullable references a Store-specific curated category table.
Use existing cms_products for multilingual content and maker attribution; do not clone products or stock balances. A single explicit assignment means a product can be maker-supplied AND Store-listed.

Suggested SQL for review (not production-ready migration):

```sql
create table public.store_product_assignments (
  product_id uuid primary key references public.cms_products(id) on delete cascade,
  is_published boolean not null default false,
  assigned_at timestamptz not null default now()
);
alter table public.store_product_assignments enable row level security;
create policy store_assignments_read_published on public.store_product_assignments
  for select to anon, authenticated using (is_published = true);
-- Admin writes: add only after verifying existing privileged role conventions.
-- Do not grant customer insert/update/delete.
```

**Open issue:** Admins need an authorized assignment editor; Product Staff cannot gain unrelated publishing rights. Add restricted write policies or a validated privileged RPC after checking existing role conventions. No existing products should be automatically published into Store.

## Stock foundation (Phase C prerequisite)
Introduce physical stock by SKU and dispatch location with ledger and transactional holds, including payment expiry/cancel/retry idempotency. Date capacity remains a separate constraint. Do not enable ordering from /store until these guarantees are reviewed and tested.

## Phase B remaining work before merge
1. Admin-managed explicit channel/category assignment with role checks.
2. Reuse/extract existing ProductCard presentation safely, with order actions suppressed.
3. Store category localized labels; do not expose category IDs.
4. Published menu key and desktop/mobile navigation integrated with separate approved menu redesign.
5. Local typecheck/build/lint and browser preview (desktop/mobile, EN/TH/ZH).
6. Schema migration and RLS/security validation on isolated environment, then separately approved production rollout.
7. Test Makers/Specials/Bakery regressions and verify /store refresh/deep links.

This branch is **an incomplete Phase B foundation**. A draft PR is appropriate, not a merge/deploy instruction.

## Phase A/B implementation and validation update (2026-10-16)
- Store categories and assignments migration committed; production migration **not applied**.
- Existing Admin ProductEditor can assign a Store category, publish a preview listing and add EN/TH/ZH Store categories. Product Staff does not receive these controls. Database RLS restricts writes to `user_profiles.role = admin`.
- Public Store listings are independent of product origin, reuse ProductCard as non-orderable preview and suppress misleading legacy stock badges. Maker attribution is retained.
- Shared desktop/mobile published menu resolver accepts opt-in `store` key. New menu entry defaults hidden for existing branding so the separate menu redesign remains authoritative; Admin can expose it in the finalized menu.
- Checks on isolated nerd-server working directory `/tmp/joko-store-pr295-check`: `npm run typecheck` passed; `npm run build` passed; `npm run lint` exited 0 (36 existing/repository warnings, no errors). Headless Chromium loaded `/products`, `/makers`, `/specials`, and `/store`; Store title and preview were rendered.
- Migration SQL executed on a disposable Docker Supabase Postgres 17 test instance with minimal cms_products and user_profiles fixtures. A simulated Admin write succeeded and anonymous published catalog read returned one fixture row. This is **not** proof of full production RLS behavior.
- No bakery checkout, Makers ordering, Specials, payment logic, pickup scheduling, or production schema was modified. Basic route smoke tests passed, but full authenticated browser regression tests have not been run.
- Remaining before deployment: production migration review/approval, Admin auth browser testing, three-language/mobile visual QA, negative RLS tests, controlled product CRUD/publish/unpublish tests, and approved menu design coordination.

## Follow-up verification: isolated PR #295 tests (2026-10-16)
- PostgreSQL Docker fixture: Admin inserted category and published assignment; anonymous read returned one row. Authenticated product_staff and customer category inserts were rejected; their assignment updates modified zero rows. Anonymous category insert rejected. Admin unpublished a listing, after which anonymous listing count was zero, then republished it.
- Production read-only check: `user_profiles` has a per-owner read policy, supporting existing admin-by-role predicates; this is **not** a substitute for end-to-end authenticated production authorization tests.
- Playwright + headless Chromium, built branch preview: desktop 1366 px and mobile 390 px loaded `/store`, `/products`, `/makers`, and `/specials` without page JavaScript exceptions. Store EN/TH/ZH copy changed via language buttons on desktop.
- Playwright intercepted mock Store category/assignment/product queries: maker-origin Store product card appeared with maker attribution, with no Add to Cart button or legacy stock-left badge.
- Found and fixed: clearing a Store category in ProductEditor now also unchecks Store publication to respect the database constraint.
- Final checks repeated after `npm ci` restored locked dependencies: TypeScript, Vite production build and ESLint all passed. Temporary playwright dependency installation had initially produced an unrelated Creative Lab TypeScript mismatch, resolved by restoring the project lockfile modules.
- Not proven: authenticated browser Admin editor save/edit/unpublish with real accounts, full Bakery/Makers/Specials checkout/payment/pickup journeys, negative RLS against an actual migrated test project, mobile layout screenshot review for all locales, and future published navigation design. These require isolated authenticated test sessions and/or a Supabase staging schema application.
- Production remains unchanged. No merge, deployment, or production migration.

## Isolated Supabase staging migration (2026-10-16)
- Existing project `JOKO Specials Test` (`szijiljpasxddzgzckra`) inspected before migration; CMS Products, Makers and user profiles exist. The Store tables did not.
- Applied `joko_store_catalog_foundation_v1` to **test only**. Eight RLS policies and both tables verified; no seed categories or assignments.
- Real staging `anon` read exposed a missing `user_profiles` privilege in the initial role-check policy. Fixed by an explicit `public.is_store_admin()` SECURITY DEFINER helper with empty search path, role constrained to `user_profiles.role = admin`. Updated initial migration and added corrective `joko_store_catalog_rls_admin_helper_v1` for environments where the initial migration has already run.
- Applied corrective migration in test; verified anonymous Store category/assignment reads and authenticated Store category read now succeed; unauthenticated `is_store_admin()` returns false. Test table counts stay zero.
- Checked current PR branch `npm run typecheck` and `npm run build`: PASS following the change.
- **Still required before merge:** real authenticated Admin UI CRUD and role boundary checks, paired Store product/publishing checks with test data, and protected checkout regression through Bakery/Makers/Specials. No production migration or release.

## Real staging RLS tests (follow-up)
- On JOKO Specials Test, using transactional role identities, Admin category creation succeeded. Customer and staff attempts at category creation returned SQLSTATE 42501 RLS denial. Admin category creation and product assignment publication succeeded in a rolled-back transaction. Store tables were confirmed empty afterwards.
- An attempted anonymous read in the same transaction retained the Admin JWT subject despite switching the SQL role to anon, making that read inconclusive as an anonymous access assertion. Separate earlier uncredentialed anonymous queries to empty tables succeeded after the RLS helper fix. A full authenticated/anonymous HTTP client test with real sessions is still required.
- Neither production DB nor existing Specials inventory was written to.

## Stages 1–3 continuation (2026-10-16; test only)
- Real staging Admin confirmed category create and product publish/unpublish in Store.
- catalog_scope = bakery | store_only defaults to bakery for existing products; Store-only products have no Bakery category, are omitted by the default getProducts() used by Bakery, Makers and checkout suggestions. Admin and Store explicitly include Store-only rows. Test-project-only migration joko_store_catalog_scope_v1 applied.
- Store fulfillment configuration is isolated in store_fulfillment_settings (stock on hand vs reserved, same-day pickup, pre-order pickup, same-day delivery, future delivery, provider placeholder manual / grab_express). Not connected to payment, pickup capacity or inventory holds. Database enforces ordering_enabled = false. Admin may configure settings but cannot enable ordering.
- Test-project-only migration joko_store_fulfillment_foundation_v1 applied; Admin configuration editor and typed service added. Store preview still suppresses purchasing.
- Checkout/payments review: existing create_online_order_v2 RPC is anchored to a pickup date/location and has no Store physical-stock reservation or delivery address. Current provider registry supports Stripe PromptPay and K SHOP / EasySlip among other legacy modes, but no Store-specific payment intent, delivery fee, courier booking, rollback or mixed-basket flow. Do not route Store purchases to existing Bakery checkout.
- Future required for Store transactions: validate delivery address and service area; obtain reliable GrabExpress fee/eligibility (or manual booking policy); atomic stock reserve/commit/release keyed by idempotent order/payment; server-side amount and fee calculation; payment expiry/cancel/retry/refund handling; explicit mixed-basket constraints; multi-role RLS and end-to-end Stripe/EasySlip tests on staging.
- Do not deploy this PR to production, apply migrations to production or enable Store checkout without a further release gate.
