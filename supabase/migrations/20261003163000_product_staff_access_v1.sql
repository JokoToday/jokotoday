-- Product Staff Access v1
-- Adds the distinct catalogue-maintenance role and an append-only audit log.
-- Product Staff catalogue reads/writes are mediated by the product-staff-products Edge Function.

alter type public.user_role add value if not exists 'product_staff';

create table if not exists public.product_change_log (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.cms_products(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text not null,
  action text not null check (action in ('update_product')),
  changed_fields text[] not null default '{}',
  old_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists product_change_log_product_created_idx
  on public.product_change_log(product_id, created_at desc);

create index if not exists product_change_log_actor_created_idx
  on public.product_change_log(actor_user_id, created_at desc);

alter table public.product_change_log enable row level security;

revoke insert, update, delete on public.product_change_log from anon, authenticated;
revoke select on public.product_change_log from anon;
grant select on public.product_change_log to authenticated;

drop policy if exists "Admins can read product change log" on public.product_change_log;
create policy "Admins can read product change log"
  on public.product_change_log
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_profiles profile
      where profile.id = (select auth.uid())
        and profile.role::text = 'admin'
    )
  );

comment on table public.product_change_log is
  'Append-only audit trail for server-authorized Product Staff catalogue mutations.';
