-- Phase 2 security hardening: protect user_profiles.role

-- New profiles must default to customer, never staff.
ALTER TABLE public.user_profiles
  ALTER COLUMN role SET DEFAULT 'customer'::user_role;

-- Browser sessions must not be able to update privileged identity fields.
REVOKE UPDATE ON public.user_profiles FROM anon;
REVOKE UPDATE ON public.user_profiles FROM authenticated;

GRANT UPDATE (
  name,
  phone,
  line_id,
  whatsapp,
  wechat_id,
  profile_completed,
  updated_at,
  qr_token,
  profile_picture_url,
  short_code,
  email,
  preferred_language
)
ON public.user_profiles
TO authenticated;

-- Replace the existing insert policy with one that permits only
-- creation of the caller's own CUSTOMER profile.
DROP POLICY IF EXISTS "Users can insert own profile"
ON public.user_profiles;

CREATE POLICY "Users can insert own customer profile"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id
  AND role = 'customer'::user_role
);
