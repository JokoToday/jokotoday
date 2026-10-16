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
