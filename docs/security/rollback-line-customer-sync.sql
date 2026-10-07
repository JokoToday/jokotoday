-- Restore legacy customer sync only if LINE rollout is rolled back.
-- Backed up from production before the 2026-10-07 LINE sync update.
CREATE OR REPLACE FUNCTION public.sync_completed_user_profile_to_customer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
