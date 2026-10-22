# JOKO Store — dual payment checkout acceptance plan

Status: design and release gates only. PR #295 stays draft. Production unchanged.

## Initial release boundary
Customer checkout starts with Store-only pickup. Preserve the shared cart and existing Bakery behavior, but do not accept mixed Bakery + Store payments until stock and pickup capacities are reserved atomically. Delivery requires independently tested eligibility, courier fee, and fulfillment guarantees.

## Payment options
- K SHOP / EasySlip: exact bank payment and slip upload, including existing desktop-to-mobile QR handoff. Distinguish bank payment QR from slip-upload QR.
- Stripe PromptPay: Stripe-generated QR, provider-signed webhook confirms payment automatically. No slip upload.
- Both must be explicit customer options, not a silent fallback. The server records the selected rail before generating instructions. No automatic changes to the provider of an existing payment.

## Atomic checkout requirements
Authenticate, validate published/ordering-enabled Store SKUs, quantities, stock, pickup eligibility, and authoritative pricing. Use one idempotent server transaction to create canonical order, stock hold, item snapshots, fulfillment group, Store payment-mode snapshot, payment transaction and payment link. Payment expiration and hold expiration must align. Customer controls must not set payment mode, price, reference or paid status outside approved choices.

## Provider rules
EasySlip confirmation requires valid receiving account, amount, fresh bank reference, duplicate protection, and canonical order state. Stripe confirmation requires signed webhook, exact currency and amount, matching PaymentIntent, deduplication and idempotent stock commit. Late Stripe success after cancellation/expiry requires refund/reconciliation rather than stock resurrection.

## Reuse
Existing components: OnlinePromptPayPanel, PaymentHandoffPage and StoreFulfillmentPreview.
Existing functions: verify-payment-slip, create-payment-handoff, payment-handoff-status, stripe-promptpay-intent, stripe-webhook. Store inventory reservation and reconciliation migrations remain the backend foundation.

## Acceptance gates
1. Store-only checkout creation, server-calculated amount, stock conflicts, multiple browser submissions, and expiry.
2. EasySlip mobile upload, wrong account, wrong amount, duplicate slip and real verified payment.
3. Stripe test-mode PaymentIntent with verified-signature webhook, duplicated/reordered events, failure, cancellation and late-payment refund.
4. Exactly-once stock and notification event across simultaneous committed callbacks for each rail; Bakery/Specials regression tests.
5. Confirm Stripe PromptPay activation, secrets, webhook registration and test/live separation. Do not expose keys.
6. EN/TH/ZH responsive checkout and helpful payment error recovery.
7. Obtain explicit separate approval before turning on checkout, merging PR #295 or deploying production.

Staging payment policy remains disabled pending successful tests. Stripe approval does not by itself verify live payment readiness.
