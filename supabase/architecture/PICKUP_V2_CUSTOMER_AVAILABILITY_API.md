# Pickup v2 — Customer Availability API

## Purpose

Provide a deliberately small, customer-safe read contract for Pickup v2 without exposing the internal Pickup v2 inventory tables or weakening their existing Admin-only RLS boundaries.

This contract is the backend foundation for:

- concrete-date customer pickup selection
- product-level availability
- remaining quantity display
- cart-wide common-date intersection
- Browse Everything + Pickup Finder
- later checkout cutover to `create_online_order_v2`

## Product principle

Business values such as product availability, capacities, pickup schedules, cutoffs and locations are Admin-managed data. They are not hard-coded into frontend code or migrations.

The customer API reads the current materialized state produced from those Admin settings.

## Security boundary

Do not add a broad customer SELECT policy to `public.product_date_inventory`.

That table contains internal fields such as `capacity_source` and `override_note`, and it is already deliberately restricted to Admin reads.

The recommended design is:

1. keep all existing table RLS boundaries unchanged;
2. add a non-exposed `private` schema for the privileged read helper;
3. put the `SECURITY DEFINER` helper in `private`, with `search_path = ''` and all relation names schema-qualified;
4. expose a `SECURITY INVOKER` wrapper in `public`;
5. grant only `EXECUTE` on the public wrapper to `anon` and `authenticated`;
6. return only the customer-safe fields listed below.

This follows current Supabase guidance that `SECURITY DEFINER` functions should not live in an exposed schema.

## Public contract

Planned RPC:

`get_customer_pickup_availability_v2(p_product_ids uuid[] default null)`

One result row represents one product on one concrete pickup date.

Returned fields:

- `pickup_date_id`
- `pickup_date`
- `order_cutoff_at`
- `schedule_id`
- `schedule_key`
- `schedule_label_en`
- `schedule_label_th`
- `schedule_label_zh`
- `product_id`
- `remaining_quantity`
- `locations` — JSON array containing only active customer-facing pickup location fields

The API intentionally does **not** return:

- raw capacity
- reserved quantity
- capacity source
- override notes
- inventory events
- Admin notes
- historical or closed internal state

## Availability rules

A product/date row is customer-visible only when all applicable conditions are true:

- pickup date is today or later in Bangkok time;
- concrete pickup date status is `open`;
- current time is before `order_cutoff_at`;
- recurring schedule is active;
- CMS product is active and not globally sold out;
- at least one active concrete pickup location exists for the date;
- the product has a materialized `product_date_inventory` row;
- recurring-default inventory is included only while its `product_schedule_capacity.is_active` flag is true;
- explicit date overrides remain independently valid, matching the existing `create_online_order_v2` behavior;
- `remaining_quantity = greatest(capacity - reserved_quantity, 0)`.

Rows with `remaining_quantity = 0` may still be returned so the customer interface can distinguish sold-out dates from dates where a product was never offered.

## Prepared SQL

The following is the reviewed implementation shape. It must be created as a **new forward migration** and must not be applied to production without the explicit database-migration gate.

```sql
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
```

## Frontend contract

`src/lib/pickupAvailabilityV2.ts` is intentionally dark until this API is applied. It:

- fetches the safe RPC contract;
- normalizes the response;
- contains no capacity/schedule hard-coding;
- provides `getCommonPickupDates()` for cart-wide date intersection;
- checks required cart quantities against `remaining_quantity`.

## Common-date rule

For a cart containing products A, B and C, a date is selectable only if:

`available(A, date) ∩ available(B, date) ∩ available(C, date)`

and each row has enough `remaining_quantity` for the requested cart quantity.

This logic is generic and supports future products, schedules, locations and capacity changes without code changes.

## Validation required before production apply

- migration created as a new forward migration only;
- no historical migration edited;
- function definitions reviewed after apply;
- `PUBLIC` has no execute privilege on either helper or wrapper;
- public wrapper executable by `anon` and `authenticated` only as intended;
- internal Pickup v2 tables retain their existing RLS policies/grants;
- anonymous customer can read only returned safe fields;
- Admin can continue reading full inventory through existing Admin boundaries;
- inactive recurring product is absent for recurring-default inventory;
- explicit date override behaves consistently with `create_online_order_v2`;
- closed date and passed cutoff are absent;
- inactive location is absent;
- zero remaining quantity is returned as zero, never negative;
- product-ID filtering works;
- empty/null product filter returns all customer-visible product/date rows.
