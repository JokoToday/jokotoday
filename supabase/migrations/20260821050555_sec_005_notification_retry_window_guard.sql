-- SEC-005B review fix: keep automatic crash recovery inside the provider
-- idempotency horizon even when several retries refresh claimed_at.

alter table public.order_notification_events
  add column if not exists first_attempt_at timestamptz;

create or replace function public.claim_order_notification(
  p_order_id uuid,
  p_notification_type text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_event public.order_notification_events%rowtype;
begin
  if p_order_id is null or p_notification_type not in ('customer_confirmation', 'admin_new_order') then
    return jsonb_build_object('outcome', 'invalid');
  end if;

  if not exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and coalesce(o.purchase_type, 'online') = 'online'
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

  -- The provider's idempotency keys are retained for 24 hours. We use a
  -- conservative 23-hour ceiling measured from the immutable first attempt,
  -- not from the most recent claim, so repeated crash recovery cannot extend
  -- automatic retries past the deduplication window.
  if v_event.status = 'processing'
     and v_event.first_attempt_at is not null
     and v_event.first_attempt_at <= now() - interval '23 hours' then
    update public.order_notification_events
    set status = 'uncertain',
        updated_at = now(),
        last_error = coalesce(last_error, 'Processing outcome exceeded provider idempotency window')
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
$function$;

revoke all on function public.claim_order_notification(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_order_notification(uuid, text) to service_role;
