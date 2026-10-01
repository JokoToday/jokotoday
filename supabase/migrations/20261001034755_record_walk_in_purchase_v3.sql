-- JOKO POS Phase 2: itemized walk-in purchase RPC.
-- Additive only: preserves record_walk_in_purchase_v2 for rollback/fallback.

create or replace function public.record_walk_in_purchase_v3(
  p_customer_id uuid,
  p_items jsonb,
  p_order_number text,
  p_reward_id uuid,
  p_request_key uuid,
  p_payment_method text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_customer public.customers%rowtype;
  v_existing_order public.orders%rowtype;
  v_order public.orders%rowtype;
  v_reward public.loyalty_rewards%rowtype;
  v_existing_redemption public.loyalty_redemptions%rowtype;
  v_product public.cms_products%rowtype;
  v_item record;
  v_item_count integer;
  v_distinct_item_count integer;
  v_invalid_item_count integer;
  v_request_items_key jsonb := '[]'::jsonb;
  v_existing_items_key jsonb := '[]'::jsonb;
  v_order_items jsonb := '[]'::jsonb;
  v_gross numeric(10,2) := 0;
  v_discount numeric(10,2) := 0;
  v_net_paid numeric(10,2);
  v_rate numeric;
  v_points_earned integer;
  v_points_redeemed integer := 0;
  v_balance integer;
  v_customer_redemptions integer;
  v_total_redemptions integer;
  v_redemption_id uuid;
  v_snapshot jsonb;
  v_manual_fulfillment boolean := false;
begin
  if v_actor_id is null or not public.is_staff_or_admin() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  if p_customer_id is null or p_request_key is null then
    raise exception 'Customer and request key are required';
  end if;

  if p_order_number is null or p_order_number !~ '^WI-[A-Za-z0-9-]+$' then
    raise exception 'Invalid walk-in purchase reference';
  end if;

  if p_payment_method is null or p_payment_method not in ('cash', 'qr_code') then
    raise exception 'Walk-in payment method must be cash or qr_code';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Walk-in items must be an array';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 50 then
    raise exception 'Walk-in purchase must contain between 1 and 50 items';
  end if;

  select
    count(distinct item.product_id),
    count(*) filter (
      where item.product_id is null
         or item.quantity is null
         or item.quantity < 1
         or item.quantity > 99
    ),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'product_id', item.product_id::text,
          'quantity', item.quantity
        ) order by item.product_id
      ),
      '[]'::jsonb
    )
  into v_distinct_item_count, v_invalid_item_count, v_request_items_key
  from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer);

  if v_invalid_item_count > 0 then
    raise exception 'Each walk-in item requires a valid product and quantity from 1 to 99';
  end if;

  if v_distinct_item_count <> v_item_count then
    raise exception 'Duplicate products are not allowed in one walk-in purchase request';
  end if;

  -- Fast idempotency check before taking the customer row lock.
  select * into v_existing_order
  from public.orders o
  where o.staff_request_key = p_request_key
     or o.order_number = p_order_number
  order by (o.staff_request_key = p_request_key) desc
  limit 1;

  if found then
    if v_existing_order.customer_id is distinct from p_customer_id
       or v_existing_order.purchase_type is distinct from 'walk_in'
       or v_existing_order.order_number is distinct from p_order_number
       or v_existing_order.payment_method is distinct from p_payment_method then
      raise exception 'Walk-in purchase request conflicts with an existing sale';
    end if;

    if v_existing_order.order_items is null
       or jsonb_typeof(v_existing_order.order_items) <> 'array' then
      raise exception 'Existing walk-in order snapshot is invalid for idempotent retry';
    end if;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'product_id', item.product_id::text,
          'quantity', item.quantity
        ) order by item.product_id
      ),
      '[]'::jsonb
    )
    into v_existing_items_key
    from jsonb_to_recordset(v_existing_order.order_items)
      as item(product_id uuid, quantity integer);

    if v_existing_items_key is distinct from v_request_items_key then
      raise exception 'Walk-in purchase retry uses a different basket';
    end if;

    select * into v_existing_redemption
    from public.loyalty_redemptions r
    where r.order_id = v_existing_order.id
      and r.status <> 'reversed'
    order by r.created_at, r.id
    limit 1;

    if (p_reward_id is null) is distinct from (v_existing_redemption.id is null)
       or (p_reward_id is not null and v_existing_redemption.reward_id is distinct from p_reward_id) then
      raise exception 'Walk-in purchase retry uses a different reward';
    end if;

    select coalesce(c.loyalty_points, 0) into v_balance
    from public.customers c
    where c.id = p_customer_id;

    return jsonb_build_object(
      'order_id', v_existing_order.id,
      'order_number', v_existing_order.order_number,
      'order_items', v_existing_order.order_items,
      'gross_amount', v_existing_order.total_amount,
      'discount_amount', coalesce(v_existing_order.loyalty_discount_amount, 0),
      'amount_paid', coalesce(v_existing_order.amount_paid, v_existing_order.total_amount),
      'payment_method', v_existing_order.payment_method,
      'points_redeemed', coalesce(v_existing_redemption.points_spent, 0),
      'points_earned', coalesce(v_existing_order.loyalty_points_earned, 0),
      'updated_balance', v_balance,
      'reward_id', v_existing_redemption.reward_id,
      'reward_type', v_existing_redemption.reward_snapshot ->> 'reward_type',
      'reward_name_en', v_existing_redemption.reward_snapshot ->> 'name_en',
      'reward_name_th', v_existing_redemption.reward_snapshot ->> 'name_th',
      'manual_fulfillment_required', coalesce((v_existing_redemption.reward_snapshot ->> 'manual_fulfillment_required')::boolean, false),
      'idempotent_replay', true
    );
  end if;

  -- Serialize sales for the same customer. This also protects loyalty balance changes.
  select * into v_customer
  from public.customers
  where id = p_customer_id
  for update;

  if not found then
    raise exception 'Customer not found';
  end if;

  if coalesce(v_customer.status, 'active') <> 'active' then
    raise exception 'Customer account is not active';
  end if;

  -- Re-check idempotency after the customer lock to close same-customer retry races.
  select * into v_existing_order
  from public.orders o
  where o.staff_request_key = p_request_key
     or o.order_number = p_order_number
  order by (o.staff_request_key = p_request_key) desc
  limit 1;

  if found then
    if v_existing_order.customer_id is distinct from p_customer_id
       or v_existing_order.purchase_type is distinct from 'walk_in'
       or v_existing_order.order_number is distinct from p_order_number
       or v_existing_order.payment_method is distinct from p_payment_method then
      raise exception 'Walk-in purchase request conflicts with an existing sale';
    end if;

    if v_existing_order.order_items is null
       or jsonb_typeof(v_existing_order.order_items) <> 'array' then
      raise exception 'Existing walk-in order snapshot is invalid for idempotent retry';
    end if;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'product_id', item.product_id::text,
          'quantity', item.quantity
        ) order by item.product_id
      ),
      '[]'::jsonb
    )
    into v_existing_items_key
    from jsonb_to_recordset(v_existing_order.order_items)
      as item(product_id uuid, quantity integer);

    if v_existing_items_key is distinct from v_request_items_key then
      raise exception 'Walk-in purchase retry uses a different basket';
    end if;

    select * into v_existing_redemption
    from public.loyalty_redemptions r
    where r.order_id = v_existing_order.id
      and r.status <> 'reversed'
    order by r.created_at, r.id
    limit 1;

    if (p_reward_id is null) is distinct from (v_existing_redemption.id is null)
       or (p_reward_id is not null and v_existing_redemption.reward_id is distinct from p_reward_id) then
      raise exception 'Walk-in purchase retry uses a different reward';
    end if;

    return jsonb_build_object(
      'order_id', v_existing_order.id,
      'order_number', v_existing_order.order_number,
      'order_items', v_existing_order.order_items,
      'gross_amount', v_existing_order.total_amount,
      'discount_amount', coalesce(v_existing_order.loyalty_discount_amount, 0),
      'amount_paid', coalesce(v_existing_order.amount_paid, v_existing_order.total_amount),
      'payment_method', v_existing_order.payment_method,
      'points_redeemed', coalesce(v_existing_redemption.points_spent, 0),
      'points_earned', coalesce(v_existing_order.loyalty_points_earned, 0),
      'updated_balance', coalesce(v_customer.loyalty_points, 0),
      'reward_id', v_existing_redemption.reward_id,
      'reward_type', v_existing_redemption.reward_snapshot ->> 'reward_type',
      'reward_name_en', v_existing_redemption.reward_snapshot ->> 'name_en',
      'reward_name_th', v_existing_redemption.reward_snapshot ->> 'name_th',
      'manual_fulfillment_required', coalesce((v_existing_redemption.reward_snapshot ->> 'manual_fulfillment_required')::boolean, false),
      'idempotent_replay', true
    );
  end if;

  -- Canonical, server-priced basket snapshot. POS v1 intentionally ignores
  -- preorder is_sold_out/date inventory semantics; only active catalogue rows
  -- are eligible here. Physical counter inventory is a later phase.
  for v_item in
    select item.product_id, item.quantity
    from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
    order by item.product_id
  loop
    select * into v_product
    from public.cms_products
    where id = v_item.product_id
    for update;

    if not found then
      raise exception 'A selected product no longer exists';
    end if;

    if coalesce(v_product.is_active, false) = false then
      raise exception 'Product % is not active', v_product.name_en;
    end if;

    v_gross := v_gross + (v_product.price * v_item.quantity);
    v_order_items := v_order_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'product_name', v_product.name_en,
      'product_name_th', v_product.name_th,
      'product_name_zh', coalesce(v_product.name_zh, ''),
      'quantity', v_item.quantity,
      'price_at_order', v_product.price
    ));
  end loop;

  v_gross := round(v_gross, 2);
  if v_gross <= 0 then
    raise exception 'Walk-in purchase total must be greater than zero';
  end if;

  if p_reward_id is not null then
    select * into v_reward
    from public.loyalty_rewards
    where id = p_reward_id
    for update;

    if not found then
      raise exception 'Reward not found';
    end if;

    if not v_reward.is_active
       or (v_reward.starts_at is not null and v_reward.starts_at > now())
       or (v_reward.ends_at is not null and v_reward.ends_at <= now()) then
      raise exception 'Reward is not currently available';
    end if;

    if not ('walk_in' = any(v_reward.channels)) then
      raise exception 'Reward is not available for walk-in purchases';
    end if;

    if v_reward.reward_type = 'free_product' then
      raise exception 'Free-product redemption is not available until inventory-aware fulfillment is enabled';
    end if;

    if v_reward.minimum_order_amount > v_gross then
      raise exception 'Minimum order amount for this reward is not met';
    end if;

    if v_reward.per_customer_limit is not null then
      select count(*)::integer into v_customer_redemptions
      from public.loyalty_redemptions r
      where r.customer_id = p_customer_id
        and r.reward_id = p_reward_id
        and r.status <> 'reversed';

      if v_customer_redemptions >= v_reward.per_customer_limit then
        raise exception 'Customer redemption limit reached for this reward';
      end if;
    end if;

    if v_reward.total_redemption_limit is not null then
      select count(*)::integer into v_total_redemptions
      from public.loyalty_redemptions r
      where r.reward_id = p_reward_id
        and r.status <> 'reversed';

      if v_total_redemptions >= v_reward.total_redemption_limit then
        raise exception 'Reward redemption limit reached';
      end if;
    end if;

    if coalesce(v_customer.loyalty_points, 0) < v_reward.points_required then
      raise exception 'Insufficient loyalty points';
    end if;

    if v_reward.reward_type = 'fixed_discount' then
      v_discount := least(v_gross, v_reward.fixed_discount_amount)::numeric(10,2);
    elsif v_reward.reward_type = 'percentage_discount' then
      v_discount := round(v_gross * v_reward.percentage_discount / 100.0, 2);
      if v_reward.max_discount_amount is not null then
        v_discount := least(v_discount, v_reward.max_discount_amount);
      end if;
      v_discount := least(v_discount, v_gross)::numeric(10,2);
    else
      v_discount := 0;
      v_manual_fulfillment := true;
    end if;

    v_points_redeemed := v_reward.points_required;
  end if;

  v_net_paid := round(v_gross - v_discount, 2);

  select coalesce(ls.points_per_baht, round(ls.points_percentage / 100.0, 5), 0)
  into v_rate
  from public.loyalty_settings ls
  where ls.purchase_type = 'walk_in';

  v_rate := coalesce(v_rate, 0);
  v_points_earned := round(v_net_paid * v_rate);

  insert into public.orders(
    customer_id,
    purchase_type,
    walk_in_amount,
    staff_id,
    order_number,
    order_items,
    total_amount,
    loyalty_discount_amount,
    amount_paid,
    staff_request_key,
    status,
    payment_status,
    payment_method,
    customer_name,
    customer_phone,
    customer_email,
    loyalty_multiplier,
    loyalty_points_earned,
    inventory_reserved,
    created_at,
    updated_at
  ) values (
    v_customer.id,
    'walk_in',
    v_gross,
    v_actor_id,
    p_order_number,
    v_order_items,
    v_gross,
    v_discount,
    v_net_paid,
    p_request_key,
    'completed',
    'paid',
    p_payment_method,
    v_customer.name,
    v_customer.phone,
    v_customer.email,
    v_rate,
    v_points_earned,
    false,
    now(),
    now()
  )
  returning * into v_order;

  -- The existing order INSERT trigger recomputes walk-in loyalty from amount_paid.
  v_points_earned := coalesce(v_order.loyalty_points_earned, 0);
  v_balance := coalesce(v_customer.loyalty_points, 0);

  if p_reward_id is not null then
    v_snapshot := jsonb_build_object(
      'reward_key', v_reward.reward_key,
      'name_en', v_reward.name_en,
      'name_th', v_reward.name_th,
      'name_zh', v_reward.name_zh,
      'description_en', v_reward.description_en,
      'description_th', v_reward.description_th,
      'description_zh', v_reward.description_zh,
      'reward_type', v_reward.reward_type,
      'points_required', v_reward.points_required,
      'fixed_discount_amount', v_reward.fixed_discount_amount,
      'percentage_discount', v_reward.percentage_discount,
      'max_discount_amount', v_reward.max_discount_amount,
      'minimum_order_amount', v_reward.minimum_order_amount,
      'context_amount', v_gross,
      'discount_amount', v_discount,
      'net_due', v_net_paid,
      'channel', 'walk_in',
      'request_key', p_request_key,
      'manual_fulfillment_required', v_manual_fulfillment,
      'fulfillment', case when v_manual_fulfillment then 'staff_manual' else 'payment_applied' end
    );

    insert into public.loyalty_redemptions(
      customer_id,
      reward_id,
      order_id,
      channel,
      status,
      points_spent,
      reward_snapshot,
      created_by,
      request_key
    ) values (
      p_customer_id,
      p_reward_id,
      v_order.id,
      'walk_in',
      'redeemed',
      v_reward.points_required,
      v_snapshot,
      v_actor_id,
      p_request_key
    )
    returning id into v_redemption_id;

    v_balance := public.apply_loyalty_points_delta_v2(
      p_customer_id,
      -v_reward.points_required,
      'redeem',
      v_order.id,
      v_redemption_id,
      v_actor_id,
      'Walk-in reward redeemed with itemized POS sale',
      jsonb_build_object(
        'reward_id', p_reward_id,
        'reward_key', v_reward.reward_key,
        'channel', 'walk_in',
        'gross_amount', v_gross,
        'discount_amount', v_discount,
        'amount_paid', v_net_paid,
        'request_key', p_request_key,
        'itemized_pos', true
      )
    );
  end if;

  if v_points_earned > 0 then
    v_balance := public.apply_loyalty_points_delta_v2(
      p_customer_id,
      v_points_earned,
      'earn',
      v_order.id,
      null,
      v_actor_id,
      'Points awarded for completed itemized walk-in POS purchase',
      jsonb_build_object(
        'purchase_type', 'walk_in',
        'loyalty_rate', v_rate,
        'gross_amount', v_gross,
        'discount_amount', v_discount,
        'amount_paid', v_net_paid,
        'itemized_pos', true
      )
    );

    update public.orders
    set loyalty_points_awarded_at = now()
    where id = v_order.id
    returning * into v_order;
  end if;

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'order_items', v_order.order_items,
    'gross_amount', v_gross,
    'discount_amount', v_discount,
    'amount_paid', v_net_paid,
    'payment_method', p_payment_method,
    'points_redeemed', v_points_redeemed,
    'points_earned', v_points_earned,
    'updated_balance', v_balance,
    'reward_id', p_reward_id,
    'reward_type', case when p_reward_id is null then null else v_reward.reward_type end,
    'reward_name_en', case when p_reward_id is null then null else v_reward.name_en end,
    'reward_name_th', case when p_reward_id is null then null else v_reward.name_th end,
    'manual_fulfillment_required', v_manual_fulfillment,
    'idempotent_replay', false
  );
end;
$function$;

comment on function public.record_walk_in_purchase_v3(uuid, jsonb, text, uuid, uuid, text)
is 'Server-authoritative itemized JOKO POS walk-in sale. Staff/admin only; v2 remains available as fallback.';

revoke all on function public.record_walk_in_purchase_v3(uuid, jsonb, text, uuid, uuid, text) from public;
revoke all on function public.record_walk_in_purchase_v3(uuid, jsonb, text, uuid, uuid, text) from anon;
grant execute on function public.record_walk_in_purchase_v3(uuid, jsonb, text, uuid, uuid, text) to authenticated;
grant execute on function public.record_walk_in_purchase_v3(uuid, jsonb, text, uuid, uuid, text) to service_role;
