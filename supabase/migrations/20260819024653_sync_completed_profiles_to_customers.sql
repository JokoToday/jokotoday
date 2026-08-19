CREATE OR REPLACE FUNCTION public.sync_completed_user_profile_to_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'customer'::user_role
     AND COALESCE(NEW.profile_completed, false) = true
     AND btrim(COALESCE(NEW.email, '')) <> ''
     AND btrim(COALESCE(NEW.name, '')) <> ''
     AND btrim(COALESCE(NEW.phone, '')) <> ''
     AND (
       btrim(COALESCE(NEW.line_id, '')) <> ''
       OR btrim(COALESCE(NEW.whatsapp, '')) <> ''
       OR btrim(COALESCE(NEW.wechat_id, '')) <> ''
     ) THEN
    INSERT INTO public.customers (
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
    VALUES (
      NEW.id,
      NEW.email,
      NEW.name,
      NEW.phone,
      NULLIF(btrim(COALESCE(NEW.line_id, '')), ''),
      NULLIF(btrim(COALESCE(NEW.whatsapp, '')), ''),
      NULLIF(btrim(COALESCE(NEW.wechat_id, '')), ''),
      NEW.qr_token,
      NEW.short_code
    )
    ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      phone = EXCLUDED.phone,
      line_id = EXCLUDED.line_id,
      whatsapp = EXCLUDED.whatsapp,
      wechat_id = EXCLUDED.wechat_id,
      qr_token = EXCLUDED.qr_token,
      short_code = EXCLUDED.short_code;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_completed_user_profile_to_customer() FROM PUBLIC;

DROP TRIGGER IF EXISTS sync_completed_user_profile_to_customer_on_write ON public.user_profiles;

CREATE TRIGGER sync_completed_user_profile_to_customer_on_write
  AFTER INSERT OR UPDATE OF email, name, phone, line_id, whatsapp, wechat_id, qr_token, short_code, role, profile_completed
  ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_completed_user_profile_to_customer();

INSERT INTO public.customers (
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
SELECT
  up.id,
  up.email,
  up.name,
  up.phone,
  NULLIF(btrim(COALESCE(up.line_id, '')), ''),
  NULLIF(btrim(COALESCE(up.whatsapp, '')), ''),
  NULLIF(btrim(COALESCE(up.wechat_id, '')), ''),
  up.qr_token,
  up.short_code
FROM public.user_profiles up
LEFT JOIN public.customers c ON c.id = up.id
WHERE c.id IS NULL
  AND up.role = 'customer'::user_role
  AND COALESCE(up.profile_completed, false) = true
  AND btrim(COALESCE(up.email, '')) <> ''
  AND btrim(COALESCE(up.name, '')) <> ''
  AND btrim(COALESCE(up.phone, '')) <> ''
  AND (
    btrim(COALESCE(up.line_id, '')) <> ''
    OR btrim(COALESCE(up.whatsapp, '')) <> ''
    OR btrim(COALESCE(up.wechat_id, '')) <> ''
  );
