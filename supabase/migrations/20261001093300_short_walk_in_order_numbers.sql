/*
  Short public Walk-In / POS order numbers.

  New customer-facing POS order numbers are server-generated as:
    WI-1001
    WI-1002
    ...

  The browser-generated WI-<UUID> remains an internal idempotency reference.
  Existing historical order_number values are not rewritten.
  Both record_walk_in_purchase_v2 and v3 keep their existing signatures.
*/

create sequence if not exists public.walk_in_order_number_seq
  as bigint
  increment by 1
  start with 1001
  minvalue 1001
  no maxvalue
  cache 1;

comment on sequence public.walk_in_order_number_seq is
  'Server-only sequence for short customer-facing Walk-In / POS order numbers (WI-xxxx).';

revoke all on sequence public.walk_in_order_number_seq from public;
revoke all on sequence public.walk_in_order_number_seq from anon;
revoke all on sequence public.walk_in_order_number_seq from authenticated;

do $$
declare
  v_max_existing bigint;
  v_seq_last bigint;
  v_seq_called boolean;
  v_next bigint;
begin
  select coalesce(max(substring(order_number from '^WI-([0-9]+)$')::bigint), 1000)
  into v_max_existing
  from public.orders
  where order_number ~ '^WI-[0-9]+$';

  select last_value, is_called
  into v_seq_last, v_seq_called
  from public.walk_in_order_number_seq;

  v_next := greatest(
    1001,
    v_max_existing + 1,
    case when v_seq_called then v_seq_last + 1 else v_seq_last end
  );

  perform setval('public.walk_in_order_number_seq', v_next, false);
end;
$$;

-- Preserve retry continuity for existing UUID-style Walk-In orders.
update public.orders
set client_request_reference = order_number
where client_request_reference is null
  and purchase_type = 'walk_in'
  and order_number ~ '^WI-[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$';

comment on column public.orders.client_request_reference is
  'Internal client-generated idempotency reference for online checkout and Walk-In / POS sales. Not customer-facing.';

do $$
declare
  v_definition text;
  v_original text;
