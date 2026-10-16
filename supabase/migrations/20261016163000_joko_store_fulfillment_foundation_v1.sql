-- Staging-first JOKO Store fulfillment capability and physically available stock.
-- Deliberately no customer order/write policy. Ordering cannot be enabled through UI yet.
create table if not exists public.store_fulfillment_settings (
  product_id uuid primary key references public.cms_products(id) on delete cascade,
  stock_on_hand integer not null default 0 check (stock_on_hand >= 0),
  stock_reserved integer not null default 0 check (stock_reserved >= 0),
  pickup_today boolean not null default false,
  pickup_preorder boolean not null default false,
  delivery_today boolean not null default false,
  delivery_preorder boolean not null default false,
  delivery_provider text not null default 'manual'
    check (delivery_provider in ('manual', 'grab_express')),
  delivery_fee_thb numeric(10,2) check (delivery_fee_thb >= 0),
  ordering_enabled boolean not null default false
    check (ordering_enabled = false),
  updated_at timestamptz not null default now(),
  constraint store_stock_reserved_not_over_on_hand check (stock_reserved <= stock_on_hand),
  constraint store_delivery_needs_provider check (
    (not delivery_today and not delivery_preorder) or delivery_provider in ('manual','grab_express')
  )
);
comment on table public.store_fulfillment_settings is
  'Store stock and fulfillment configuration only; ordering_enabled is locked false until atomic reservations and payment hooks ship.';
create index if not exists store_fulfillment_available_idx
  on public.store_fulfillment_settings (product_id) where stock_on_hand > stock_reserved;
alter table public.store_fulfillment_settings enable row level security;
revoke all on public.store_fulfillment_settings from anon, authenticated;
grant select on public.store_fulfillment_settings to anon, authenticated;
grant insert, update, delete on public.store_fulfillment_settings to authenticated;
create policy store_fulfillment_read on public.store_fulfillment_settings
  for select to anon, authenticated using (
    exists (
      select 1 from public.store_product_assignments a
      join public.cms_products p on p.id = a.product_id
      where a.product_id = product_id
        and a.is_published and p.is_active
    ) or (select public.is_store_admin())
  );
create policy store_fulfillment_admin_insert on public.store_fulfillment_settings
  for insert to authenticated with check ((select public.is_store_admin()));
create policy store_fulfillment_admin_update on public.store_fulfillment_settings
  for update to authenticated using ((select public.is_store_admin()))
  with check ((select public.is_store_admin()));
create policy store_fulfillment_admin_delete on public.store_fulfillment_settings
  for delete to authenticated using ((select public.is_store_admin()));
