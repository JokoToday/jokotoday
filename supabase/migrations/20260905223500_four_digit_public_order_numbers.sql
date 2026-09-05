/*
  Four-digit public online order numbers.

  Follow-up to 20260905143000_short_public_order_references.sql.

  The first short-reference rollout intentionally started at JT-10001. After
  production verification, the customer-facing format is being tightened to a
  four-digit sequence:

    JT-1001
    JT-1002
    ...
    JT-9999

  The already-created JT-10001 test order remains unchanged. It sits outside
  the new four-digit range and therefore cannot collide with future values.

  Safety
  ------
  - Existing orders are never rewritten.
  - Browser idempotency references are unchanged.
  - Checkout RPC signatures and logic are unchanged.
  - The sequence remains server-only.
  - MAXVALUE 9999 deliberately prevents silent drift back to five digits.
*/

do $$
declare
  v_legacy_def text;
  v_v2_def text;
begin
  if to_regclass('public.online_order_number_seq') is null then
    raise exception 'online_order_number_seq is missing; refusing four-digit cutover';
  end if;

  if exists (
    select 1
    from public.orders
    where order_number ~ '^JT-[0-9]{4}$'
  ) then
    raise exception 'Four-digit JT order numbers already exist; refusing sequence restart';
  end if;

  select pg_get_functiondef(
    'public.create_online_order(text,text,jsonb,text)'::regprocedure
  ) into v_legacy_def;

  select pg_get_functiondef(
    'public.create_online_order_v2(text,uuid,uuid,jsonb,text)'::regprocedure
  ) into v_v2_def;

  if coalesce(v_legacy_def, '') not like '%online_order_number_seq%'
     or coalesce(v_v2_def, '') not like '%online_order_number_seq%' then
    raise exception 'Checkout RPC sequence wiring changed; refusing four-digit cutover';
  end if;
end;
$$;

alter sequence public.online_order_number_seq
  minvalue 1001
  maxvalue 9999
  start with 1001
  restart with 1001;

comment on sequence public.online_order_number_seq is
  'Server-only sequence for four-digit customer-facing online order numbers JT-1001 through JT-9999.';
