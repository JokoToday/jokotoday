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
