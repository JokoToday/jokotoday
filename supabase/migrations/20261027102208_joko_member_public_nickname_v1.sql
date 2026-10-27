-- Existing real names remain in user_profiles.name and are never public identifiers.
-- Nullable for legacy accounts; newly completed profiles must set both fields.
alter table public.user_profiles add column if not exists public_nickname text;
alter table public.user_profiles add constraint public_nickname_format check (public_nickname is null or (length(public_nickname) between 3 and 30 and public_nickname ~ '^[A-Za-z0-9_]+$'));
create unique index if not exists user_profiles_public_nickname_unique on public.user_profiles (lower(public_nickname)) where public_nickname is not null;
-- A public profile read API must explicitly allowlist nickname only; do not expose user_profiles directly.
