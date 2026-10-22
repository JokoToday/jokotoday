-- Explicit separation prevents Store-only items entering legacy Bakery pickup flows.
alter table public.cms_products
  add column if not exists catalog_scope text not null default 'bakery';
alter table public.cms_products
  drop constraint if exists cms_products_catalog_scope_check;
alter table public.cms_products
  add constraint cms_products_catalog_scope_check
  check (catalog_scope in ('bakery', 'store_only'));
alter table public.cms_products alter column category_id drop not null;
alter table public.cms_products
  drop constraint if exists cms_products_bakery_category_required;
alter table public.cms_products
  add constraint cms_products_bakery_category_required
  check (catalog_scope = 'store_only' or category_id is not null);
create index if not exists cms_products_catalog_scope_idx
  on public.cms_products (catalog_scope) where is_active = true;