begin
  /* Legacy amount-only member Walk-In RPC. */
  select pg_get_functiondef(
    'public.record_walk_in_purchase_v2(uuid,numeric,text,uuid,uuid,text)'::regprocedure
  ) into v_definition;

  if v_definition is null then
    raise exception 'record_walk_in_purchase_v2 definition is unavailable';
  end if;

  v_original := v_definition;

  if position(
    'WHERE o.staff_request_key=p_request_key OR o.order_number=p_order_number'
    in v_definition
  ) = 0 then
    raise exception 'record_walk_in_purchase_v2 idempotency lookup shape changed; refusing migration';
  end if;

  v_definition := replace(
    v_definition,
    'WHERE o.staff_request_key=p_request_key OR o.order_number=p_order_number',
    'WHERE o.staff_request_key=p_request_key OR o.client_request_reference=p_order_number OR o.order_number=p_order_number'
  );

  if position(
    'OR v_existing_order.order_number IS DISTINCT FROM p_order_number'
    in v_definition
  ) = 0 then
    raise exception 'record_walk_in_purchase_v2 conflict-check shape changed; refusing migration';
  end if;

  v_definition := replace(
    v_definition,
    'OR v_existing_order.order_number IS DISTINCT FROM p_order_number',
    'OR COALESCE(v_existing_order.client_request_reference,v_existing_order.order_number) IS DISTINCT FROM p_order_number'
  );

  if position(
    'INSERT INTO public.orders(customer_id,purchase_type,walk_in_amount,staff_id,order_number,order_items'
    in v_definition
  ) = 0 then
    raise exception 'record_walk_in_purchase_v2 insert column shape changed; refusing migration';
  end if;

  v_definition := replace(
    v_definition,
    'INSERT INTO public.orders(customer_id,purchase_type,walk_in_amount,staff_id,order_number,order_items',
    'INSERT INTO public.orders(customer_id,purchase_type,walk_in_amount,staff_id,order_number,client_request_reference,order_items'
  );

  if position(
    'VALUES(v_customer.id,''walk_in'',v_gross,v_actor_id,p_order_number,''[]''::jsonb'
    in v_definition
  ) = 0 then
    raise exception 'record_walk_in_purchase_v2 insert value shape changed; refusing migration';
  end if;

  v_definition := replace(
    v_definition,
    'VALUES(v_customer.id,''walk_in'',v_gross,v_actor_id,p_order_number,''[]''::jsonb',
    'VALUES(v_customer.id,''walk_in'',v_gross,v_actor_id,''WI-'' || nextval(''public.walk_in_order_number_seq'')::text,p_order_number,''[]''::jsonb'
  );

  if v_definition = v_original then
    raise exception 'record_walk_in_purchase_v2 was not modified; refusing migration';
  end if;

  execute v_definition;

  /* Itemized member/Guest POS RPC. */
  select pg_get_functiondef(
    'public.record_walk_in_purchase_v3(uuid,jsonb,text,uuid,uuid,text)'::regprocedure
  ) into v_definition;

  if v_definition is null then
    raise exception 'record_walk_in_purchase_v3 definition is unavailable';
  end if;

  v_original := v_definition;

  if position(
    E'where o.staff_request_key = p_request_key\n     or o.order_number = p_order_number'
    in v_definition
  ) = 0 then
    raise exception 'record_walk_in_purchase_v3 idempotency lookup shape changed; refusing migration';
  end if;

  v_definition := replace(
    v_definition,
    E'where o.staff_request_key = p_request_key\n     or o.order_number = p_order_number',
    E'where o.staff_request_key = p_request_key\n     or o.client_request_reference = p_order_number\n     or o.order_number = p_order_number'
  );

  if position(
    'or v_existing_order.order_number is distinct from p_order_number'
    in v_definition
  ) = 0 then
    raise exception 'record_walk_in_purchase_v3 conflict-check shape changed; refusing migration';
  end if;

  v_definition := replace(
    v_definition,
    'or v_existing_order.order_number is distinct from p_order_number',
    'or coalesce(v_existing_order.client_request_reference, v_existing_order.order_number) is distinct from p_order_number'
  );

  if position(
    E'    order_number,\n    order_items,'
    in v_definition
  ) = 0 then
    raise exception 'record_walk_in_purchase_v3 insert column shape changed; refusing migration';
  end if;

  v_definition := replace(
    v_definition,
    E'    order_number,\n    order_items,',
    E'    order_number,\n    client_request_reference,\n    order_items,'
  );

  if position(
    E'    v_actor_id,\n    p_order_number,\n    v_order_items,'
    in v_definition
  ) = 0 then
    raise exception 'record_walk_in_purchase_v3 insert value shape changed; refusing migration';
  end if;

  v_definition := replace(
    v_definition,
    E'    v_actor_id,\n    p_order_number,\n    v_order_items,',
    E'    v_actor_id,\n    ''WI-'' || nextval(''public.walk_in_order_number_seq'')::text,\n    p_order_number,\n    v_order_items,'
  );

  if v_definition = v_original then
    raise exception 'record_walk_in_purchase_v3 was not modified; refusing migration';
  end if;

  execute v_definition;
end;
$$;

comment on function public.record_walk_in_purchase_v2(uuid,numeric,text,uuid,uuid,text) is
  'Server-authoritative member Walk-In sale. Incoming WI-UUID is an internal idempotency reference; order_number is the short server-generated WI reference.';

comment on function public.record_walk_in_purchase_v3(uuid,jsonb,text,uuid,uuid,text) is
  'Server-authoritative itemized JOKO POS sale. Incoming WI-UUID is an internal idempotency reference; order_number is the short server-generated WI reference. Supports member and Guest sales.';
