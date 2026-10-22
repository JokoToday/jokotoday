-- Store payment finalization must serialize with stock expiry on the same
-- reservation batch. The existing finalizer updates orders and payment
-- transactions in one SQL transaction; rejecting verification rolls back both.
-- Ordinary Bakery and Specials payments are unaffected.
create or replace function public.guard_store_payment_verification_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_batch public.store_reservation_batches%rowtype;
begin
 if new.status='verified' and old.status is distinct from 'verified' then
   select b.* into v_batch
   from public.store_payment_links l
   join public.store_reservation_batches b on b.id=l.batch_id
   where l.payment_transaction_id=new.id
   for update of b;
   if found and (v_batch.state<>'held' or v_batch.expires_at<=clock_timestamp()) then
     raise exception 'Store stock reservation expired or inactive before payment verification'
       using errcode='P0001';
   end if;
 end if;
 return new;
end $$;
revoke all on function public.guard_store_payment_verification_v1() from public, anon, authenticated;
drop trigger if exists guard_store_payment_verification_v1 on public.payment_transactions;
create trigger guard_store_payment_verification_v1
before update of status on public.payment_transactions
for each row execute function public.guard_store_payment_verification_v1();
