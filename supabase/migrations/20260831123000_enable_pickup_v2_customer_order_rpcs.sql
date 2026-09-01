/*
  Final Pickup v2 customer order RPC grant migration.

  This migration is deliberately fail-closed. It must not grant customer order
  execution unless the customer availability API exists and the hardened
  cancellation wrapper has already been applied.

  Applying this migration is a production cutover gate and requires explicit
  approval. It does not enable the frontend rollout setting by itself.
*/

do $$
declare
  v_cancel_comment text;
begin
  if to_regprocedure('public.get_customer_pickup_availability_v2(uuid[])') is null then
    raise exception 'Pickup v2 customer availability API is missing; refusing to enable customer order RPCs';
  end if;

  if to_regprocedure('public.create_online_order_v2(text,uuid,uuid,jsonb,text)') is null then
    raise exception 'Pickup v2 create order RPC is missing';
  end if;

  if to_regprocedure('public.cancel_online_order_v2(uuid)') is null then
    raise exception 'Pickup v2 cancel order RPC is missing';
  end if;

  select obj_description(
    to_regprocedure('public.cancel_online_order_v2(uuid)')::oid,
    'pg_proc'
  ) into v_cancel_comment;

  if coalesce(v_cancel_comment, '') not like '%Hardened 20260831:%' then
    raise exception 'Hardened Pickup v2 cancellation wrapper is missing; refusing customer grant';
  end if;
end;
$$;

-- Keep internal SECURITY DEFINER helpers unreachable from browser roles.
revoke execute on function public.cancel_online_order_v2_inventory_v1(uuid) from public;
revoke execute on function public.cancel_online_order_v2_inventory_v1(uuid) from anon;
revoke execute on function public.cancel_online_order_v2_inventory_v1(uuid) from authenticated;

revoke execute on function public.refund_reserved_order_loyalty_reward_v2(uuid,uuid,text) from public;
revoke execute on function public.refund_reserved_order_loyalty_reward_v2(uuid,uuid,text) from anon;
revoke execute on function public.refund_reserved_order_loyalty_reward_v2(uuid,uuid,text) from authenticated;

revoke execute on function public.apply_loyalty_points_delta_v2(uuid,integer,text,uuid,uuid,uuid,text,jsonb) from public;
revoke execute on function public.apply_loyalty_points_delta_v2(uuid,integer,text,uuid,uuid,uuid,text,jsonb) from anon;
revoke execute on function public.apply_loyalty_points_delta_v2(uuid,integer,text,uuid,uuid,uuid,text,jsonb) from authenticated;

-- Only authenticated customers may create or cancel Pickup v2 online orders.
-- Anonymous users and PUBLIC remain denied.
revoke execute on function public.create_online_order_v2(text,uuid,uuid,jsonb,text) from public;
revoke execute on function public.create_online_order_v2(text,uuid,uuid,jsonb,text) from anon;
grant execute on function public.create_online_order_v2(text,uuid,uuid,jsonb,text) to authenticated;

revoke execute on function public.cancel_online_order_v2(uuid) from public;
revoke execute on function public.cancel_online_order_v2(uuid) from anon;
grant execute on function public.cancel_online_order_v2(uuid) to authenticated;
