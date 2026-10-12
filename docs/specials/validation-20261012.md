# JOKO Specials validation — 12 October 2026

Status: implementation and partial integration validation; not ready for production release.

Only temporary Supabase project `szijiljpasxddzgzckra` was changed. No production data, provider credentials, real payments or LINE audiences were used.

## Implemented

- Shared staff handover / customer receipt QR UI from the regular pickup feature branch.
- Specials initiation and receipt completion enforce verified payment, full paid amount, committed inventory, assigned desk and same-day pickup window in Postgres.
- Token hashes only; expiry capped at pickup closing time; replacement invalidates old QR; repeat confirmation is idempotent.
- Explicit staff fallback requires an audit reason. The old direct Specials pickup shortcut is disabled.
- Confirmation links use the current preview origin. Public confirmation responses exclude full customer/order records.
- Current main `e449f96556e4f820a0397b12b5cb0a2c5d93ec4d` integrated; Makers and Specials navigation coexist, including legacy six-item menus.
- Restored Specials guards after regular payment safety migration replaces payment finalization and cancellation functions.

## Dual payment rails

- New Specials default to Stripe PromptPay. Admin can select merchant PromptPay QR + EasySlip instead; regular payment settings remain separate.
- Every checkout freezes its rail. All five historical test checkouts retain EasySlip.
- Five-minute inventory holds remain in place. The bank QR may stay payable longer; late Stripe payments enter an idempotent refund workflow without reacquiring inventory. Pending refunds are not described as completed.
- Customer UI renders Stripe QR without slip upload, or merchant QR with EasySlip upload. Admin shows receiver/QR fields only for EasySlip.
- Test-project migration applied and both Stripe Edge Functions deployed. Hosted unauthenticated intent request returns 401; webhook returns 503 until sandbox secrets are configured.
- Hosted privilege checks deny Stripe finalization/refund RPC execution to browser users and allow service-role finalization.
- No real Stripe or EasySlip provider call has been verified.

## Passed

- 62 isolated foundation assertions.
- 106 isolated checkout/payment/pickup/LINE assertions, including current-main payment safety, handover and dual-rail migrations.
- 11 menu compatibility assertions.
- 35 actual Edge-handler assertions with mock auth/storage/RPC/provider adapters: successful verification, ownership failure, missing credentials, invalid uploads, expired holds, rejected slips, transport ambiguity, notification outage, LINE accepted/duplicate/429/500/400/timeout/suppression.
- 35 additional Stripe Edge assertions with the actual Stripe 22.6.0 signature implementation and isolated database/provider adapters: owner authorization, frozen rail, minimum amount, expiry, intent reuse/idempotency, invalid signatures, exact intent/currency/amount, duplicate events, late refunds and refund updates.
- Typecheck, lint (36 existing warnings, no errors) and production build.
- GitHub quality check and Cloudflare preview build for `0876d7a`.
- Hosted RLS: receipt session table enables RLS, denies browser SELECT, and allows service operations.
- Browser customer receipt page displayed JT-1010, Chocolate Cookie, quantity 1, paid total THB 40; customer confirmation succeeded. Hosted order and Specials fulfillment both became picked_up; receipt status confirmed with timestamp.

Staff initiation for JT-1010 was exercised through the service RPC, not an authenticated staff Edge request. Its payment was simulated through the verification RPC, not a real slip/provider.

The user completed the full staff → QR → customer receipt flow for JT-1011. Hosted verification confirms order and Specials fulfillment `picked_up`, receipt `confirmed`, and customer confirmation at `2026-10-12T10:40:09.155049Z`. Payment was simulated, not a provider payment.

## Still pending
- Authenticated payment HTTP request and provider sandbox integration.
- Real isolated LINE integration (no test channel credential configured).
- Admin page text editor save/reload and visual checks of latest Specials UI.
- Full regular-order handover regression: shared feature branch has not been released independently.
- Security advisor reports inherited baseline function exposure warnings; no claim of a clean full security audit. Receipt-session deny-all browser policy is intentional.

Preview for the initial integrated build: https://5db05192.jokotoday-preview.pages.dev/
Branch preview: https://feat-joko-specials-v1.jokotoday-preview.pages.dev/

Production merge and deployment remain pending review and explicit authorization.

## Tooling note

Automatic approval review blocked the Supabase CLI for unsolicited PostHog telemetry. No workaround was used; the migration and deployments used the Supabase connector.
