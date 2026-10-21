-- Staging-only linking of a genuine paid order/payment with held Store stock.
-- Not customer-order creation. Existing EasySlip verification remains authoritative.
create table if not exists public.store_payment_links (
  batch_id uuid primary key references public.store_reservation_batches(id) on delete restrict,
  order_id uuid not null unique references public.orders(id) on delete restrict,
  payment_transaction_id uuid not null unique references public.payment_transactions(id) on delete restrict,
  provider text not null check(provider in ('kshop_master','stripe_promptpay')),
  created_at timestamptz not null default now()
);
alter table public.store_payment_links enable row level security;
revoke all on public.store_payment_links from public,anon,authenticated;

create or replace function public.admin_link_store_payment_v1(p_batch uuid,p_payment uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare b public.store_reservation_batches%rowtype;
        t public.payment_transactions%rowtype;
        o public.orders%rowtype;
        expected numeric(10,2);
begin
 if not public.is_store_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 select * into b from public.store_reservation_batches where id=p_batch for update;
 select * into t from public.payment_transactions where id=p_payment for update;
 if b.id is null or t.id is null then raise exception 'Missing hold or payment'; end if;
 select * into o from public.orders where id=t.order_id;
 if b.state<>'held' or b.expires_at<=clock_timestamp() then raise exception 'Hold inactive'; end if;
 if t.status not in ('pending','verifying') or t.expires_at<=clock_timestamp() then raise exception 'Payment inactive'; end if;
 if o.id is null or o.customer_id<>t.customer_id or o.payment_status='paid' then raise exception 'Invalid order link'; end if;
 if t.payment_mode not in ('kshop_master','stripe_promptpay') then raise exception 'Unsupported rail'; end if;
 if t.currency<>'THB' then raise exception 'Unsupported currency'; end if;
 if exists(select 1 from public.store_fulfillment_groups where batch_id=p_batch and group_kind='bakery') then
   raise exception 'Mixed Bakery reservations not yet linked'; end if;
 if not exists(select 1 from public.store_fulfillment_groups where batch_id=p_batch and group_kind='store' and method in ('pickup_today','pickup_future')) then
   raise exception 'A supported Store pickup fulfillment group is required'; end if;
 select coalesce(sum(quantity*unit_price),0) into expected
 from public.store_reservation_items where batch_id=p_batch;
 if expected<=0 or expected<>t.amount_due or expected<>o.total_amount then
   raise exception 'Store amount mismatch'; end if;
 insert into public.store_payment_links(batch_id,order_id,payment_transaction_id,provider)
 values (p_batch,t.order_id,p_payment,t.payment_mode);
 update public.store_reservation_batches set amount_due=expected where id=p_batch;
 return true;
end $$;
revoke all on function public.admin_link_store_payment_v1(uuid,uuid) from public,anon;
grant execute on function public.admin_link_store_payment_v1(uuid,uuid) to authenticated;

create or replace function public.service_reconcile_store_verified_v1(p_payment uuid)
returns text language plpgsql security definer set search_path='' as $$
declare link_row public.store_payment_links%rowtype;
 b public.store_reservation_batches%rowtype;
 t public.payment_transactions%rowtype;
 o public.orders%rowtype;
 affected int;
begin
 if auth.role() is distinct from 'service_role' and session_user<>'postgres' then
   raise exception 'Service role only' using errcode='42501'; end if;
 select * into link_row from public.store_payment_links where payment_transaction_id=p_payment;
 if not found then return 'not_store'; end if;
 select * into b from public.store_reservation_batches where id=link_row.batch_id for update;
 select * into t from public.payment_transactions where id=p_payment;
 select * into o from public.orders where id=link_row.order_id;
 if b.state='confirmed' then return 'confirmed'; end if;
 if b.state<>'held' then raise exception 'Verified payment has non-held stock: manual reconciliation needed'; end if;
 if t.status<>'verified' or o.payment_status<>'paid' or t.order_id<>o.id or t.customer_id<>o.customer_id
   or t.amount_due<>b.amount_due or t.payment_mode<>link_row.provider then
   raise exception 'No verified matching payment'; end if;
 if exists(select 1 from public.store_fulfillment_groups where batch_id=b.id and group_kind='bakery') then
   raise exception 'Mixed Bakery capacity not committed'; end if;
 update public.store_fulfillment_settings s
   set stock_on_hand=s.stock_on_hand-i.quantity,
       stock_reserved=s.stock_reserved-i.quantity,
       updated_at=now()
 from public.store_reservation_items i
 where i.batch_id=b.id and i.product_id=s.product_id
   and s.stock_on_hand>=i.quantity and s.stock_reserved>=i.quantity;
 get diagnostics affected=row_count;
 if affected<>(select count(*) from public.store_reservation_items where batch_id=b.id) then
   raise exception 'Store stock confirmation mismatch'; end if;
 update public.store_reservation_batches set state='confirmed',payment_state='verified',verified_at=now() where id=b.id;
 return 'confirmed';
end $$;
revoke all on function public.service_reconcile_store_verified_v1(uuid) from public,anon,authenticated;
grant execute on function public.service_reconcile_store_verified_v1(uuid) to service_role;

-- Expiry must never release an already verified payment, even if the Edge
-- finalization and stock confirmation are temporarily disconnected.
create or replace function public.service_expire_store_holds_v1(p_limit integer default 100)
returns integer language plpgsql security definer set search_path='' as $$
declare r record; count_expired integer:=0;
begin
 if auth.role() is distinct from 'service_role' and session_user<>'postgres' then
   raise exception 'Service role required' using errcode='42501'; end if;
 if p_limit<1 or p_limit>500 then raise exception 'Invalid limit'; end if;
 for r in select b.id from public.store_reservation_batches b
 where b.state='held' and b.expires_at<=clock_timestamp()
 order by b.expires_at,b.id for update of b skip locked limit p_limit loop
   -- A verified payment must be reconciled, not expired.
   if exists(
     select 1 from public.store_payment_links l
     join public.payment_transactions t on t.id=l.payment_transaction_id
     join public.orders o on o.id=l.order_id
     where l.batch_id=r.id and t.status='verified' and o.payment_status='paid'
   ) then
     continue;
   end if;
   perform public.store_release_locked_v1(r.id,'expired');
   count_expired:=count_expired+1;
 end loop;
 return count_expired;
end $$;
revoke all on function public.service_expire_store_holds_v1(integer) from public,anon,authenticated;
grant execute on function public.service_expire_store_holds_v1(integer) to service_role;
