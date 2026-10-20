-- Keep Store's explicitly authorized payment mode isolated from the global
-- Bakery payment_settings trigger. A mode snapshot is established only by
-- trusted service/admin workflow BEFORE payment_transactions insertion.
create table if not exists public.store_order_payment_modes (
  order_id uuid primary key references public.orders(id) on delete restrict,
  payment_mode text not null check(payment_mode in ('kshop_master','stripe_promptpay')),
  created_at timestamptz not null default now()
);
alter table public.store_order_payment_modes enable row level security;
revoke all on public.store_order_payment_modes from public, anon, authenticated;
grant select, insert on public.store_order_payment_modes to service_role;

create or replace function public.set_payment_transaction_mode_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_mode text;
begin
  -- Specials retains its existing separate override in zz_specials_payment_mode.
  -- Only server-created Store snapshots bypass the Bakery global setting.
  select payment_mode into v_mode
  from public.store_order_payment_modes
  where order_id=new.order_id;
  if v_mode is null then
    select payment_qr_mode into v_mode from public.payment_settings where id=true;
  end if;
  v_mode:=coalesce(v_mode,'kshop_master');
  new.payment_mode:=v_mode;
  new.provider:=case when v_mode='stripe_promptpay' then 'stripe' else 'easyslip' end;
  new.rail:='promptpay';
  return new;
end $$;
revoke all on function public.set_payment_transaction_mode_v1() from public, anon, authenticated;
