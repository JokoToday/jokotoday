-- Store backend phase C1: internal, admin-only reservation sandbox.
-- No customer checkout, payments, or real orders are enabled.
create table if not exists public.store_reservation_batches (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  state text not null default 'held' check (state in ('held','released','expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  note text
);
create table if not exists public.store_reservation_items (
  batch_id uuid not null references public.store_reservation_batches(id) on delete restrict,
  product_id uuid not null references public.cms_products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  primary key (batch_id,product_id)
);
create index if not exists store_reservation_due_idx on public.store_reservation_batches (expires_at) where state='held';
alter table public.store_reservation_batches enable row level security;
alter table public.store_reservation_items enable row level security;
revoke all on public.store_reservation_batches,public.store_reservation_items from anon,authenticated;
-- Only an explicitly authorized internal RPC can modify reservations.
create or replace function public.admin_hold_store_stock_v1(p_request_key uuid,p_lines jsonb,p_minutes integer default 15)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_id uuid; v_line record; v_n int; v_total int;
begin
  if not public.is_store_admin() then raise exception 'Admin authorization required' using errcode='42501'; end if;
  if p_request_key is null or p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 or jsonb_array_length(p_lines)>40 then raise exception 'Invalid reservation lines'; end if;
  if p_minutes < 1 or p_minutes > 60 then raise exception 'Invalid reservation duration'; end if;
  -- Serialize concurrent retries by request key, including before the batch exists.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_key::text,0));
  select id into v_id from public.store_reservation_batches where request_key=p_request_key;
  if found then return v_id; end if;
  -- Validate duplicates and quantities before making changes.
  if exists (select 1 from jsonb_array_elements(p_lines) l where
    jsonb_typeof(l->'product_id') <> 'string' or
    jsonb_typeof(l->'quantity') <> 'number' or
    (l->>'quantity') !~ '^[1-9][0-9]*$' or
    (l->>'quantity')::numeric > 10000) then raise exception 'Invalid item quantity'; end if;
  if exists (select 1 from (select l->>'product_id' id,count(*) n from jsonb_array_elements(p_lines) l group by 1) q where q.n>1) then raise exception 'Duplicate product'; end if;
  insert into public.store_reservation_batches(request_key,expires_at)
    values(p_request_key, pg_catalog.clock_timestamp()+pg_catalog.make_interval(mins=>p_minutes)) returning id into v_id;
  -- Deterministic row order prevents deadlocks across multi-item requests.
  for v_line in select (l->>'product_id')::uuid product_id,(l->>'quantity')::integer quantity
    from jsonb_array_elements(p_lines) l order by (l->>'product_id')::uuid
  loop
    update public.store_fulfillment_settings s
      set stock_reserved=s.stock_reserved+v_line.quantity,updated_at=now()
      from public.cms_products p,public.store_product_assignments a
      where s.product_id=v_line.product_id and p.id=s.product_id and a.product_id=s.product_id
        and p.is_active=true and p.is_sold_out is not true and a.is_published=true
        and s.stock_on_hand-s.stock_reserved>=v_line.quantity;
    if not found then raise exception 'Unavailable Store stock for product %',v_line.product_id; end if;
    insert into public.store_reservation_items(batch_id,product_id,quantity,unit_price)
      select v_id,v_line.product_id,v_line.quantity,p.price from public.cms_products p where p.id=v_line.product_id;
  end loop;
  return v_id;
end $$;
revoke all on function public.admin_hold_store_stock_v1(uuid,jsonb,integer) from public,anon;
grant execute on function public.admin_hold_store_stock_v1(uuid,jsonb,integer) to authenticated;
create or replace function public.admin_release_store_hold_v1(p_batch_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_batch public.store_reservation_batches%rowtype; v_line record;
begin
  if not public.is_store_admin() then raise exception 'Admin authorization required' using errcode='42501'; end if;
  select * into v_batch from public.store_reservation_batches where id=p_batch_id for update;
  if not found then raise exception 'Reservation not found'; end if;
  if v_batch.state <> 'held' then return false; end if;
  for v_line in select product_id,quantity from public.store_reservation_items where batch_id=p_batch_id order by product_id loop
    update public.store_fulfillment_settings set stock_reserved=stock_reserved-v_line.quantity,updated_at=now()
    where product_id=v_line.product_id and stock_reserved>=v_line.quantity;
    if not found then raise exception 'Reservation balance mismatch'; end if;
  end loop;
  update public.store_reservation_batches set state=case when expires_at<=now() then 'expired' else 'released' end,released_at=now() where id=p_batch_id;
  return true;
end $$;
revoke all on function public.admin_release_store_hold_v1(uuid) from public,anon;
grant execute on function public.admin_release_store_hold_v1(uuid) to authenticated;