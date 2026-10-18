-- Staging/internal only. Does not enable customer checkout, Stripe, EasySlip, or deliveries.
alter table public.store_reservation_batches drop constraint if exists store_reservation_batches_state_check;
alter table public.store_reservation_batches add constraint store_reservation_batches_state_check
  check(state in ('held','confirmed','released','expired'));
alter table public.store_reservation_batches
  add column if not exists payment_state text not null default 'pending'
    check(payment_state in ('pending','verified','failed','cancelled','expired')),
  add column if not exists verified_at timestamptz,
  add column if not exists amount_due numeric(10,2),
  add column if not exists currency text not null default 'THB'
    check(currency='THB');
create table if not exists public.store_fulfillment_groups (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.store_reservation_batches(id) on delete restrict,
  group_kind text not null check(group_kind in ('store','bakery')),
  method text not null check(method in ('pickup_today','pickup_future','delivery_today','delivery_future')),
  pickup_date_id uuid references public.pickup_dates(id),
  pickup_location_id uuid references public.cms_pickup_locations(id),
  delivery_quote_state text not null default 'not_applicable'
    check(delivery_quote_state in ('not_applicable','pending','quoted')),
  delivery_fee numeric(10,2) not null default 0 check(delivery_fee>=0),
  created_at timestamptz not null default now(),
  constraint pickup_has_date_for_future check (
    method not in ('pickup_future','delivery_future') or pickup_date_id is not null
  ),
  constraint unquoted_delivery_no_fee check (
    method not in ('delivery_today','delivery_future') or delivery_quote_state='quoted' or delivery_fee=0
  )
);
create unique index if not exists store_fulfillment_one_group_kind_idx
  on public.store_fulfillment_groups(batch_id,group_kind);
