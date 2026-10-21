-- Store-specific priority; does not alter Bakery / Specials payment settings.
-- No payment processing or customer checkout is enabled by this migration.
create table if not exists public.store_payment_policy (
  policy_key text primary key check (policy_key='default'),
  primary_provider text not null default 'kshop_master'
    check (primary_provider='kshop_master'),
  fallback_provider text not null default 'stripe_promptpay'
    check (fallback_provider='stripe_promptpay'),
  fallback_enabled boolean not null default false,
  checkout_enabled boolean not null default false check (checkout_enabled=false),
  updated_at timestamptz not null default now()
);
insert into public.store_payment_policy(policy_key,primary_provider,fallback_provider,fallback_enabled,checkout_enabled)
values ('default','kshop_master','stripe_promptpay',false,false)
on conflict(policy_key) do nothing;
alter table public.store_payment_policy enable row level security;
revoke all on public.store_payment_policy from anon,authenticated;
grant select on public.store_payment_policy to anon,authenticated;
create policy store_payment_policy_read on public.store_payment_policy
 for select to anon,authenticated using (true);
comment on table public.store_payment_policy is
 'Store-only EasySlip/K SHOP first, Stripe PromptPay optional fallback. Checkout disabled pending signed provider verification and server-side order linkage.';
