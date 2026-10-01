/*
  Allow completed admin/staff profiles to use normal customer checkout.

  Privileged role permissions are unchanged. This only lets completed
  admin/staff profiles maintain the same legacy customers mirror row that
  checkout RPCs already require for authenticated online ordering.
*/

create or replace function public.sync_completed_user_profile_to_customer()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.role in (
       'customer'::public.user_role,
       'admin'::public.user_role,
       'staff'::public.user_role
     )
     and coalesce(new.profile_completed, false) = true
     and btrim(coalesce(new.email, '')) <> ''
     and btrim(coalesce(new.name, '')) <> ''
     and btrim(coalesce(new.phone, '')) <> ''
     and (
       btrim(coalesce(new.line_id, '')) <> ''
       or btrim(coalesce(new.whatsapp, '')) <> ''
       or btrim(coalesce(new.wechat_id, '')) <> ''
     ) then
    insert into public.customers (
      id,
      email,
      name,
      phone,
      line_id,
      whatsapp,
      wechat_id,
      qr_token,
      short_code
    )
    values (
      new.id,
      new.email,
      new.name,
      new.phone,
      nullif(btrim(coalesce(new.line_id, '')), ''),
      nullif(btrim(coalesce(new.whatsapp, '')), ''),
      nullif(btrim(coalesce(new.wechat_id, '')), ''),
      new.qr_token,
      new.short_code
    )
    on conflict (id) do update
    set
      email = excluded.email,
      name = excluded.name,
      phone = excluded.phone,
      line_id = excluded.line_id,
      whatsapp = excluded.whatsapp,
      wechat_id = excluded.wechat_id,
      qr_token = excluded.qr_token,
      short_code = excluded.short_code;
  end if;

  return new;
end;
$$;

comment on function public.sync_completed_user_profile_to_customer() is
  'Keeps completed customer, admin, and staff profiles mirrored into customers so authenticated online checkout can use the shared customer order pipeline.';

-- Backfill currently completed privileged profiles so they can order
-- immediately after the frontend role gate is removed.
insert into public.customers (
  id,
  email,
  name,
  phone,
  line_id,
  whatsapp,
  wechat_id,
  qr_token,
  short_code
)
select
  up.id,
  up.email,
  up.name,
  up.phone,
  nullif(btrim(coalesce(up.line_id, '')), ''),
  nullif(btrim(coalesce(up.whatsapp, '')), ''),
  nullif(btrim(coalesce(up.wechat_id, '')), ''),
  up.qr_token,
  up.short_code
from public.user_profiles up
where up.role in (
    'admin'::public.user_role,
    'staff'::public.user_role
  )
  and coalesce(up.profile_completed, false) = true
  and btrim(coalesce(up.email, '')) <> ''
  and btrim(coalesce(up.name, '')) <> ''
  and btrim(coalesce(up.phone, '')) <> ''
  and (
    btrim(coalesce(up.line_id, '')) <> ''
    or btrim(coalesce(up.whatsapp, '')) <> ''
    or btrim(coalesce(up.wechat_id, '')) <> ''
  )
on conflict (id) do update
set
  email = excluded.email,
  name = excluded.name,
  phone = excluded.phone,
  line_id = excluded.line_id,
  whatsapp = excluded.whatsapp,
  wechat_id = excluded.wechat_id,
  qr_token = excluded.qr_token,
  short_code = excluded.short_code;
