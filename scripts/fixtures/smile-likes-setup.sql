\set ON_ERROR_STOP on
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
create table public.site_gallery_items(id uuid primary key, site_key text, category text, media_type text, is_published boolean);
alter table public.site_gallery_items enable row level security;
create policy published on public.site_gallery_items for select to anon, authenticated using(is_published);
grant select on public.site_gallery_items to anon, authenticated;
insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
insert into public.site_gallery_items values
('10000000-0000-0000-0000-000000000001','joko-today','joko-smile','video',true),
('10000000-0000-0000-0000-000000000002','joko-today','joko-smile','video',false),
('10000000-0000-0000-0000-000000000003','other-site','joko-smile','video',true),
('10000000-0000-0000-0000-000000000004','joko-today','bakery','image',true);
