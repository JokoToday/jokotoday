-- Page Accent bubble asset library v1
-- Reusable brand-bubble artwork for Page Accents.
-- Existing bubble placements are seeded into the library once so artwork already
-- uploaded before this migration immediately becomes reusable elsewhere.

create table public.site_page_accent_assets (
  id uuid primary key default gen_random_uuid(),
  site_key text not null references public.platform_sites(site_key) on delete cascade,
  asset_type text not null default 'bubble',
  name text not null,
  image_url text not null,
  alt_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint site_page_accent_assets_type_check
    check (asset_type in ('bubble')),
  constraint site_page_accent_assets_name_length_check
    check (length(btrim(name)) between 1 and 120),
  constraint site_page_accent_assets_image_url_check
    check (image_url ~ '^(https://|/)'),
  constraint site_page_accent_assets_alt_length_check
    check (length(btrim(alt_text)) between 1 and 180),
  constraint site_page_accent_assets_unique_image
    unique (site_key, image_url)
);

create index site_page_accent_assets_site_type_idx
  on public.site_page_accent_assets(site_key, asset_type, created_at desc);

create or replace function private.touch_site_page_accent_assets_updated_at_v1()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger site_page_accent_assets_touch_updated_at
before update on public.site_page_accent_assets
for each row execute function private.touch_site_page_accent_assets_updated_at_v1();

alter table public.site_page_accent_assets enable row level security;

create policy "Admins can read Page Accent assets"
on public.site_page_accent_assets
for select
to authenticated
using (private.current_user_is_admin());

create policy "Admins can manage Page Accent assets"
on public.site_page_accent_assets
for all
to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

grant select, insert, update, delete on public.site_page_accent_assets to authenticated;
revoke all on function private.touch_site_page_accent_assets_updated_at_v1() from public, anon, authenticated;

comment on table public.site_page_accent_assets is
  'Reusable admin-owned artwork library for Page Accents. Public pages continue to render the image URL stored on the accent row, so the library itself never needs public read access.';

-- Preserve and reuse any bubble artwork already uploaded before the library existed.
insert into public.site_page_accent_assets (
  site_key,
  asset_type,
  name,
  image_url,
  alt_text
)
select distinct on (site_key, bubble_image_url)
  site_key,
  'bubble',
  left(coalesce(nullif(btrim(bubble_alt), ''), 'Bubble artwork'), 120),
  bubble_image_url,
  coalesce(nullif(btrim(bubble_alt), ''), 'Bubble artwork')
from public.site_joko_notes
where accent_type = 'bubble'
  and bubble_image_url is not null
order by site_key, bubble_image_url, updated_at desc
on conflict (site_key, image_url) do nothing;
