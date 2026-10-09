-- Page Accents v1
-- Extends JOKO Notes so each registered page can have exactly one editorial accent:
-- either a localized JOKO Note or a single-language illustrated brand bubble.

alter table public.site_joko_notes
  add column accent_type text not null default 'note',
  add column bubble_size text not null default 'medium';

alter table public.site_joko_notes
  add constraint site_joko_notes_accent_type_check
    check (accent_type in ('note', 'bubble')),
  add constraint site_joko_notes_bubble_size_check
    check (bubble_size in ('small', 'medium', 'large'));

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
        and page_key = 'products'
        and placement_key = 'header-center'
      )
    );

alter table public.site_joko_notes
  add constraint site_joko_notes_bubble_image_required_check
    check (accent_type <> 'bubble' or image_url is not null);

comment on column public.site_joko_notes.accent_type is
  'Editorial accent type. Exactly one row per page means a page can show either a JOKO Note or a brand bubble, never both.';

comment on column public.site_joko_notes.bubble_size is
  'Responsive presentation preset for illustrated bubble accents. Ignored for note accents.';

comment on table public.site_joko_notes is
  'Page Accents for JOKO TODAY. One row per page: either a localized JOKO Note or a single-language illustrated brand bubble placed in registered responsive safe zones.';
