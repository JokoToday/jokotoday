/*
  Durable customer cancellation notifications.

  Extends the existing order_notification_events outbox with one new type and
  creates that event transactionally only after a customer cancellation has
  completed successfully. Existing cancellation ownership, cutoff, inventory
  and loyalty behavior is preserved.
*/

begin;

alter table public.order_notification_events
  drop constraint if exists order_notification_events_notification_type_check;

alter table public.order_notification_events
  add constraint order_notification_events_notification_type_check
  check (notification_type = any (array[
    'customer_confirmation'::text,
    'admin_new_order'::text,
    'customer_cancellation'::text
  ]));

create or replace function public.claim_order_notification(
  p_order_id uuid,
  p_notification_type text
) returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_event public.order_notification_events%rowtype;
begin
  if p_order_id is null
     or p_notification_type not in (
       'customer_confirmation',
       'admin_new_order',
       'customer_cancellation'
     ) then
    return jsonb_build_object('outcome', 'invalid');
  end if;

  if not exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and coalesce(o.purchase_type, 'online') = 'online'
      and (
        p_notification_type <> 'customer_cancellation'
        or o.status = 'cancelled'
      )
  ) then
    return jsonb_build_object('outcome', 'unavailable');
  end if;

  select * into v_event
  from public.order_notification_events
  where order_id = p_order_id
    and notification_type = p_notification_type
  for update;

  if not found then
    return jsonb_build_object('outcome', 'unavailable');
  end if;

  if v_event.status = 'sent' then
    return jsonb_build_object(
      'outcome', 'already_sent',
      'event_id', v_event.id,
      'attempt_count', v_event.attempt_count,
      'language', v_event.language
    );
  end if;

  if v_event.status = 'uncertain' then
    return jsonb_build_object(
      'outcome', 'uncertain',
      'event_id', v_event.id,
      'attempt_count', v_event.attempt_count,
      'language', v_event.language
    );
  end if;

  if v_event.status = 'processing'
     and v_event.claimed_at is not null
     and v_event.claimed_at > now() - interval '5 minutes' then
    return jsonb_build_object(
      'outcome', 'processing',
      'event_id', v_event.id,
      'attempt_count', v_event.attempt_count,
      'language', v_event.language
    );
  end if;

  if v_event.status = 'processing'
     and v_event.first_attempt_at is not null
     and v_event.first_attempt_at <= now() - interval '23 hours' then
    update public.order_notification_events
    set status = 'uncertain',
        updated_at = now(),
        last_error = coalesce(
          last_error,
          'Processing outcome exceeded provider idempotency window'
        )
    where id = v_event.id
    returning * into v_event;

    return jsonb_build_object(
      'outcome', 'uncertain',
      'event_id', v_event.id,
      'attempt_count', v_event.attempt_count,
      'language', v_event.language
    );
  end if;

  update public.order_notification_events
  set status = 'processing',
      first_attempt_at = coalesce(first_attempt_at, now()),
      claimed_at = now(),
      attempt_count = attempt_count + 1,
      updated_at = now(),
      last_error = null
  where id = v_event.id
  returning * into v_event;

  return jsonb_build_object(
    'outcome', 'claimed',
    'event_id', v_event.id,
    'attempt_count', v_event.attempt_count,
    'language', v_event.language
  );
end;
$$;

create or replace function public.cancel_online_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid := auth.uid();
  v_customer_id uuid;
  v_pickup_date_id uuid;
  v_result jsonb;
  v_language text := 'en';
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_order_id is not null then
    select o.customer_id, o.pickup_date_id
    into v_customer_id, v_pickup_date_id
    from public.orders o
    where o.id = p_order_id;

    if found then
      if v_customer_id is distinct from v_user_id then
        raise exception 'You may only cancel your own order' using errcode = '42501';
      end if;
      if v_pickup_date_id is not null then
        raise exception 'This order uses the v2 pickup inventory system; refresh the application before cancelling'
          using errcode = 'P0001';
      end if;
      if v_customer_id is not null then
        perform 1 from public.customers c where c.id = v_customer_id for update;
        if not found then raise exception 'Customer record not found'; end if;
      end if;
      perform public.refund_reserved_order_loyalty_reward_v2(
        p_order_id,
        v_user_id,
        'Customer cancelled before pickup payment'
      );
    end if;
  end if;

  v_result := public.cancel_online_order_legacy_v1(p_order_id);

  select to_jsonb(o)
  into v_result
  from public.orders o
  where o.id = p_order_id;

  if coalesce(v_result ->> 'status', '') = 'cancelled' then
    select case lower(coalesce(up.preferred_language, 'en'))
      when 'th' then 'th'
      when 'zh' then 'zh'
      else 'en'
    end
    into v_language
    from public.user_profiles up
    where up.id = v_user_id;

    v_language := coalesce(v_language, 'en');

    insert into public.order_notification_events (
      order_id,
      notification_type,
      language
    ) values (
      p_order_id,
      'customer_cancellation',
      v_language
    )
    on conflict (order_id, notification_type) do nothing;
  end if;

  return v_result;
end;
$$;

comment on function public.cancel_online_order(uuid) is
  'Legacy customer cancellation entrypoint. On successful cancellation, also creates a durable customer_cancellation notification event.';

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
  v_language text := 'en';
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

  v_result := public.cancel_online_order_v2_inventory_v1(p_order_id);

  perform public.refund_reserved_order_loyalty_reward_v2(
    p_order_id,
    v_user_id,
    'Customer cancelled Pickup v2 order before payment'
  );

  select to_jsonb(o)
  into v_result
  from public.orders o
  where o.id = p_order_id;

  if coalesce(v_result ->> 'status', '') = 'cancelled' then
    select case lower(coalesce(up.preferred_language, 'en'))
      when 'th' then 'th'
      when 'zh' then 'zh'
      else 'en'
    end
    into v_language
    from public.user_profiles up
    where up.id = v_user_id;

    v_language := coalesce(v_language, 'en');

    insert into public.order_notification_events (
      order_id,
      notification_type,
      language
    ) values (
      p_order_id,
      'customer_cancellation',
      v_language
    )
    on conflict (order_id, notification_type) do nothing;
  end if;

  return v_result;
end;
$$;

comment on function public.cancel_online_order_v2(uuid) is
  'Pickup v2 customer cancellation wrapper. Preserves hardened ownership/inventory/loyalty behavior and creates a durable customer_cancellation notification event after success.';

revoke execute on function public.claim_order_notification(uuid, text) from public;
revoke execute on function public.claim_order_notification(uuid, text) from anon;
revoke execute on function public.claim_order_notification(uuid, text) from authenticated;
grant execute on function public.claim_order_notification(uuid, text) to service_role;

revoke execute on function public.cancel_online_order(uuid) from public;
revoke execute on function public.cancel_online_order(uuid) from anon;
grant execute on function public.cancel_online_order(uuid) to authenticated;
grant execute on function public.cancel_online_order(uuid) to service_role;

revoke execute on function public.cancel_online_order_v2(uuid) from public;
revoke execute on function public.cancel_online_order_v2(uuid) from anon;
grant execute on function public.cancel_online_order_v2(uuid) to authenticated;
grant execute on function public.cancel_online_order_v2(uuid) to service_role;

commit;
