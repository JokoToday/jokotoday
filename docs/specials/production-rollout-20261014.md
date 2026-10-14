# JOKO Specials: proposed production rollout, 14 October 2026

Status: prepared; production rollout not authorized or performed. PR #236 merged at e75a88b; deployment remains blocked by follow-up review findings.
Scope: Stripe PromptPay, Specials Selection administration in English/Thai, discounted catalogue cards, counted surplus inventory, and receipt-confirmed pickup. EasySlip and Specials LINE broadcasts stay off. Preserve separately approved transactional notification controls.

## Evidence and remaining gates

Final review against origin/main 773b22d (PR #285) completed on 14 October. Main was merged into the Specials branch without conflicts; current profile feedback, canonical LINE handling, receipt notification pause gates and service-role-only legacy notification gate are retained.

PASS: hosted English/Thai Specials Admin save, publish, stock and responsive 320/390-pixel rendering. PASS: regular sandbox prepaid order JT-1020, 90 THB, signed Stripe payment verification, Admin acting through Staff Operations with member-code fallback, early-pickup confirmation, dynamic one-time receipt QR and customer confirmation; final order completed/paid, receipt JTR-JT-1020. No real money or physical goods moved; camera hardware was not tested.

PASS: canceled late-payment Specials order JT-1018, 110 THB. Customer completed Stripe's sandbox bank-details form using dummy values. Stripe refund pyr_1UQJKU0s1xeShuffb6ANWH3x reports succeeded; JOKO automatically reconciled financial_state=refunded and inventory_state=released. No duplicate refund or manual success override.

Fresh combined-branch validation: 319 focused Specials assertions across foundation, checkout/payment/pickup, real-SDK webhook signatures, isolated Edge adapters, menu/origin, receipt compatibility and refund retry boundaries. Notification SQL and Edge suites passed, including current pause gates and Specials payment/refund guards. Typecheck/build passed; lint has 0 errors and 36 existing warnings. LINE auth/onboarding and Tailwind compatibility audits passed.

Read-only production preflight: Specials is absent; notification recipient resolver and legacy channel pause gate exist. Global/email/LINE notification controls are all paused. Production migration history records notification preferences under runtime version 20261014112740 and profile copy under 20261014114500; check function/schema presence rather than pushing branch history. Production frontend observed at release 20261014-185607-6d44788598f1 (PR #284), behind reviewed main PR #285. Refresh these observations immediately before rollout; preserve any independently approved newer deployment or notification controls.

Remaining execution gates: explicit approval for this production rollout, fresh backup and exact merged-SHA lock, then production smoke verification. Physical phone camera and live bank-app payment remain launch validation, not completed sandbox checks. Stripe email branding/languages are deferred separately by the owner.

## Reviewed package

- supabase/operations/specials-production-rollout-20261014.sql: atomic 11-migration bundle, individual history entries, aborts if Specials already exists or either current-main notification recipient resolver or legacy channel pause gate is absent.
- docs/specials/production-release-manifest-20261014.json: exact migration/endpoint/shared-source hashes, reviewed main revision, ten endpoint names and JWT settings, and required database function signatures.
- scripts/prepare-specials-release.py: regenerates the bundle without contacting any database.
- /home/nerd/jokotoday-deploy-main.pr236.sh: server deployment template. EXPECTED_SHA is deliberately unset until an approved merge supplies an exact revision.
- Temporary responsive test page removed from the release.

No test products, orders, customers, inventory, SMTP keys or Stripe keys are copied to production.

## One proposed rollout

1. Refresh main, production revision, migration history and notification controls immediately before approval. This package is reviewed against 773b22d; if main changes, integrate/review its relevant changes and regenerate the manifest before executing. Require both notification recipient resolver and legacy channel pause gate. Do not db push the entire branch.
2. After explicit production approval, record a fresh production database backup and the current release path; export the deployed shared Stripe Edge Function sources/configuration for rollback. Confirm the backup is restorable and record its location privately.
3. Merge the reviewed PR and lock its exact merge SHA in the deployment template. Regenerate/review the manifest if main or release files changed; stop if deployed prerequisites differ.
4. Apply only the reviewed atomic SQL bundle to production project xvhualoeboobulwgmkla. Verify every history entry, RLS/grants, service-only financial functions and notification/refund guards. Leave Specials payment enabled=false and payment mode stripe_promptpay.
5. Deploy exactly the ten manifest endpoints with their listed JWT settings. Preserve regular receipt endpoints. Use existing production Stripe credentials; confirm the live account and signed webhook/refund events. Keep SPECIALS_LINE_ENABLED=false, VITE_SPECIALS_LINE_ENABLED=false and VITE_SPECIALS_EASYSLIP_ENABLED=false. No test credential migration.
6. Build/deploy the locked revision using the server template. Verify release symlink/revision and HTTPS. Smoke regular sign-in/profile/menu/checkout/pickup, unauthenticated denials, signed webhook handling, English/Thai Specials Admin and empty Specials customer page. Do not publish invented stock.
7. Once these checks pass, enable Specials Stripe payments through Admin. The owner counts real surplus, chooses catalogue products and prices, and publishes the first real Specials Selection. Obtain a specific amount/payment authorization before a live paid smoke test; then verify ledger, inventory and customer/staff handover.
8. Record deployed revision, verified results, migration/endpoint versions and notification controls. Monitor holds, webhook errors, refund_pending and pickup outcomes.

## Rollback

Before any paid Specials order exists: disable Specials payments, restore the previously compatible frontend and saved Edge Functions, and verify regular ordering. Preserve the migration history and ledger tables rather than dropping them.
After a paid Specials order exists: disable new Specials sales, retain fulfillment and refund processing, reconcile outstanding orders/holds/refunds, and choose a compatible frontend rollback. Never blindly remove Specials pickup or financial handling. Do not reset independent transactional notification activation.

## Payment-email review follow-up

The follow-up fixes send-payment-confirmation: one full order projection retains Specials pickup snapshot, location and items; removes duplicate amount/date declarations; renders immutable Specials window and location in EN/TH/ZH while preserving regular totals and ownership/pause/unpaid guards. The actual-handler regression runs in CI with isolated adapters, without email sends. This endpoint is now explicitly included in the deployment manifest with verify_jwt=true. Back up its existing production bundle before deployment. Remaining handover schema and Stripe parameter review findings must be resolved before executing the production package. Current production frontend is independently deployed PR #286 (eba2e55); PR #285 backend sources were verified against its merge revision.
