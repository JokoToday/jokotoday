# Specials recovery and compatibility — 13 October 2026

## Verified state

PR #236 was draft and unmerged at `88b99a2`. Latest production/main is `aceeb95`, which added a different regular-order receipt workflow. Integrating that main produced five conflicts across routing, order history, staff pickup, customer receipt UI and the shared receipt Edge endpoint.

Read-only inspection of temporary Supabase project `szijiljpasxddzgzckra` proves JT-1016 is confirmed/paid, inventory committed, financial state verified and fulfillment ready. Its Stripe `payment_intent.succeeded` webhook was received at 2026-10-13 01:57:10 UTC and processed at 01:57:13 UTC with result `specials:verified`, without an error. This is stronger evidence than the earlier stale PR notes. JT-1015/JT-1014 are cancelled with released inventory; JT-1013 expired with released inventory. No late-payment refund has yet been verified.

JT-1011 and JT-1010 remain picked up with committed inventory and verified payments; these earlier EasySlip fixtures used simulated verification. They do not prove provider-backed EasySlip integration.

## Compatibility changes

- Keep `/receive/:token` and the current main `confirm-pickup-receipt` implementation for regular orders.
- Keep Specials `/pickup/confirm/:token`, backed by a distinct `confirm-specials-pickup-receipt` endpoint. Existing Specials links remain valid.
- Staff chooses Preorders or JOKO Specials within Pickup Desk. Each loads only its order type and retains its own tested handover workflow. Specials still requires the assigned desk, verified payment, committed inventory and pickup window; early handover remains blocked.
- Reject Specials at the regular handoff-creation endpoint; reject regular orders at the older Specials handover-creation endpoint.
- Preserve current main receipt display/printing alongside Specials payment/cancellation UI in order history.
- A new post-main compatibility migration restores the Specials notification guard overwritten by the regular receipt migration and rejects Specials completion through the regular receipt RPC. Existing function privileges remain intact.

This is compatibility isolation, not a migration of Specials onto regular receipt documents. Specials acknowledgement remains its existing workflow; shared immutable receipt-document issuance is deferred.

## Validation

- TypeScript and production build pass.
- Lint: zero errors, 37 hook/dependency warnings across the merged tree.
- 62 foundation, 106 checkout/payment/pickup/LINE, 35 isolated EasySlip/LINE Edge, 45 Stripe Edge and 11 menu assertions pass.
- 14 new compatibility assertions run the actual main receipt migration plus the new guard in isolated Postgres. They verify regular atomic receipt completion, replay preservation, browser denial, service-role privilege, Specials confirmation suppression and rejection of Specials receipt completion without order or receipt mutation.
- Production receipt page and receipt Edge source remain identical to main.
- No production merge, schema change or deployment was performed.

## Sandbox deployment blocked

Automatic approval review rejected applying the main receipt migration to the temporary test project. Its stated reason described schema changes, order backfill/constraints, privileged functions and notification behavior as a substantial production migration lacking exact deployment approval. The target was the temporary Specials project, but no workaround or indirect execution was attempted.

Consequently the main receipt migration and new compatibility migration are prepared and tested locally, but not applied to the hosted test project. The new Specials confirmation endpoint is not deployed there yet. Updated branch preview must not be used for full receipt testing until backend synchronization is authorized and completed. The previous immutable preview https://07750a0f.jokotoday-preview.pages.dev remains the prior frontend build.

## Remaining

1. Approve synchronization of the temporary test project only: apply the main receipt migration, apply the compatibility guard, deploy the distinct Specials confirmation endpoint and guarded staff handover endpoint. Preserve production unchanged. Then verify hosted role guards and browser workflows.
2. Stripe sandbox late-payment/expiry refund, replay and provider-failure cases; Stripe-paid staff/customer pickup.
3. Provider-backed EasySlip checks using approved test fixtures, with no unapproved real transfer.
4. Isolated LINE test integration; no broadcast is authorized by this recovery.
5. Admin localized editor save/reload and mobile/desktop UI checks against synchronized preview.
6. Review before production merge/deployment.

## Hosted synchronization completed after explicit approval

The user approved updating only the temporary Specials project. Project metadata was verified as `JOKO Specials Test`, ref `szijiljpasxddzgzckra`. The initial migration request encountered an expired request-state error; inspection confirmed it had not run, and the subsequent approved retry succeeded.

