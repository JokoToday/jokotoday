-- Page Accents v1
-- Extends JOKO Notes so each registered page can have exactly one editorial accent:
-- either a localized JOKO Note or a single-language illustrated brand bubble.

alter table public.site_joko_notes
  add column accent_type text not null default 'note',
  add column bubble_size text not null default 'medium',
  add column bubble_image_url text null,
  add column bubble_alt text null;

alter table public.site_joko_notes
  add constraint site_joko_notes_accent_type_check
    check (accent_type in ('note', 'bubble')),
  add constraint site_joko_notes_bubble_size_check
    check (bubble_size in ('small', 'medium', 'large')),
  add constraint site_joko_notes_bubble_image_url_check
    check (bubble_image_url is null or bubble_image_url ~ '^(https://|/)'),
  add constraint site_joko_notes_bubble_alt_length_check
    check (bubble_alt is null or length(bubble_alt) <= 180);

alter table public.site_joko_notes
  drop constraint site_joko_notes_registered_safe_zone_check;

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
    );

alter table public.site_joko_notes
  add constraint site_joko_notes_bubble_image_required_check
    check (accent_type <> 'bubble' or bubble_image_url is not null),
  add constraint site_joko_notes_bubble_alt_required_check
    check (accent_type <> 'bubble' or (bubble_alt is not null and btrim(bubble_alt) <> '')),
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
    );

comment on column public.site_joko_notes.accent_type is
  'Editorial accent type. Exactly one row per page means a page can show either a JOKO Note or a brand bubble, never both.';

comment on column public.site_joko_notes.bubble_size is
  'Responsive presentation preset for illustrated bubble accents. Ignored for note accents.';

comment on column public.site_joko_notes.bubble_image_url is
  'Single-language illustrated speech-bubble asset. Kept separate from JOKO Note imagery.';

comment on column public.site_joko_notes.bubble_alt is
  'English accessibility label for the illustrated bubble. The bubble artwork itself is intentionally not localized.';

comment on table public.site_joko_notes is
  'Page Accents for JOKO TODAY. One row per page: either a localized JOKO Note or a single-language illustrated brand bubble placed in registered responsive safe zones.';
