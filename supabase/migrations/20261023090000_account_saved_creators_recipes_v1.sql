-- Separate cross-content favorites from existing product_likes, preserving existing product counts.
create table if not exists public.account_saved_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('creator','recipe')),
  item_id text not null check (length(item_id) between 1 and 180),
  created_at timestamptz not null default now(),
  primary key (user_id,item_type,item_id)
);
create index if not exists account_saved_items_type_lookup on public.account_saved_items (item_type,item_id);
alter table public.account_saved_items enable row level security;
drop policy if exists account_saved_items_own_select on public.account_saved_items;
create policy account_saved_items_own_select on public.account_saved_items for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists account_saved_items_own_insert on public.account_saved_items;
create policy account_saved_items_own_insert on public.account_saved_items for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists account_saved_items_own_delete on public.account_saved_items;
create policy account_saved_items_own_delete on public.account_saved_items for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.account_saved_items from anon;
grant select,insert,delete on public.account_saved_items to authenticated;
