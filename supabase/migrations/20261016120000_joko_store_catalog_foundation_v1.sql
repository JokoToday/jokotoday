-- JOKO Store Phase B: explicitly curated, non-orderable listings.
-- No legacy origin backfill and no physical-stock claims.
create table if not exists public.store_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  name_en text not null,
  name_th text not null,
  name_zh text,
  sort_order integer not null default 0,
  is_active boolean not null default true
);
create table if not exists public.store_product_assignments (
  product_id uuid primary key references public.cms_products(id) on delete cascade,
  store_category_id uuid references public.store_categories(id) on delete set null,
  is_published boolean not null default false,
  constraint published_store_products_have_category check (not is_published or store_category_id is not null),
  assigned_at timestamptz not null default now()
);
create index if not exists store_product_category_idx on public.store_product_assignments (store_category_id);
alter table public.store_categories enable row level security;
alter table public.store_product_assignments enable row level security;
revoke all on public.store_categories, public.store_product_assignments from anon, authenticated;
grant select on public.store_categories, public.store_product_assignments to anon, authenticated;
grant insert, update, delete on public.store_categories, public.store_product_assignments to authenticated;
create policy store_categories_public_read on public.store_categories for select to anon, authenticated using (is_active or exists (select 1 from public.user_profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy store_categories_admin_insert on public.store_categories for insert to authenticated with check (exists (select 1 from public.user_profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy store_categories_admin_update on public.store_categories for update to authenticated using (exists (select 1 from public.user_profiles p where p.id = (select auth.uid()) and p.role = 'admin')) with check (exists (select 1 from public.user_profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy store_categories_admin_delete on public.store_categories for delete to authenticated using (exists (select 1 from public.user_profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy store_assignments_public_read on public.store_product_assignments for select to anon, authenticated using (is_published or exists (select 1 from public.user_profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy store_assignments_admin_insert on public.store_product_assignments for insert to authenticated with check (exists (select 1 from public.user_profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy store_assignments_admin_update on public.store_product_assignments for update to authenticated using (exists (select 1 from public.user_profiles p where p.id = (select auth.uid()) and p.role = 'admin')) with check (exists (select 1 from public.user_profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy store_assignments_admin_delete on public.store_product_assignments for delete to authenticated using (exists (select 1 from public.user_profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
-- Categories are intentionally empty; Admin curates them.
