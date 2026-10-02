-- About ecosystem v1
-- Curated Gallery + external "What People Say" content, managed outside the Homepage Builder.

create table public.site_gallery_items (
  id uuid primary key default gen_random_uuid(),
  site_key text not null references public.platform_sites(site_key) on delete cascade,
  media_type text not null default 'image',
  media_url text not null,
  thumbnail_url text null,
  category text not null default 'around-joko',
  title_en text null,
  title_th text null,
  title_zh text null,
  caption_en text null,
  caption_th text null,
  caption_zh text null,
  alt_en text null,
  alt_th text null,
  alt_zh text null,
  sort_order integer not null default 0,
  show_on_homepage boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_gallery_items_media_type_check check (media_type in ('image', 'video')),
  constraint site_gallery_items_media_url_check check (media_url ~ '^(https://|/)'),
  constraint site_gallery_items_thumbnail_url_check check (thumbnail_url is null or thumbnail_url ~ '^(https://|/)')
);

create index site_gallery_items_site_published_order_idx
  on public.site_gallery_items(site_key, is_published, sort_order, created_at desc);

create table public.site_external_mentions (
  id uuid primary key default gen_random_uuid(),
  site_key text not null references public.platform_sites(site_key) on delete cascade,
  source_type text not null,
  content_type text not null default 'review',
  author_name text null,
  title text null,
  excerpt text null,
  source_language text null,
  rating numeric(2,1) null,
  source_url text not null,
  embed_url text null,
  thumbnail_url text null,
  posted_at timestamptz null,
  sort_order integer not null default 0,
  show_on_homepage boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_external_mentions_source_type_check check (
    source_type in ('google_maps', 'tiktok', 'rednote', 'youtube', 'instagram', 'facebook', 'other')
  ),
  constraint site_external_mentions_content_type_check check (
    content_type in ('review', 'video', 'image', 'post')
  ),
  constraint site_external_mentions_rating_check check (rating is null or (rating >= 0 and rating <= 5)),
  constraint site_external_mentions_source_url_check check (source_url ~ '^https://'),
  constraint site_external_mentions_embed_url_check check (embed_url is null or embed_url ~ '^https://'),
  constraint site_external_mentions_thumbnail_url_check check (thumbnail_url is null or thumbnail_url ~ '^(https://|/)')
);

create index site_external_mentions_site_published_order_idx
  on public.site_external_mentions(site_key, is_published, sort_order, created_at desc);

create or replace function private.touch_about_editorial_updated_at_v1()
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

create trigger site_gallery_items_touch_updated_at
before update on public.site_gallery_items
for each row execute function private.touch_about_editorial_updated_at_v1();

create trigger site_external_mentions_touch_updated_at
before update on public.site_external_mentions
for each row execute function private.touch_about_editorial_updated_at_v1();

alter table public.site_gallery_items enable row level security;
alter table public.site_external_mentions enable row level security;

create policy "Public can read published gallery items"
on public.site_gallery_items
for select
to anon, authenticated
using (is_published = true);

create policy "Admins can manage gallery items"
on public.site_gallery_items
for all
to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

create policy "Public can read published external mentions"
on public.site_external_mentions
for select
to anon, authenticated
using (is_published = true);

create policy "Admins can manage external mentions"
on public.site_external_mentions
for all
to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

grant usage on schema private to authenticated;
grant execute on function private.current_user_is_admin() to authenticated;

revoke all on function private.touch_about_editorial_updated_at_v1() from public, anon, authenticated;

grant select on public.site_gallery_items to anon, authenticated;
grant insert, update, delete on public.site_gallery_items to authenticated;

grant select on public.site_external_mentions to anon, authenticated;
grant insert, update, delete on public.site_external_mentions to authenticated;

comment on table public.site_gallery_items is
  'Curated host-owned gallery media. Admin-managed independently from the Homepage Builder.';
comment on table public.site_external_mentions is
  'Curated third-party reviews, posts and video references shown in What People Say.';
