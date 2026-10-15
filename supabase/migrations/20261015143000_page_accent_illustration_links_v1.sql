-- Page Accents: clickable Hero illustrations
-- Allows the Homepage Hero illustration to carry an optional internal/external link.
-- URL format remains governed by the existing site_joko_notes_link_url_check.

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
      )
    );

comment on column public.site_joko_notes.link_url is
  'Optional click target for JOKO Notes, bubbles and Hero illustrations. Relative paths, anchors and HTTPS URLs are allowed by the existing URL constraint.';
