-- Page Accents: Homepage Hero illustration v1
-- Adds one independently managed transparent Hero illustration to the Homepage.
-- Ordinary pages keep the existing one-accent-per-page rule.

alter table public.site_joko_notes
  drop constraint if exists site_joko_notes_accent_type_check;

alter table public.site_joko_notes
  add constraint site_joko_notes_accent_type_check
    check (accent_type in ('note', 'bubble', 'illustration'));

alter table public.site_joko_notes
  drop constraint if exists site_joko_notes_registered_safe_zone_check;

alter table public.site_joko_notes
  add constraint site_joko_notes_registered_safe_zone_check
    check (
      (
        accent_type = 'note'
        and (
          (page_key = 'products' and placement_key in ('below-browse-controls', 'below-categories', 'after-catalogue'))
          or
          (page_key = 'how-it-works' and placement_key in ('intro', 'after-steps', 'before-start-ordering'))
          or
          (page_key = 'about' and placement_key in ('intro', 'after-story', 'before-pickup'))
        )
      )
      or
      (
        accent_type = 'bubble'
        and (
          (page_key = 'products' and placement_key = 'header-center')
          or
          (page_key = 'home' and placement_key = 'before-about')
        )
      )
      or
      (
        accent_type = 'illustration'
        and page_key = 'home'
        and placement_key = 'hero-primary-cta'
      )
    );

alter table public.site_joko_notes
  drop constraint if exists site_joko_notes_inactive_accent_fields_check;

alter table public.site_joko_notes
  add constraint site_joko_notes_inactive_accent_fields_check
    check (
      (
        accent_type = 'note'
        and bubble_image_url is null
        and bubble_alt is null
      )
      or
      (
        accent_type = 'bubble'
        and title_en is null
        and title_th is null
        and title_zh is null
        and body_en is null
        and body_th is null
        and body_zh is null
        and image_url is null
        and image_alt_en is null
        and image_alt_th is null
        and image_alt_zh is null
      )
      or
      (
        accent_type = 'illustration'
        and title_en is null
        and title_th is null
        and title_zh is null
        and body_en is null
        and body_th is null
        and body_zh is null
        and bubble_image_url is null
        and bubble_alt is null
        and link_url is null
      )
    );

alter table public.site_joko_notes
  add constraint site_joko_notes_illustration_image_required_check
    check (accent_type <> 'illustration' or image_url is not null);

alter table public.site_joko_notes
  drop constraint if exists site_joko_notes_one_per_page;

create unique index if not exists site_joko_notes_one_per_non_home_page_idx
  on public.site_joko_notes(site_key, page_key)
  where page_key <> 'home';

create unique index if not exists site_joko_notes_one_per_home_accent_type_idx
  on public.site_joko_notes(site_key, page_key, accent_type)
  where page_key = 'home';

comment on column public.site_joko_notes.accent_type is
  'Page Accent type: localized note, illustrated bubble, or design-controlled transparent illustration. Homepage bubble and Hero illustration may coexist in separate registered safe zones.';

comment on column public.site_joko_notes.bubble_size is
  'Responsive size preset for image-based Page Accents. Used by bubbles and Hero illustrations; ignored by note accents.';

comment on table public.site_joko_notes is
  'Page Accents for JOKO TODAY. Ordinary pages keep one accent row. Homepage may keep independent lower-page bubble and Hero illustration rows, separate from the Builder-owned Hero notebook note.';
