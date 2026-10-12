# JOKO Specials validation — 12 October 2026

Status: implementation and partial integration validation; not ready for production release.

Only temporary Supabase project `szijiljpasxddzgzckra` was changed. No production data, provider credentials, real payments or LINE audiences were used.

## Implemented

- Shared staff handover / customer receipt QR UI from the regular pickup feature branch.
- Specials initiation and receipt completion enforce verified payment, full paid amount, committed inventory, assigned desk and same-day pickup window in Postgres.
- Token hashes only; expiry capped at pickup closing time; replacement invalidates old QR; repeat confirmation is idempotent.
- Explicit staff fallback requires an audit reason. The old direct Specials pickup shortcut is disabled.
- Confirmation links use the current preview origin. Public confirmation responses exclude full customer/order records.
- Current main `c56046b` integrated; Makers and Specials navigation coexist, including legacy six-item menus.
- Restored Specials guards after regular payment safety migration replaces payment finalization and cancellation functions.

## Passed

- 62 isolated foundation assertions.
- 92 isolated checkout/payment/pickup/LINE assertions, including real current-main payment safety migration and new handover migrations.
- 11 menu compatibility assertions.
- 35 actual Edge-handler assertions with mock auth/storage/RPC/provider adapters: successful verification, ownership failure, missing credentials, invalid uploads, expired holds, rejected slips, transport ambiguity, notification outage, LINE accepted/duplicate/429/500/400/timeout/suppression.
- Typecheck, lint (existing warnings) and production build.
- GitHub quality check and Cloudflare preview build for `0876d7a`.
- Hosted RLS: receipt session table enables RLS, denies browser SELECT, and allows service operations.
- Browser customer receipt page displayed JT-1010, Chocolate Cookie, quantity 1, paid total THB 40; customer confirmation succeeded. Hosted order and Specials fulfillment both became picked_up; receipt status confirmed with timestamp.

Staff initiation for JT-1010 was exercised through the service RPC, not an authenticated staff Edge request. Its payment was simulated through the verification RPC, not a real slip/provider.

## Still pending

- Authenticated staff browser QR initiation and polling; fresh simulated paid order JT-1011 is ready in the test project.
- Authenticated payment HTTP request and provider sandbox integration.
- Real isolated LINE integration (no test channel credential configured).
- Admin page text editor save/reload and visual checks of latest Specials UI.
- Full regular-order handover regression: shared feature branch has not been released independently.
- Security advisor reports inherited baseline function exposure warnings; no claim of a clean full security audit. Receipt-session deny-all browser policy is intentional.

Preview for the initial integrated build: https://5db05192.jokotoday-preview.pages.dev/
Branch preview: https://feat-joko-specials-v1.jokotoday-preview.pages.dev/

Production merge and deployment remain pending review and explicit authorization.
