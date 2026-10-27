-- Prepared production change: execute as a recorded migration only after
-- reviewing the target schema and migration history. Existing owner-scoped
-- RLS policies remain in force; no table-wide UPDATE privilege is granted.
grant update (public_nickname, default_delivery_address)
  on table public.user_profiles to authenticated;
