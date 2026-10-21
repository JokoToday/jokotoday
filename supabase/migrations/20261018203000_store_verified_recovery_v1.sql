-- Retry reconciliation for verified Store payments if the Edge function times out.
-- Use cron on staging separately; do not install a production schedule by migration.
create or replace function public.service_reconcile_pending_store_payments_v1(p_limit integer default 50)
returns integer language plpgsql security definer set search_path='' as $$
declare r record; n integer:=0;
begin
 if auth.role() is distinct from 'service_role' and session_user<>'postgres' then
   raise exception 'Service role required' using errcode='42501'; end if;
 if p_limit<1 or p_limit>200 then raise exception 'Invalid limit'; end if;
 for r in
   select l.payment_transaction_id from public.store_payment_links l
   join public.store_reservation_batches b on b.id=l.batch_id
   join public.payment_transactions t on t.id=l.payment_transaction_id
   join public.orders o on o.id=l.order_id
   where b.state='held' and t.status='verified' and o.payment_status='paid'
   order by b.created_at
   limit p_limit
 loop
   perform public.service_reconcile_store_verified_v1(r.payment_transaction_id);
   n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function public.service_reconcile_pending_store_payments_v1(integer) from public,anon,authenticated;
grant execute on function public.service_reconcile_pending_store_payments_v1(integer) to service_role;
