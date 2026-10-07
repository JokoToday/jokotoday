-- LINE v1.1: a linked LINE OAuth identity can satisfy the legacy
-- customer's one-contact requirement without inventing a public LINE ID.
-- Retains the previous constraint's manual-contact semantics, enforced by
-- a trusted trigger that checks auth.identities server-side.
-- This migration does not insert, delete, or modify existing customers.

CREATE OR REPLACE FUNCTION public.guard_customer_contact_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $guard$
BEGIN
  IF NEW.line_id IS NULL
     AND NEW.whatsapp IS NULL
     AND NEW.wechat_id IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM auth.identities i
       WHERE i.user_id = NEW.id AND i.provider = 'custom:line'
     ) THEN
    RAISE EXCEPTION 'At least one contact method or connected LINE account is required'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$guard$;

CREATE TRIGGER guard_customer_contact_auth
BEFORE INSERT OR UPDATE OF id, line_id, whatsapp, wechat_id ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.guard_customer_contact_auth();

ALTER TABLE public.customers DROP CONSTRAINT at_least_one_contact;

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
       or exists (
         select 1 from auth.identities i
         where i.user_id = new.id and i.provider = 'custom:line'
       )
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
