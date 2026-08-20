-- SEC-005B: durable order notification outbox.
--
-- Additive only. New online orders get durable notification events in the
-- same transaction as the order. Historical orders are intentionally not
-- backfilled because prior delivery state is unknowable and a backfill could
-- resend old confirmations.

create table if not exists public.order_notification_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  notification_type text not null check (notification_type in ('customer_confirmation', 'admin_new_order')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'uncertain')),
  language text check (language in ('en', 'th', 'zh')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  last_error text,
  constraint order_notification_events_order_type_key unique (order_id, notification_type)
);

create index if not exists order_notification_events_status_created_idx
  on public.order_notification_events (status, created_at);

alter table public.order_notification_events enable row level security;
revoke all on table public.order_notification_events from anon, authenticated;

create or replace function public.claim_order_notification(
  p_order_id uuid,
  p_notification_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_event public.order_notification_events%rowtype;
  v_order public.orders%rowtype;
begin
  if v_user_id is null then
    return jsonb_build_object('outcome', 'unauthorized');
  end if;

  if p_notification_type not in ('customer_confirmation', 'admin_new_order') then
    return jsonb_build_object('outcome', 'invalid');
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
    and customer_id = v_user_id
    and coalesce(purchase_type, 'online') = 'online';

  if not found then
    return jsonb_build_object('outcome', 'unauthorized');
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

  if v_event.status = 'processing' then
    if v_event.claimed_at is not null and v_event.claimed_at > now() - interval '5 minutes' then
      return jsonb_build_object(
        'outcome', 'processing',
        'event_id', v_event.id,
        'attempt_count', v_event.attempt_count,
        'language', v_event.language
      );
    end if;

    -- Resend retains idempotency keys for 24h. A stale processing claim may be
    -- retried inside a conservative 23h window; after that we stop automatic
    -- retries rather than risk sending a duplicate after provider expiry.
    if v_event.claimed_at is null or v_event.claimed_at <= now() - interval '23 hours' then
      update public.order_notification_events
      set status = 'uncertain',
          updated_at = now(),
          last_error = coalesce(last_error, 'Processing outcome became uncertain after idempotency window')
      where id = v_event.id
      returning * into v_event;

      return jsonb_build_object(
        'outcome', 'uncertain',
        'event_id', v_event.id,
        'attempt_count', v_event.attempt_count,
        'language', v_event.language
      );
    end if;
  end if;

  update public.order_notification_events
  set status = 'processing',
      attempt_count = attempt_count + 1,
      claimed_at = now(),
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

revoke all on function public.claim_order_notification(uuid, text) from public, anon;
grant execute on function public.claim_order_notification(uuid, text) to authenticated;

create or replace function public.finish_order_notification(
  p_event_id uuid,
  p_outcome text,
  p_provider_message_id text default null,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_event public.order_notification_events%rowtype;
begin
  if v_user_id is null then return false; end if;
  if p_outcome not in ('sent', 'failed', 'uncertain') then return false; end if;

  select e.* into v_event
  from public.order_notification_events e
  join public.orders o on o.id = e.order_id
  where e.id = p_event_id
    and o.customer_id = v_user_id
    and coalesce(o.purchase_type, 'online') = 'online'
  for update of e;

  if not found or v_event.status <> 'processing' then return false; end if;

  update public.order_notification_events
  set status = p_outcome,
      sent_at = case when p_outcome = 'sent' then now() else sent_at end,
      provider_message_id = case
        when p_provider_message_id is null then provider_message_id
        else left(p_provider_message_id, 500)
      end,
      last_error = case when p_error is null then null else left(p_error, 1000) end,
      updated_at = now()
  where id = v_event.id;

  return true;
end;
$function$;

revoke all on function public.finish_order_notification(uuid, text, text, text) from public, anon;
grant execute on function public.finish_order_notification(uuid, text, text, text) to authenticated;

create or replace function public.create_online_order(
  p_order_number text,
  p_pickup_day_key text,
  p_items jsonb,
  p_notes text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_customer public.customers%rowtype;
  v_pickup public.cms_pickup_days%rowtype;
  v_cutoff public.pickup_cutoff_rules%rowtype;
  v_override public.pickup_overrides%rowtype;
  v_existing public.orders%rowtype;
  v_product public.cms_products%rowtype;
  v_order public.orders%rowtype;
  v_item record;
  v_now_bangkok timestamp := timezone('Asia/Bangkok', now());
  v_today_bangkok date;
  v_pickup_date date;
  v_cutoff_date date;
  v_cutoff_at timestamp;
  v_cutoff_weekday integer;
  v_cutoff_day text;
  v_cutoff_time text;
  v_item_count integer;
  v_distinct_item_count integer;
  v_invalid_item_count integer;
  v_stock integer;
  v_total numeric := 0;
  v_order_items jsonb := '[]'::jsonb;
  v_available_days jsonb;
  v_language text := 'en';
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_order_number is null or p_order_number !~ '^ORD-[0-9]{10,20}-[A-Z0-9]{4,12}$' then raise exception 'Invalid order reference'; end if;
  if p_pickup_day_key is null or btrim(p_pickup_day_key) = '' then raise exception 'Pickup day is required'; end if;
  if p_notes is not null and length(p_notes) > 2000 then raise exception 'Order notes are too long'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'Order items must be an array'; end if;
  v_item_count := jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 50 then raise exception 'Order must contain between 1 and 50 items'; end if;

  select count(distinct item.product_id),
         count(*) filter (where item.product_id is null or item.quantity is null or item.quantity < 1 or item.quantity > 99)
  into v_distinct_item_count, v_invalid_item_count
  from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer);

  if v_invalid_item_count > 0 then raise exception 'Each order item requires a valid product and quantity from 1 to 99'; end if;
  if v_distinct_item_count <> v_item_count then raise exception 'Duplicate products are not allowed in one order request'; end if;

  select * into v_customer from public.customers where id = v_user_id for update;
  if not found then raise exception 'Completed customer profile required'; end if;
  if coalesce(v_customer.status, 'active') <> 'active' then raise exception 'Customer account is not active'; end if;

  select case lower(coalesce(up.preferred_language, 'en')) when 'th' then 'th' when 'zh' then 'zh' else 'en' end
  into v_language
  from public.user_profiles up
  where up.id = v_user_id;
  v_language := coalesce(v_language, 'en');

  select * into v_existing from public.orders where order_number = p_order_number;
  if found then
    if v_existing.customer_id is distinct from v_user_id or coalesce(v_existing.purchase_type, 'online') <> 'online' then raise exception 'Order reference conflict'; end if;
    return to_jsonb(v_existing);
  end if;

  select * into v_pickup from public.cms_pickup_days where day_key = p_pickup_day_key and coalesce(is_open, false) = true;
  if not found then raise exception 'Selected pickup day is not available'; end if;
  if v_pickup.location_id is null then raise exception 'Selected pickup day has no pickup location'; end if;

  select * into v_cutoff from public.pickup_cutoff_rules where day_key = v_pickup.day_key and coalesce(is_active, false) = true;
  if not found then raise exception 'No active cutoff rule exists for the selected pickup day'; end if;

  v_today_bangkok := v_now_bangkok::date;
  v_pickup_date := v_today_bangkok + ((v_pickup.pickup_weekday - extract(dow from v_today_bangkok)::integer + 7) % 7);

  select * into v_override
  from public.pickup_overrides
  where date = v_pickup_date and pickup_day = v_cutoff.pickup_day and location = v_cutoff.location and coalesce(is_active, false) = true
  order by updated_at desc nulls last, created_at desc nulls last limit 1;

  if found and v_override.override_type in ('closed', 'sold_out') then raise exception 'Selected pickup day is unavailable'; end if;
  if found and v_override.override_type = 'custom_cutoff' then
    if v_override.custom_cutoff_day is null or v_override.custom_cutoff_time is null then raise exception 'Invalid custom cutoff configuration'; end if;
    v_cutoff_day := v_override.custom_cutoff_day;
    v_cutoff_time := v_override.custom_cutoff_time;
  else
    v_cutoff_day := v_cutoff.cutoff_day;
    v_cutoff_time := v_cutoff.cutoff_time;
  end if;

  v_cutoff_weekday := case v_cutoff_day
    when 'Sunday' then 0 when 'Monday' then 1 when 'Tuesday' then 2 when 'Wednesday' then 3
    when 'Thursday' then 4 when 'Friday' then 5 when 'Saturday' then 6 else null end;
  if v_cutoff_weekday is null then raise exception 'Invalid cutoff day configuration'; end if;

  begin
    v_cutoff_date := v_pickup_date - ((v_pickup.pickup_weekday - v_cutoff_weekday + 7) % 7);
    v_cutoff_at := v_cutoff_date::timestamp + v_cutoff_time::time;
  exception when invalid_datetime_format then raise exception 'Invalid cutoff time configuration'; end;
  if v_now_bangkok >= v_cutoff_at then raise exception 'Ordering cutoff has passed for the selected pickup day'; end if;

  for v_item in
    select item.product_id, item.quantity from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer) order by item.product_id
  loop
    select * into v_product from public.cms_products where id = v_item.product_id for update;
    if not found then raise exception 'A selected product no longer exists'; end if;
    if coalesce(v_product.is_active, false) = false or coalesce(v_product.is_sold_out, false) = true then raise exception 'Product % is not available', v_product.name_en; end if;

    v_available_days := coalesce(v_product.available_days, '[]'::jsonb);
    if jsonb_typeof(v_available_days) <> 'array' then raise exception 'Invalid availability configuration for product %', v_product.name_en; end if;
    if jsonb_array_length(v_available_days) > 0 and not (
      v_available_days ? v_pickup.day_key
      or v_available_days ? v_pickup.label
      or (v_pickup.label_en is not null and v_available_days ? v_pickup.label_en)
      or v_available_days ? (v_cutoff.pickup_day || ' – ' || v_cutoff.location)
      or v_available_days ? (v_cutoff.pickup_day || ' - ' || v_cutoff.location)
    ) then raise exception 'Product % is not offered for the selected pickup day', v_product.name_en; end if;

    v_stock := coalesce(
      nullif(v_product.stock_by_day ->> v_pickup.day_key, '')::integer,
      nullif(v_product.stock_by_day ->> v_pickup.label, '')::integer,
      nullif(v_product.stock_by_day ->> coalesce(v_pickup.label_en, v_pickup.label), '')::integer,
      nullif(v_product.stock_by_day ->> (v_cutoff.pickup_day || ' – ' || v_cutoff.location), '')::integer,
      nullif(v_product.stock_by_day ->> (v_cutoff.pickup_day || ' - ' || v_cutoff.location), '')::integer,
      v_product.stock_remaining,
      0
    );
    if v_stock < v_item.quantity then raise exception 'Insufficient stock for product %', v_product.name_en; end if;

    v_total := v_total + (v_product.price * v_item.quantity);
    v_order_items := v_order_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'product_name', v_product.name_en,
      'product_name_th', v_product.name_th,
      'product_name_zh', coalesce(v_product.name_zh, ''),
      'quantity', v_item.quantity,
      'price_at_order', v_product.price
    ));

    update public.cms_products
    set stock_by_day = jsonb_set(coalesce(stock_by_day, '{}'::jsonb), array[v_pickup.day_key], to_jsonb(v_stock - v_item.quantity), true),
        updated_at = now()
    where id = v_product.id;
  end loop;

  insert into public.orders (
    customer_id, order_number, order_items, total_amount, pickup_location_id, pickup_date,
    status, payment_status, line_id, customer_name, customer_phone, customer_email, notes,
    pickup_day, purchase_type, inventory_reserved
  ) values (
    v_customer.id, p_order_number, v_order_items, v_total, v_pickup.location_id, v_pickup_date,
    'pending', 'unpaid', v_customer.line_id, v_customer.name, v_customer.phone, v_customer.email,
    nullif(btrim(coalesce(p_notes, '')), ''), coalesce(v_pickup.label_en, v_pickup.label), 'online', true
  ) returning * into v_order;

  insert into public.order_notification_events (order_id, notification_type, language)
  values
    (v_order.id, 'customer_confirmation', v_language),
    (v_order.id, 'admin_new_order', null)
  on conflict (order_id, notification_type) do nothing;

  return to_jsonb(v_order);
end;
$function$;

revoke all on function public.create_online_order(text, text, jsonb, text) from public, anon;
grant execute on function public.create_online_order(text, text, jsonb, text) to authenticated;
