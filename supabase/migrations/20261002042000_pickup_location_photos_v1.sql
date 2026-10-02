-- Pickup location photography v1
-- One curated wide image per pickup location, managed from Pickup Locations Admin.

alter table public.cms_pickup_locations
  add column if not exists image_url text null,
  add column if not exists image_alt_en text null,
  add column if not exists image_alt_th text null,
  add column if not exists image_alt_zh text null;

alter table public.cms_pickup_locations
  drop constraint if exists cms_pickup_locations_image_url_check;

alter table public.cms_pickup_locations
  add constraint cms_pickup_locations_image_url_check
  check (image_url is null or image_url ~ '^(https://|/)');

comment on column public.cms_pickup_locations.image_url is
  'Single curated public photograph for the pickup location, displayed below its pickup schedule.';
comment on column public.cms_pickup_locations.image_alt_en is
  'English alternative text for the pickup location photograph.';
comment on column public.cms_pickup_locations.image_alt_th is
  'Thai alternative text for the pickup location photograph.';
comment on column public.cms_pickup_locations.image_alt_zh is
  'Simplified Chinese alternative text for the pickup location photograph.';
