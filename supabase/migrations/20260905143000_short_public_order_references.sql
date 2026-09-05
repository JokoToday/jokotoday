/*
  Short public online-order references.

  Purpose
  -------
  Separate the customer-facing order number from the browser-generated
  idempotency reference used by the checkout RPCs.

  New public order numbers are server-generated as:

    JT-10001
    JT-10002
    ...

  The existing ORD-<timestamp>-<random> value remains an internal request
  reference so retries keep their current idempotent behavior.

  Rollout safety
  --------------
  - Existing historical order_number values are not rewritten.
  - Existing online ORD references are backfilled into the new request column
    so a stale/retrying checkout remains idempotent across the migration.
  - No RLS, grants, inventory, payment, loyalty, or notification semantics are
    changed.
  - The browser RPC signatures remain unchanged, so frontend and backend can be
    deployed independently.
  - The function rewrite is fail-closed: it only patches the exact production
    function shapes expected at this migration point.
*/

alter table public.orders
  add column if not exists client_request_reference text;

comment on column public.orders.client_request_reference is
  'Internal browser checkout idempotency reference. Not the customer-facing order number.';

-- Preserve retry continuity for online orders created before this migration.
update public.orders
set client_request_reference = order_number
where client_request_reference is null
  and coalesce(purchase_type, 'online') = 'online'
  and order_number ~ '^ORD-[0-9]{10,20}-[A-Z0-9]{4,12}$';

create unique index if not exists orders_client_request_reference_key
  on public.orders (client_request_reference)
  where client_request_reference is not null;

create sequence if not exists public.online_order_number_seq
  as bigint
  increment by 1
  start with 10001
  minvalue 10001
  no maxvalue
  cache 1;

comment on sequence public.online_order_number_seq is
  'Server-only sequence for short customer-facing online order numbers (JT-xxxxx).';

-- The sequence is consumed inside SECURITY DEFINER checkout functions only.
revoke all on sequence public.online_order_number_seq from public;
revoke all on sequence public.online_order_number_seq from anon;
revoke all on sequence public.online_order_number_seq from authenticated;

do $$
declare
  v_definition text;
  v_original text;
begin
  /* -----------------------------------------------------------------------
     Legacy online checkout RPC
     -------------------------------------------------------------------- */
  select pg_get_functiondef(
    'public.create_online_order(text,text,jsonb,text)'::regprocedure
  ) into v_definition;

  if v_definition is null then
    raise exception 'create_online_order definition is unavailable';
  end if;

  v_original := v_definition;

  if position(
    'select * into v_existing from public.orders where order_number = p_order_number;'
    in v_definition
  ) = 0 then
    raise exception 'create_online_order idempotency lookup shape changed; refusing migration';
  end if;

  v_definition := replace(
    v_definition,
    'select * into v_existing from public.orders where order_number = p_order_number;',
    'select * into v_existing from public.orders where client_request_reference = p_order_number;'
  );

  if position(
    'customer_id, order_number, order_items, total_amount, pickup_location_id, pickup_date,'
    in v_definition
  ) = 0 then
    raise exception 'create_online_order insert column shape changed; refusing migration';
  end if;

  v_definition := replace(
    v_definition,
    'customer_id, order_number, order_items, total_amount, pickup_location_id, pickup_date,',
    'customer_id, order_number, client_request_reference, order_items, total_amount, pickup_location_id, pickup_date,'
  );

  if position(
    'v_customer.id, p_order_number, v_order_items, v_total, v_pickup.location_id, v_pickup_date,'
    in v_definition
  ) = 0 then
    raise exception 'create_online_order insert values shape changed; refusing migration';
  end if;

  v_definition := replace(
    v_definition,
    'v_customer.id, p_order_number, v_order_items, v_total, v_pickup.location_id, v_pickup_date,',
    'v_customer.id, ''JT-'' || nextval(''public.online_order_number_seq'')::text, p_order_number, v_order_items, v_total, v_pickup.location_id, v_pickup_date,'
  );

  if v_definition = v_original then
    raise exception 'create_online_order was not modified; refusing migration';
  end if;

  execute v_definition;

  /* -----------------------------------------------------------------------
     Pickup v2 online checkout RPC
     -------------------------------------------------------------------- */
  select pg_get_functiondef(
    'public.create_online_order_v2(text,uuid,uuid,jsonb,text)'::regprocedure
  ) into v_definition;

  if v_definition is null then
    raise exception 'create_online_order_v2 definition is unavailable';
  end if;

  v_original := v_definition;

  if position(
    E'FROM public.orders\n  WHERE order_number = p_order_number;'
    in v_definition
  ) = 0 then
    raise exception 'create_online_order_v2 idempotency lookup shape changed; refusing migration';
  end if;

  v_definition := replace(
    v_definition,
    E'FROM public.orders\n  WHERE order_number = p_order_number;',
    E'FROM public.orders\n  WHERE client_request_reference = p_order_number;'
  );

  if position(
    E'customer_id, order_number, order_items, total_amount,\n    pickup_location_id, pickup_date, pickup_date_id,'
    in v_definition
  ) = 0 then
    raise exception 'create_online_order_v2 insert column shape changed; refusing migration';
  end if;

  v_definition := replace(
    v_definition,
    E'customer_id, order_number, order_items, total_amount,\n    pickup_location_id, pickup_date, pickup_date_id,',
    E'customer_id, order_number, client_request_reference, order_items, total_amount,\n    pickup_location_id, pickup_date, pickup_date_id,'
  );

  if position(
    E'v_customer.id, p_order_number, v_order_items, v_total,\n    p_pickup_location_id, v_date.pickup_date, v_date.id,'
    in v_definition
  ) = 0 then
    raise exception 'create_online_order_v2 insert values shape changed; refusing migration';
  end if;

  v_definition := replace(
    v_definition,
    E'v_customer.id, p_order_number, v_order_items, v_total,\n    p_pickup_location_id, v_date.pickup_date, v_date.id,',
    E'v_customer.id, ''JT-'' || nextval(''public.online_order_number_seq'')::text, p_order_number, v_order_items, v_total,\n    p_pickup_location_id, v_date.pickup_date, v_date.id,'
  );

  if v_definition = v_original then
    raise exception 'create_online_order_v2 was not modified; refusing migration';
  end if;

  execute v_definition;
end;
$$;

comment on function public.create_online_order(text,text,jsonb,text) is
  'Creates an authenticated online order atomically. The incoming ORD reference is an internal idempotency key; order_number is the short server-generated JT reference.';

comment on function public.create_online_order_v2(text,uuid,uuid,jsonb,text) is
  'Pickup v2 customer checkout RPC. The incoming ORD reference is an internal idempotency key; order_number is the short server-generated JT reference.';
