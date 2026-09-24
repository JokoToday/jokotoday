# Supabase Cached-Egress Hardening

Status: active production rule
Incident window reviewed: 2026-08-26 through 2026-09-24
Production project: JOKO Today

## Incident summary

The September 2026 Free-plan restriction was caused by cached Supabase Storage egress, not database size or ordinary API traffic.

Log reconstruction identified two permanent website assets as the dominant source:

- assets/hero/joko-bakery-hero.png — about 1.93 MB per full response
- assets/logos/joko-today-logo.png — about 1.07 MB per full response

Together their CDN cache-hit responses reconstruct approximately the 8.23 GB cached-egress figure shown in the Supabase usage dashboard.

The dominant request referrer was a browser-hosted WebContainer URL under local-credentialless.webcontainer-api.io. Normal joko.today traffic and Cloudflare preview traffic were small by comparison.

## Permanent asset policy

Permanent website UI assets must be deployed with the frontend and served from joko.today.

Examples:

- homepage artwork
- logos
- decorative illustrations
- social-card images
- icons and static brand graphics

Supabase Storage remains appropriate for media that is genuinely dynamic or user/admin generated, including:

- product images managed as catalogue content
- profile pictures
- QR or generated customer assets where applicable
- future CMS uploads that must change without a frontend release

Do not use Supabase Storage merely as a CDN for permanent site chrome.

## Current canonical assets

- Bakery hero: /assets/home-experience/joko-bakery-full-v2.webp — about 97 KB
- JOKO logo: /assets/brand/joko-today-logo-v0.4.webp — about 5 KB

src/lib/staticAssetPolicy.ts is the compatibility boundary for stale CMS values that may still point at retired Supabase Storage objects.

## CI safeguard

Run:

    npm run audit:static-assets

The Frontend Quality workflow runs this automatically on pull requests to main.

The audit rejects:

- hard-coded public Supabase Storage URLs for assets in active frontend/public/seed sources
- permanent hero or logo assets routed through getPublicImageUrl()
- a missing canonical hero/logo
- a canonical hero above 500 KB or canonical logo above 100 KB

Dynamic product/profile Storage usage is intentionally not prohibited.

## Egress health check

During routine production health checks, review Organization -> Usage -> Egress in Supabase.

Investigate promptly when either condition is true:

- cached egress grows by more than roughly 100 MB in a day without an expected media event
- a permanent site asset appears repeatedly in Storage edge logs

For a deeper incident check, group Supabase edge logs by request path, CDN cache status, response content length, referrer, and user agent.

A repeated large HIT response is still cached egress; CDN cache hits reduce origin work but do not eliminate delivered bandwidth.

## WebContainer / Bolt finding

Repository inspection found no current StackBlitz/WebContainer runtime dependency, preview workflow, webcontainer-api reference, local-credentialless reference, cron job, or JOKO server process that continuously reloads the application.

The repository does still contain a .bolt directory with the original bolt-vite-react-ts template metadata and design prompt. That folder is historical authoring metadata; it does not define a runtime process or background preview job.

The GitHub automation in this repository is the normal Frontend Quality workflow plus Cloudflare Pages preview integration. There is no repository-side job that should continuously load Supabase Storage assets.

The historical Supabase request logs instead show browser referrers under local-credentialless.webcontainer-api.io.

This is consistent with an old browser-hosted development preview/session repeatedly reloading the application. Because the source is outside this repository, the exact old browser tab/workspace cannot be closed from the production server.

Action for maintainers:

1. Close obsolete Bolt/StackBlitz/WebContainer preview tabs/workspaces.
2. Prefer GitHub PR -> Cloudflare Pages preview for JOKO frontend review.
3. Do not point experimental browser previews at production Supabase Storage for permanent UI artwork.
4. If a browser-based dev environment is used again, verify Network activity does not repeatedly fetch production Storage assets while idle.

## After the Supabase quota resets

Do these checks before considering the incident closed:

1. Verify public REST, Auth, Storage, and required RPCs recover from HTTP 402.
2. In Admin/CMS, replace or remove cms_settings.hero_image_url if it still contains the retired Supabase Storage URL. If retained, use /assets/home-experience/joko-bakery-full-v2.webp. The frontend compatibility guard already prevents the stale Storage value from causing image egress.
3. Observe cached egress for at least one normal operating day.
4. Confirm the retired hero/logo objects no longer receive legitimate requests.
5. Only then consider deleting the obsolete Storage objects.

Do not delete the old Storage objects before dependency removal and verification are complete.
