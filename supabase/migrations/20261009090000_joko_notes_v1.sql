-- JOKO Notes v1
-- Reusable, localized editorial notebook notes placed in controlled slots across JOKO TODAY.
-- The Homepage Hero note remains Builder-owned for now; this table powers site-wide notes outside the Hero.

create table public.site_joko_notes (
  id uuid primary key default gen_random_uuid(),
  site_key text not null references public.platform_sites(site_key) on delete cascade,
  page_key text not null,
  placement_key text not null,
  title_en text null,
  title_th text null,
  title_zh text null,
  body_en text null,
  body_th text null,
  body_zh text null,
  image_url text null,
  image_alt_en text null,
  image_alt_th text null,
  image_alt_zh text null,
  link_url text null,
  font_preset text not null default 'handwritten',
  heading_size integer not null default 22,
  body_size integer not null default 14,
  rotation integer not null default 2,
  image_layout text not null default 'stacked',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint site_joko_notes_page_key_check
    check (page_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint site_joko_notes_placement_key_check
    check (placement_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint site_joko_notes_one_per_page unique (site_key, page_key),

  constraint site_joko_notes_title_en_length_check check (title_en is null or length(title_en) <= 120),
  constraint site_joko_notes_title_th_length_check check (title_th is null or length(title_th) <= 180),
  constraint site_joko_notes_title_zh_length_check check (title_zh is null or length(title_zh) <= 120),
  constraint site_joko_notes_body_en_length_check check (body_en is null or length(body_en) <= 700),
  constraint site_joko_notes_body_th_length_check check (body_th is null or length(body_th) <= 900),
  constraint site_joko_notes_body_zh_length_check check (body_zh is null or length(body_zh) <= 700),

  constraint site_joko_notes_image_url_check
    check (image_url is null or image_url ~ '^(https://|/)'),
  constraint site_joko_notes_link_url_check
    check (link_url is null or link_url ~ '^(https://|/|#)'),

  constraint site_joko_notes_font_preset_check
    check (font_preset in ('handwritten', 'display', 'body')),
  constraint site_joko_notes_heading_size_check
    check (heading_size between 16 and 32),
  constraint site_joko_notes_body_size_check
    check (body_size between 11 and 20),
  constraint site_joko_notes_rotation_check
    check (rotation between -6 and 6),
  constraint site_joko_notes_image_layout_check
    check (image_layout in ('stacked', 'portrait', 'tiny-sketch'))
);

create index site_joko_notes_public_lookup_idx
  on public.site_joko_notes(site_key, page_key, placement_key, is_published);

create or replace function private.touch_site_joko_notes_updated_at_v1()
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

create trigger site_joko_notes_touch_updated_at
before update on public.site_joko_notes
for each row execute function private.touch_site_joko_notes_updated_at_v1();

alter table public.site_joko_notes enable row level security;

create policy "Public can read published JOKO notes"
on public.site_joko_notes
for select
to anon, authenticated
using (is_published = true);

create policy "Admins can manage JOKO notes"
on public.site_joko_notes
for all
to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

grant select on public.site_joko_notes to anon, authenticated;
grant insert, update, delete on public.site_joko_notes to authenticated;

revoke all on function private.touch_site_joko_notes_updated_at_v1() from public, anon, authenticated;

comment on table public.site_joko_notes is
  'Localized JOKO Notes editorial cards. One row per controlled page placement; public readers only see published notes.';

-- Seed one safe, unpublished starter draft so Admin immediately demonstrates the system
-- without changing public content when the migration is applied.
insert into public.site_joko_notes (
  site_key,
  page_key,
  placement_key,
  title_en,
  title_th,
  title_zh,
  body_en,
  body_th,
  body_zh,
  link_url,
  font_preset,
  heading_size,
  body_size,
  rotation,
  image_layout,
  is_published
)
select
  ps.site_key,
  'how-it-works',
  'intro',
  'A little note from JOKO',
  'โน้ตเล็ก ๆ จาก JOKO',
  '来自 JOKO 的小纸条',
  'Order first. We’ll get the oven ready.',
  'สั่งไว้ก่อน แล้วเราจะเตรียมเตาอบให้พร้อม',
  '先下单，我们会把烤箱准备好。',
  '/products',
  'handwritten',
  22,
  14,
  2,
  'stacked',
  false
from public.platform_sites ps
where ps.site_key = 'joko-today'
on conflict (site_key, page_key) do nothing;
