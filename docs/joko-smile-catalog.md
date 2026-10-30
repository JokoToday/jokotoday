# JOKO SMILE episode catalog

Public page: /smile. Editorial workspace: /admin/smile.

JOKO SMILE is the final public name. The supplied stacked logo is preserved as an optimized transparent WebP. The page shares the existing turquoise JOKO shell and public navigation, with warm cream, orange and pale green episode surfaces.

## Add an episode

1. Open Admin → JOKO SMILE.
2. Paste the finished video's HTTPS MP4/WebM URL or a YouTube URL. Other HTTPS video-site URLs open externally.
3. Upload a JPG/PNG/WebP poster, or enter its URL. The upload only changes the poster, not the video URL.
4. Enter the episode code and title (e.g. JS 001 — That's How the Cookie Rolls), caption and accessible visual description in EN/TH/ZH. Missing translations fall back to English.
5. Keep Published unchecked while reviewing. Check Published only for approved finished films, then save.
6. The lowest sort order is featured; ties use newest creation first. The archive can be searched and sorted by creation date.

Video files are hosted separately; this initial editor supports video URLs, not video-file uploads. No episode or test animation is automatically published. The catalog deliberately has an empty/coming-soon state until the first film is published.

## Existing infrastructure

The editor reuses site_gallery_items with category joko-smile and media_type video. Existing admin-only writes and published-only public RLS remain unchanged. SMILE records are separated from the general Gallery and its homepage selection.

There is no new table, migration, permission grant, storage policy or public profile API. No account data is used. The page explicitly filters site key, category, media type and published status. Direct videos load only when selected; YouTube uses the privacy-enhanced embed host after a watch action. Other providers open in a new tab. No background autoplay.

## Navigation and validation

JOKO SMILE is available in Explore on desktop/mobile and the legacy header. Existing customized menu labels, visibility and order are retained. Homepage Builder can hide/relabel the new destination as usual.

Run npm run audit:smile, npm run typecheck, npm run build and npm run audit:tailwind-compat. The focused catalog/navigation checks are also part of CI.

Production publication is a separate merge/deployment decision.
