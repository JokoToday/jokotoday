# JOKO Store customer checkout readiness — 20 Oct 2026
Status: staging only; production untouched; checkout disabled.

## Verified
- A real THB 10 EasySlip test verified canonical order, reserved inventory and deducted exactly one unit (on hand 5 -> 4, reserved 1 -> 0).
- Repeated reconciliation returned confirmed; stock unchanged.
- Wrong Stripe provider label caused by global Bakery payment-mode INSERT trigger.
- Store order mode snapshot fix deployed to staging and tested in a rolled-back transaction: correct kshop_master / easyslip mode retained.

## Pending before customer checkout
1. Apply the committed Store verification/expiry row-lock guard (not yet deployed) and test two-session expiry/verification races, both outcomes.
2. Implement atomic, idempotent customer Store checkout on server: trusted prices, stock, pickup availability, canonical orders, holds, fulfillment groups, provider snapshots, transactions and payment links.
3. Connect existing desktop payment panel to Store transactions. Reuse temporary mobile QR slip-upload with independent phone session.
4. Distinguish verified official bank payment QR from mobile slip upload QR; never fabricate a recipient or bank QR.
5. Test retry, duplicate bank reference, expiry, failure recovery, cancellation, multi-tab concurrency and exact-once stock deduction.
6. Maintain delivery and mixed Bakery/Store checkout disabled until capacity and fulfillment flows are transactionally supported.
7. Require separate approval before enabling store_payment_policy.checkout_enabled or merging/deploying production.

K SHOP/EasySlip is primary; Stripe PromptPay fallback disabled. Bakery and Specials paths must remain unchanged. Historic staging payment mislabeled Stripe remains as a documented audit artifact; do not silently rewrite it.
