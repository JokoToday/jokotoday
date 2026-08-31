/*
  Harden Pickup v2 customer cancellation before customer EXECUTE is enabled.

  The existing wrapper refunded an unused reserved monetary loyalty reward before
  delegating to cancel_online_order_v2_inventory_v1(), which performs the strong
  authentication / own-order check. Any later exception would roll the statement
  back atomically, but customer-facing authorization should be explicit before
  any loyalty mutation is attempted.

  This forward fix:
  - verifies auth.uid() and order ownership at the outer boundary;
  - runs the inventory/order cancellation (which re-validates ownership and all
    cancellation invariants) before refunding a reserved monetary reward;
  - preserves atomic rollback if the reward refund subsequently fails;
  - explicitly keeps browser EXECUTE grants dark in this migration.
*/

create or replace function public.cancel_online_order_v2(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid := auth.uid();
  v_customer_id uuid;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_order_id is null then
    raise exception 'Order id is required';
  end if;

  select o.customer_id
  into v_customer_id
  from public.orders o
  where o.id = p_order_id;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_customer_id is distinct from v_user_id then
    raise exception 'You may only cancel your own order' using errcode = '42501';
  end if;

  -- This helper performs the authoritative cancellation checks, row locks,
  -- inventory release, inventory-event append, earn reversal and order status
  -- transition. It repeats the ownership check as defense in depth.
  v_result := public.cancel_online_order_v2_inventory_v1(p_order_id);

  -- Refund an unused reserved monetary reward only after the authoritative
  -- cancellation path has accepted the request. The whole RPC remains one
  -- transaction, so any failure here rolls the cancellation back as well.
  perform public.refund_reserved_order_loyalty_reward_v2(
    p_order_id,
    v_user_id,
    'Customer cancelled Pickup v2 order before payment'
  );

  select to_jsonb(o)
  into v_result
  from public.orders o
  where o.id = p_order_id;

  return v_result;
end;
$$;

comment on function public.cancel_online_order_v2(uuid) is
  'Pickup v2 customer cancellation wrapper. Hardened 20260831: validates authenticated order ownership before authoritative cancellation and reserved-loyalty refund.';

-- Customer Pickup v2 remains dark until the separately reviewed cutover grant.
revoke execute on function public.cancel_online_order_v2(uuid) from public;
revoke execute on function public.cancel_online_order_v2(uuid) from anon;
revoke execute on function public.cancel_online_order_v2(uuid) from authenticated;
