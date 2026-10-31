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

The catalog reuses existing gallery permissions and storage. Episode hearts add the dedicated smile_episode_likes table and aggregate API described below; individual liker identities remain private. No public profile API is added. The page explicitly filters site key, category, media type and published status. Direct videos load only when selected; YouTube uses the privacy-enhanced embed host after a watch action. Other providers open in a new tab. No background autoplay.

## Navigation and validation

JOKO SMILE is available in Explore on desktop/mobile and the legacy header. Existing customized menu labels, visibility and order are retained. Homepage Builder can hide/relabel the new destination as usual.

Run npm run audit:smile, npm run typecheck, npm run build and npm run audit:tailwind-compat. The focused catalog/navigation checks are also part of CI.

Production publication is a separate merge/deployment decision.


## Sample catalog and likes (October 30)
- Open `/smile?sample=1` for six clearly labeled design examples. Titles, dates, artwork and counts are mock data, never written to Supabase. No fake finished videos. Demo hearts are session-only and never go to My Favorites.
- Date month filter, newest/oldest date sort and most-liked sort apply together with search. Dates currently use CMS created_at (publication-date editing is not added).
- Published episode hearts require sign-in, persist in smile_episode_likes, and appear under My Favorites → JOKO SMILE. Unliking removes the favorite. Only currently published JOKO SMILE videos are displayed.
- Apply the reviewed migration before enabling persistent likes. If absent, totals display a dash and a retryable error; no successful save is claimed.
- Public totals contain only episode IDs and counts. Individual likes are owner-only under RLS, with one like per user/episode. No UPDATE grant. Insert checks the published episode scope. Aggregate definer is in a non-exposed schema with a fixed search_path and no identity output.
- No production migration has been applied by this change. Before production release: test database migration, two-account RLS/duplicate/unpublish checks, authenticated like → refresh → My Favorites → unlike roundtrip.
- Rollback frontend first; retain likes table for recovery. No existing product/recipe/creator favorites schema or rows are changed.

Validation: migration and two-account RLS checks passed in a disposable local Postgres database (removed after test). Re-run with `bash scripts/test-smile-likes-rls.sh`. The migration is also applied to JOKO Specials Test (szijiljpasxddzgzckra). Live authenticated API tests passed with disposable accounts: like, duplicate no-op, public count, cross-account isolation, new-session persistence, Favorites episode resolution, unlike and unpublished protection. Fixtures were removed. No new SMILE security-advisor findings. Production schema remains unchanged. A manual signed-in browser check with a finished episode is still recommended before launch; API persistence has been verified.


## Live test and release status
Run `node scripts/test-smile-likes-live.mjs` from nerd-server to repeat the isolated hosted API test. The script is pinned to the test project, reads existing management credentials in memory, creates random disposable fixture IDs, and removes only its own fixtures. It must not be repointed at production.

The approved vintage filmstrip artwork wraps the real feature screen. Its static cookie and wording were removed with ImageGen; the real episode poster/play controls and translated ticket wording render separately. The optimized asset is `public/assets/smile/film-frame-vintage.webp` (86 KB). Headline: “A little moment.” / “A little smile.”

Before release: apply the reviewed migration to production with authorization, merge PR #329, deploy the immutable release and verify `/smile` plus My Favorites. No finished episode is seeded by this PR. Keep sample-mode likes isolated from real accounts.


## Clean filmstrip frame (October 31)
The featured poster now sits inside a responsive charcoal CSS frame, with vertical side perforations and no antique texture or ticket. The poster uses contain fitting inside a 16:9 aperture, so opening artwork is not cropped (other aspect ratios are letterboxed). The 44 px play button is smaller while retaining a touch target of at least 44 px.

The frame is webpage decoration, not part of the video file. Direct-file and YouTube watch actions still open the existing unframed dialog player; external video sites open separately. Opening/end cards remain part of the supplied film. Set the episode poster in Admin to use the approved opening artwork; this frontend change does not publish or modify episode records.
