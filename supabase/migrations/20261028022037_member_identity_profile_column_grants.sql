-- Permit members to save the two new profile fields. Existing RLS remains
-- owner-scoped. Do not grant table-wide UPDATE or anonymous access.
grant update (public_nickname, default_delivery_address)
  on table public.user_profiles to authenticated;
