-- Product Staff Access v1
-- Adds the distinct catalogue-maintenance role, append-only audit log, and a
-- service-role-only atomic update primitive used by the Product Staff Edge API.

alter type public.user_role add value if not exists 'product_staff';

create table if not exists public.product_change_log (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.cms_products(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text not null,
  action text not null check (action in ('update_product')),
  changed_fields text[] not null default '{}',
  old_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists product_change_log_product_created_idx
  on public.product_change_log(product_id, created_at desc);

create index if not exists product_change_log_actor_created_idx
  on public.product_change_log(actor_user_id, created_at desc);

alter table public.product_change_log enable row level security;

revoke insert, update, delete on public.product_change_log from anon, authenticated;
revoke select on public.product_change_log from anon;
grant select on public.product_change_log to authenticated;

drop policy if exists "Admins can read product change log" on public.product_change_log;
create policy "Admins can read product change log"
  on public.product_change_log
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_profiles profile
      where profile.id = (select auth.uid())
        and profile.role::text = 'admin'
    )
  );

comment on table public.product_change_log is
  'Append-only audit trail for server-authorized Product Staff catalogue mutations.';

create or replace function public.product_staff_apply_product_update_v1(
  p_product_id uuid,
  p_actor_user_id uuid,
  p_actor_role text,
  p_patch jsonb
)
returns public.cms_products
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current public.cms_products%rowtype;
  v_next public.cms_products%rowtype;
  v_result public.cms_products%rowtype;
  v_allowed_keys constant text[] := array[
    'name_en', 'name_th', 'name_zh',
    'desc_en', 'desc_th', 'desc_zh',
    'price', 'category_id', 'image',
    'short_desc_en', 'short_desc_th', 'short_desc_zh',
    'joko_note_en', 'joko_note_th', 'joko_note_zh',
    'ingredients_en', 'ingredients_th', 'ingredients_zh',
    'allergens_en', 'allergens_th', 'allergens_zh',
    'storage_en', 'storage_th', 'storage_zh',
    'best_enjoyed_en', 'best_enjoyed_th', 'best_enjoyed_zh',
    'reheating_en', 'reheating_th', 'reheating_zh',
    'is_sold_out', 'is_active', 'available_days'
  ];
  v_unknown_keys text[];
  v_changed_fields text[];
  v_old_values jsonb := '{}'::jsonb;
  v_new_values jsonb := '{}'::jsonb;
begin
  if p_actor_user_id is null or coalesce(p_actor_role, '') not in ('admin', 'product_staff') then
    raise exception 'Product Staff actor is invalid' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.user_profiles profile
    where profile.id = p_actor_user_id
      and profile.role::text = p_actor_role
  ) then
    raise exception 'Product Staff actor is not authorized' using errcode = '42501';
  end if;

  if p_product_id is null then
    raise exception 'Product is required';
  end if;

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Product patch must be a JSON object';
  end if;

  select array_agg(key order by key)
  into v_unknown_keys
  from jsonb_object_keys(p_patch) as keys(key)
  where not (key = any(v_allowed_keys));

  if coalesce(cardinality(v_unknown_keys), 0) > 0 then
    raise exception 'Product Staff cannot change fields: %', array_to_string(v_unknown_keys, ', ')
      using errcode = '42501';
  end if;

  select *
  into v_current
  from public.cms_products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Product not found';
  end if;

  v_next := jsonb_populate_record(v_current, p_patch);

  if btrim(coalesce(v_next.name_en, '')) = '' then
    raise exception 'English product name is required';
  end if;
  if btrim(coalesce(v_next.name_th, '')) = '' then
    raise exception 'Thai product name is required';
  end if;
  if v_next.price is null or v_next.price < 0 then
    raise exception 'Price must be zero or greater';
  end if;
  if v_next.is_active is null or v_next.is_sold_out is null then
    raise exception 'Product availability flags are required';
  end if;
  if v_next.category_id is null or not exists (
    select 1
    from public.cms_categories category
    where category.id = v_next.category_id
      and category.is_active = true
  ) then
    raise exception 'An active category is required';
  end if;
  if v_next.available_days is null or jsonb_typeof(v_next.available_days) <> 'array' then
    raise exception 'Available pickup days must be a JSON array';
  end if;

  update public.cms_products
  set
    name_en = v_next.name_en,
    name_th = v_next.name_th,
    name_zh = v_next.name_zh,
    desc_en = v_next.desc_en,
    desc_th = v_next.desc_th,
    desc_zh = v_next.desc_zh,
    price = v_next.price,
    category_id = v_next.category_id,
    image = v_next.image,
    short_desc_en = v_next.short_desc_en,
    short_desc_th = v_next.short_desc_th,
    short_desc_zh = v_next.short_desc_zh,
    joko_note_en = v_next.joko_note_en,
    joko_note_th = v_next.joko_note_th,
    joko_note_zh = v_next.joko_note_zh,
    ingredients_en = v_next.ingredients_en,
    ingredients_th = v_next.ingredients_th,
    ingredients_zh = v_next.ingredients_zh,
    allergens_en = v_next.allergens_en,
    allergens_th = v_next.allergens_th,
    allergens_zh = v_next.allergens_zh,
    storage_en = v_next.storage_en,
    storage_th = v_next.storage_th,
    storage_zh = v_next.storage_zh,
    best_enjoyed_en = v_next.best_enjoyed_en,
    best_enjoyed_th = v_next.best_enjoyed_th,
    best_enjoyed_zh = v_next.best_enjoyed_zh,
    reheating_en = v_next.reheating_en,
    reheating_th = v_next.reheating_th,
    reheating_zh = v_next.reheating_zh,
    is_sold_out = v_next.is_sold_out,
    is_active = v_next.is_active,
    available_days = v_next.available_days,
    updated_at = now()
  where id = p_product_id
  returning * into v_result;

  select coalesce(array_agg(key order by key), '{}'::text[])
  into v_changed_fields
  from jsonb_object_keys(p_patch) as keys(key)
  where (to_jsonb(v_current) -> key) is distinct from (to_jsonb(v_result) -> key);

  select coalesce(jsonb_object_agg(key, to_jsonb(v_current) -> key), '{}'::jsonb)
  into v_old_values
  from unnest(v_changed_fields) as changed(key);

  select coalesce(jsonb_object_agg(key, to_jsonb(v_result) -> key), '{}'::jsonb)
  into v_new_values
  from unnest(v_changed_fields) as changed(key);

  if cardinality(v_changed_fields) > 0 then
    insert into public.product_change_log (
      product_id,
      actor_user_id,
      actor_role,
      action,
      changed_fields,
      old_values,
      new_values
    ) values (
      p_product_id,
      p_actor_user_id,
      p_actor_role,
      'update_product',
      v_changed_fields,
      v_old_values,
      v_new_values
    );
  end if;

  return v_result;
end;
$$;

revoke all on function public.product_staff_apply_product_update_v1(uuid, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.product_staff_apply_product_update_v1(uuid, uuid, text, jsonb)
  to service_role;

comment on function public.product_staff_apply_product_update_v1(uuid, uuid, text, jsonb) is
  'Service-role-only atomic Product Staff catalogue update + audit. Browser roles cannot execute it.';