- Main customer receipt migration and post-main Specials compatibility migration applied successfully.
- Deployed `confirm-specials-pickup-receipt` and guarded `create-pickup-handover`.
- Deployed regular `create-pickup-handoff`, `pickup-handoff-status` and `confirm-pickup-receipt`, including their reviewed shared dependencies.
- HTTP checks found preview origins were rejected by the production origin allowlist. Added two exact preview origins, conditional on the exact temporary project's Supabase URL. Other projects, including production, still reject these origins. 13 isolated origin checks verify this boundary; no generic Pages wildcard was added.
- Nine hosted rejection/preflight checks pass: staff endpoints require authentication; malformed tokens return 400; nonexistent valid-length tokens return 404; regular preview preflight returns 204 with the exact permitted origin.
- Hosted permissions deny `anon` and `authenticated` execution of both regular and Specials receipt finalizers and permit `service_role`. Receipt/session tables enable RLS. All nine test orders have pickup codes, and both compatibility guards are present.
- JT-1016 remains confirmed/paid, committed/verified and ready. Its Test Mae Rim pickup window is 2026-10-13 09:00–19:00 Bangkok time. JT-1011 remains picked up.

Ready-to-test frontend: https://d049d517.jokotoday-preview.pages.dev/
Staff should choose Pickup Desk → JOKO Specials, select Test Mae Rim and use JT-1016 for the Stripe-paid staff/customer QR confirmation test.

The earlier deployment block above is resolved. This evidence does not claim completion of authenticated browser handover or provider refund tests. No production deployment, LINE campaign or new provider payment was performed during synchronization.

## Requested full recheck — afternoon, 13 October

- Reran all seven suites at `c4a4234`: 286 assertions passed (62 foundation, 106 checkout/payment/pickup/LINE, 35 Edge adapters, 45 Stripe signatures/adapters, 14 receipt compatibility, 11 menu, 13 preview origins). Typecheck and production build passed; lint remains 0 errors and 37 warnings.
- Hosted evidence confirms the user's successful workflow was JT-1017: paid, financial verified, fulfillment/order picked_up, receipt confirmed at 2026-10-13 03:36:35 UTC (10:36 Bangkok). JT-1016 remains paid and ready. No test order was artificially completed during this recheck.
- Stripe connector confirms JT-1017's PaymentIntent succeeded with `livemode=false`. The dedicated JOKO Specials Test account was used; live account was not used. The cancelled JT-1015 intent currently requires a new payment method and has no hosted instructions, so it cannot exercise late success through its previous instructions.
- Cloud browser checks passed for loaded EN/TH/ZH catalogue, pickup window/cutoff, changing language with a basket, Add cookie and THB40 basket total, and the authorized-Admin login gate. Admin text-editor save/reload and authenticated regular-order browser regression remain blocked by missing browser Admin authentication. Desktop/public checks do not establish mobile visual coverage.
- Existing tests cover signed-webhook replay, amount/intent/currency mismatch, transient database retry, released-stock late-payment refund requirement, pending versus succeeded refund and out-of-order refund updates. These are isolated-provider tests; a new end-to-end Stripe sandbox refund was not performed. Connected Stripe operation discovery exposed read operations only, and refund-list access returned an authentication error.
- Test DB has zero `payment_slip_verifications` records and no `specials_line_outbox` jobs. Therefore no provider-backed EasySlip success or LINE acceptance/delivery can be claimed. The 35 adapter assertions cover validation and LINE retry/error handling, but no live broadcast was sent. An isolated test OA and approved provider test slip remain necessary.
- Hosted RPC privilege matrix continues to deny anonymous/authenticated execution of payment verification, receipt finalization and LINE worker RPCs; service_role is allowed.
- Security advisor still reports inherited baseline SECURITY DEFINER execute warnings and intentional deny-all session-table RLS notices. No claim of a clean full-project security audit. Advisory remediation: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable.
- Public preview footer still advertises cash/QR at pickup despite prepaid Specials copy. This is an inherited shared-footer content inconsistency, not a payment bypass; capture it for content correction before rollout.

Release status: draft; do not merge/deploy yet. Pending provider-backed checks and authenticated/mobile Admin/browser checks remain explicit rather than being labelled passed.
