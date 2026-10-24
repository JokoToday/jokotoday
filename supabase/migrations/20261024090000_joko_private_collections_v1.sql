-- Private collections only. Sharing/public visibility is intentionally absent.
create table if not exists public.joko_collections (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 100),
 description text not null default '' check(length(description) <= 500),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists joko_collections_owner_idx on public.joko_collections(owner_user_id,created_at desc);
create table if not exists public.joko_collection_items (
 id uuid primary key default gen_random_uuid(),
 collection_id uuid not null references public.joko_collections(id) on delete cascade,
 item_type text not null check(item_type in ('product','creator','recipe')),
 item_id text not null check(length(item_id) between 1 and 180),
 position integer not null default 0 check(position >= 0),
 added_at timestamptz not null default now(),
 unique(collection_id,item_type,item_id)
);
create index if not exists joko_collection_items_order_idx on public.joko_collection_items(collection_id,position,added_at);
alter table public.joko_collections enable row level security;
alter table public.joko_collection_items enable row level security;
create policy collections_owner_read on public.joko_collections for select to authenticated using(owner_user_id=(select auth.uid()));
create policy collections_owner_insert on public.joko_collections for insert to authenticated with check(owner_user_id=(select auth.uid()));
create policy collections_owner_update on public.joko_collections for update to authenticated using(owner_user_id=(select auth.uid())) with check(owner_user_id=(select auth.uid()));
create policy collections_owner_delete on public.joko_collections for delete to authenticated using(owner_user_id=(select auth.uid()));
create policy collection_items_owner_read on public.joko_collection_items for select to authenticated using(exists(select 1 from public.joko_collections c where c.id=collection_id and c.owner_user_id=(select auth.uid())));
create policy collection_items_owner_insert on public.joko_collection_items for insert to authenticated with check(exists(select 1 from public.joko_collections c where c.id=collection_id and c.owner_user_id=(select auth.uid())));
create policy collection_items_owner_update on public.joko_collection_items for update to authenticated using(exists(select 1 from public.joko_collections c where c.id=collection_id and c.owner_user_id=(select auth.uid()))) with check(exists(select 1 from public.joko_collections c where c.id=collection_id and c.owner_user_id=(select auth.uid())));
create policy collection_items_owner_delete on public.joko_collection_items for delete to authenticated using(exists(select 1 from public.joko_collections c where c.id=collection_id and c.owner_user_id=(select auth.uid())));
revoke all on public.joko_collections, public.joko_collection_items from anon;
grant select,insert,update,delete on public.joko_collections, public.joko_collection_items to authenticated;
