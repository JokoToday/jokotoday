# JOKO Specials: proposed production rollout, 14 October 2026

Status: prepared; production rollout not authorized or performed. PR #236 remains draft.
Scope: Stripe PromptPay, Specials Selection administration in English/Thai, discounted catalogue cards, counted surplus inventory, and receipt-confirmed pickup. EasySlip and Specials LINE broadcasts stay off. Preserve separately approved transactional notification controls.

## Evidence and remaining gates

Test-only customer_notification_preferences_v1 and Specials release guards applied atomically on 14 October; migration history, preference columns, service-role-only recipient resolver, paid-only Specials notification exclusion and automatic Stripe refund boundary verified. All three test notification pause flags remain true.
Notification preferences/claims/security SQL suite passed; 106 checkout/payment/pickup/LINE assertions passed. Earlier foundation, endpoint, SDK, receipt, retry-auth and pickup-window suites passed. Typecheck/build passed; lint: 0 errors, 36 existing warnings; dependency audit: 0 vulnerabilities.
Hosted EN/Thai save/publish/stock and 320/390-pixel iframe rendering were verified earlier. These are browser viewport checks, not a physical phone or bank-app check. Final authenticated hosted regular-checkout regression after the preferences migration remains pending because the browser session expired.
Actual cancelled test PromptPay payment JT-1018 reached refund_pending using Stripe pyr_ evidence and the original idempotency key; stock remained released. Provider refund settlement remains unproven. Do not claim it refunded until the provider reports success; customer bank details may be required.

## Reviewed package

- supabase/operations/specials-production-rollout-20261014.sql: atomic 11-migration bundle, individual history entries, aborts if Specials already exists or current-main notification recipient resolver is absent.
- docs/specials/production-release-manifest-20261014.json: exact file hashes, reviewed main revision, nine endpoint names and JWT settings.
- scripts/prepare-specials-release.py: regenerates the bundle without contacting any database.
- /home/nerd/jokotoday-deploy-main.pr236.sh: server deployment template. EXPECTED_SHA is deliberately unset until an approved merge supplies an exact revision.
- Temporary responsive test page removed from the release.

No test products, orders, customers, inventory, SMTP keys or Stripe keys are copied to production.

## One proposed rollout

1. Finish the authenticated hosted regression and resolve or explicitly accept the outstanding provider refund-settlement gate. Refresh main, production revision, migration history and notification controls immediately before approval. Independently complete the current-main notification-preferences production rollout if its resolver is absent. Do not db push the entire branch.
2. After explicit production approval, record a fresh production database backup and the current release path; export the deployed shared Stripe Edge Function sources/configuration for rollback. Confirm the backup is restorable and record its location privately.
3. Merge the reviewed PR and lock its exact merge SHA in the deployment template. Regenerate/review the manifest if main or release files changed; stop if deployed prerequisites differ.
4. Apply only the reviewed atomic SQL bundle to production project xvhualoeboobulwgmkla. Verify every history entry, RLS/grants, service-only financial functions and notification/refund guards. Leave Specials payment enabled=false and payment mode stripe_promptpay.
5. Deploy exactly the nine manifest endpoints with their listed JWT settings. Preserve regular receipt endpoints. Use existing production Stripe credentials; confirm the live account and signed webhook/refund events. Keep SPECIALS_LINE_ENABLED=false, VITE_SPECIALS_LINE_ENABLED=false and VITE_SPECIALS_EASYSLIP_ENABLED=false. No test credential migration.
6. Build/deploy the locked revision using the server template. Verify release symlink/revision and HTTPS. Smoke regular sign-in/profile/menu/checkout/pickup, unauthenticated denials, signed webhook handling, English/Thai Specials Admin and empty Specials customer page. Do not publish invented stock.
7. Once these checks pass, enable Specials Stripe payments through Admin. The owner counts real surplus, chooses catalogue products and prices, and publishes the first real Specials Selection. Obtain a specific amount/payment authorization before a live paid smoke test; then verify ledger, inventory and customer/staff handover.
8. Record deployed revision, verified results, migration/endpoint versions and notification controls. Monitor holds, webhook errors, refund_pending and pickup outcomes.

## Rollback

Before any paid Specials order exists: disable Specials payments, restore the previously compatible frontend and saved Edge Functions, and verify regular ordering. Preserve the migration history and ledger tables rather than dropping them.
After a paid Specials order exists: disable new Specials sales, retain fulfillment and refund processing, reconcile outstanding orders/holds/refunds, and choose a compatible frontend rollback. Never blindly remove Specials pickup or financial handling. Do not reset independent transactional notification activation.