alter table public.store_fulfillment_groups enable row level security;
revoke all on public.store_fulfillment_groups from anon,authenticated;
create or replace function public.admin_attach_store_fulfillment_v1(
  p_batch_id uuid,p_kind text,p_method text,p_date_id uuid default null,p_location_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_state text;
begin
 if not public.is_store_admin() then raise exception 'Admin authorization required' using errcode='42501'; end if;
 select state into v_state from public.store_reservation_batches where id=p_batch_id for update;
 if v_state is distinct from 'held' then raise exception 'Only active holds can receive fulfillment'; end if;
 if p_kind not in ('store','bakery') or p_method not in ('pickup_today','pickup_future','delivery_today','delivery_future') then raise exception 'Invalid fulfillment'; end if;
 -- Bakery fulfillment must be future pickup; later checkout verifies schedule and item capacities.
 if p_kind='bakery' and p_method <> 'pickup_future' then raise exception 'Bakery requires pre-order pickup'; end if;
 if p_method in ('pickup_future','delivery_future') and p_date_id is null then raise exception 'Future date required'; end if;
 if p_method in ('delivery_today','delivery_future') then raise exception 'Delivery requires a verified courier quote; not supported yet'; end if;
 insert into public.store_fulfillment_groups(batch_id,group_kind,method,pickup_date_id,pickup_location_id)
 values(p_batch_id,p_kind,p_method,p_date_id,p_location_id)
 on conflict (batch_id,group_kind) do update set method=excluded.method,pickup_date_id=excluded.pickup_date_id,pickup_location_id=excluded.pickup_location_id
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.admin_attach_store_fulfillment_v1(uuid,text,text,uuid,uuid) from public,anon;
grant execute on function public.admin_attach_store_fulfillment_v1(uuid,text,text,uuid,uuid) to authenticated;

-- Common release primitive, called while holding a row lock on batch.
create or replace function public.store_release_locked_v1(p_id uuid,p_new_state text)
returns void language plpgsql security definer set search_path='' as $$
declare v_line record;
begin
 if current_user not in ('postgres','service_role') then
   raise exception 'Internal function only' using errcode='42501';
 end if;
 for v_line in select product_id,quantity from public.store_reservation_items where batch_id=p_id order by product_id loop
  update public.store_fulfillment_settings
    set stock_reserved=stock_reserved-v_line.quantity,updated_at=now()
    where product_id=v_line.product_id and stock_reserved>=v_line.quantity;
  if not found then raise exception 'Reservation balance mismatch'; end if;
 end loop;
 update public.store_reservation_batches set state=p_new_state,released_at=now(),
   payment_state=case when p_new_state='expired' then 'expired' else 'cancelled' end
   where id=p_id;
end $$;
revoke all on function public.store_release_locked_v1(uuid,text) from public,anon,authenticated;

create or replace function public.admin_store_payment_transition_v1(p_id uuid,p_event text)
returns text language plpgsql security definer set search_path='' as $$
declare v_batch public.store_reservation_batches%rowtype; v_n int;
begin
 if not public.is_store_admin() then raise exception 'Admin authorization required' using errcode='42501'; end if;
 if p_event not in ('verified','failed','cancelled') then raise exception 'Invalid transition'; end if;
 select * into v_batch from public.store_reservation_batches where id=p_id for update;
 if not found then raise exception 'Batch missing'; end if;
 if v_batch.state='confirmed' then
   if p_event='verified' then return 'confirmed'; end if;
   raise exception 'Confirmed reservations require a separate refund/return operation';
 end if;
 if v_batch.state<>'held' then return v_batch.state; end if;
 if p_event='verified' then
   if v_batch.expires_at<=clock_timestamp() then raise exception 'Expired hold cannot be confirmed'; end if;
   if not exists(select 1 from public.store_fulfillment_groups where batch_id=p_id and group_kind='store') then
      raise exception 'Store fulfillment group required'; end if;
   -- Refuse mixed orders until Bakery stock has a separately committed reservation.
   select count(*) into v_n from public.store_fulfillment_groups where batch_id=p_id and group_kind='bakery';
   if v_n>0 then raise exception 'Mixed bakery reservations are not yet transactional'; end if;
   update public.store_reservation_batches set state='confirmed',payment_state='verified',verified_at=now() where id=p_id;
   -- Physical stock becomes sold on confirmation, releasing the reservation balance.
   update public.store_fulfillment_settings s set stock_on_hand=s.stock_on_hand-i.quantity,
      stock_reserved=s.stock_reserved-i.quantity,updated_at=now()
      from public.store_reservation_items i where i.batch_id=p_id and i.product_id=s.product_id
      and s.stock_reserved>=i.quantity and s.stock_on_hand>=i.quantity;
   get diagnostics v_n=row_count;
   if v_n<>(select count(*) from public.store_reservation_items where batch_id=p_id) then
     raise exception 'Physical stock confirmation mismatch'; end if;
 else
   perform public.store_release_locked_v1(p_id,'released');
   update public.store_reservation_batches set payment_state=p_event where id=p_id;
 end if;
 return (select state from public.store_reservation_batches where id=p_id);
end $$;
revoke all on function public.admin_store_payment_transition_v1(uuid,text) from public,anon;
grant execute on function public.admin_store_payment_transition_v1(uuid,text) to authenticated;

-- Service-role maintenance entrypoint. Do NOT expose to customer authenticated role.
create or replace function public.service_expire_store_holds_v1(p_limit integer default 100)
returns integer language plpgsql security definer set search_path='' as $$
declare v_row record; v_count int := 0;
begin
 if auth.role() is distinct from 'service_role' and session_user <> 'postgres' then
    raise exception 'Service role required' using errcode='42501'; end if;
 if p_limit<1 or p_limit>500 then raise exception 'Invalid limit'; end if;
 for v_row in select id from public.store_reservation_batches
   where state='held' and expires_at<=clock_timestamp()
   order by expires_at,id for update skip locked limit p_limit loop
   perform public.store_release_locked_v1(v_row.id,'expired');
   v_count:=v_count+1;
 end loop;
 return v_count;
end $$;
revoke all on function public.service_expire_store_holds_v1(integer) from public,anon,authenticated;
grant execute on function public.service_expire_store_holds_v1(integer) to service_role;
