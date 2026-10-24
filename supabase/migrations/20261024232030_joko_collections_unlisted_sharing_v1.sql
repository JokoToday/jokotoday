-- Phase 2, unlisted links. This table is never exposed to authenticated or anon roles.
-- A share does not change collection ownership or its private RLS policies.
create table if not exists public.joko_collection_share_links (
  collection_id uuid primary key references public.joko_collections(id) on delete cascade,
  token_hash text not null unique check (length(token_hash) = 64),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  expires_at timestamptz,
  check (expires_at is null or expires_at > created_at)
);
alter table public.joko_collection_share_links enable row level security;
revoke all on public.joko_collection_share_links from public, anon, authenticated;
-- No RLS policies: only the Edge Function's server-side service role may access links.
-- In particular, private favorites and collections never become publicly SELECT-able.
