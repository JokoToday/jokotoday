/*
  Pickup v2 customer-safe availability API

  Forward migration only. Do not edit the canonical 20260826030000 production
  baseline or replay historical migrations.

  Security boundary:
  - keep internal Pickup v2 table RLS unchanged;
  - privileged read helper lives in non-exposed private schema;
  - browser-facing public wrapper is SECURITY INVOKER;
  - return only customer-safe availability fields;
  - PUBLIC receives no function EXECUTE privilege.
*/

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.customer_pickup_availability_v2(
  p_product_ids uuid[] default null
)
returns table (
  pickup_date_id uuid,
  pickup_date date,
  order_cutoff_at timestamptz,
  schedule_id uuid,
  schedule_key text,
  schedule_label_en text,
  schedule_label_th text,
  schedule_label_zh text,
  product_id uuid,
  remaining_quantity integer,
  locations jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d.id as pickup_date_id,
    d.pickup_date,
    d.order_cutoff_at,
    s.id as schedule_id,
    s.schedule_key,
    s.label_en as schedule_label_en,
    s.label_th as schedule_label_th,
    s.label_zh as schedule_label_zh,
    i.product_id,
    greatest(i.capacity - i.reserved_quantity, 0)::integer as remaining_quantity,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'name_en', l.name_en,
          'name_th', l.name_th,
          'name_zh', l.name_zh,
          'description_en', l.description_en,
          'description_th', l.description_th,
          'description_zh', l.description_zh,
          'maps_url', l.maps_url,
          'sort_order', dl.sort_order
        )
        order by dl.sort_order, l.sort_order, l.name_en
      )
      from public.pickup_date_locations dl
      join public.cms_pickup_locations l
        on l.id = dl.location_id
      where dl.pickup_date_id = d.id
        and dl.is_active = true
        and l.is_active = true
    ), '[]'::jsonb) as locations
  from public.product_date_inventory i
  join public.pickup_dates d
    on d.id = i.pickup_date_id
  join public.pickup_schedules s
    on s.id = d.schedule_id
  join public.cms_products p
    on p.id = i.product_id
  left join public.product_schedule_capacity c
    on c.schedule_id = d.schedule_id
   and c.product_id = i.product_id
  where d.pickup_date >= timezone('Asia/Bangkok', now())::date
    and d.status = 'open'
    and now() < d.order_cutoff_at
    and s.is_active = true
    and p.is_active = true
    and coalesce(p.is_sold_out, false) = false
    and (
      p_product_ids is null
      or cardinality(p_product_ids) = 0
      or i.product_id = any(p_product_ids)
    )
    and (
      i.capacity_source <> 'recurring_default'
      or coalesce(c.is_active, false) = true
    )
    and exists (
      select 1
      from public.pickup_date_locations dl
      join public.cms_pickup_locations l
        on l.id = dl.location_id
      where dl.pickup_date_id = d.id
        and dl.is_active = true
        and l.is_active = true
    )
  order by d.pickup_date, s.sort_order, i.product_id;
$$;

revoke execute on function private.customer_pickup_availability_v2(uuid[]) from public;
grant execute on function private.customer_pickup_availability_v2(uuid[]) to anon, authenticated;

create or replace function public.get_customer_pickup_availability_v2(
  p_product_ids uuid[] default null
)
returns table (
  pickup_date_id uuid,
  pickup_date date,
  order_cutoff_at timestamptz,
  schedule_id uuid,
  schedule_key text,
  schedule_label_en text,
  schedule_label_th text,
  schedule_label_zh text,
  product_id uuid,
  remaining_quantity integer,
  locations jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.customer_pickup_availability_v2(p_product_ids);
$$;

revoke execute on function public.get_customer_pickup_availability_v2(uuid[]) from public;
grant execute on function public.get_customer_pickup_availability_v2(uuid[]) to anon, authenticated;

comment on function public.get_customer_pickup_availability_v2(uuid[]) is
  'Customer-safe Pickup v2 availability. Returns concrete dates, remaining quantity and active pickup locations without exposing internal inventory metadata.';
