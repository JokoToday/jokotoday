# Specials payment sandbox setup

Use temporary Supabase project `szijiljpasxddzgzckra` and a separate Stripe sandbox. Do not copy live credentials into this project or paste secrets into chat.

## Stripe PromptPay

1. In the Stripe sandbox, enable PromptPay. Create a sandbox restricted key with the permissions needed to create/read PaymentIntents and create refunds. Any required additional permission must be checked against sandbox API responses.
2. In the temporary Supabase project's Edge Functions → Secrets, save it as `STRIPE_SECRET_KEY`. Keep this entirely server-side; no `VITE_` variable is needed.
3. In that Stripe sandbox, add a webhook destination:
   `https://szijiljpasxddzgzckra.supabase.co/functions/v1/stripe-webhook`
4. Subscribe to `payment_intent.succeeded`, `payment_intent.payment_failed`, and `refund.updated`. Set the endpoint API version to `2026-08-26.dahlia`, matching the pinned Stripe 22.6.0 SDK.
5. Save the destination's signing secret as `STRIPE_WEBHOOK_SECRET` in the same temporary project's Edge Functions secrets.
6. In preview Admin → Specials → Checkout, pickup & LINE, choose **Stripe PromptPay** and enable payments. Create fresh, clearly labelled test stock with today's Bangkok sales and pickup windows. Checkout must total at least THB 10.
7. Sign in as a test customer and check out. Use **Open Stripe sandbox payment** to simulate payment through Stripe's hosted instructions. Do not transfer money through a banking app for this test.
8. Confirm payment automatically becomes verified, inventory becomes committed once, and pickup is ready. Refresh and replay the Stripe event; neither may duplicate stock commitment or notification events.
9. Create another checkout, cancel its hold, then complete its sandbox payment. Confirm inventory remains released and the financial state becomes refund pending, then refunded only after Stripe reports success. Test expiry similarly; the app's five-minute hold is separate from the bank QR's lifetime.
10. Complete the staff → QR → customer receipt flow for the successful order.

An unauthenticated intent request must return 401. The webhook uses Stripe signatures instead of Supabase JWT authentication. Until both secrets exist it returns 503; an invalid signature after configuration must return 400.

## Merchant QR + EasySlip

1. In preview Admin select **Merchant PromptPay QR + EasySlip verification**.
2. Configure an approved merchant QR and the exact EasySlip-registered bank receiver. Do not use the fake QR/account from earlier fixtures for a real transfer.
3. Save `EASYSLIP_API_KEY` in the temporary project's Edge Functions secrets only.
4. Validate with isolated provider fixtures first. Real EasySlip verification requires an approved provider test facility or a separately authorized real transfer; mocked handler tests do not establish real provider success.
5. Verify exact amount, receiver and reference matching, duplicate-slip rejection, ambiguity handling and late-slip review. Switching Admin back to Stripe must leave existing EasySlip checkouts unchanged.

Production merge/deployment requires review of these real integration results. Neither a passing build nor simulated RPC verification replaces this checklist.

## Repeat local checks

The Stripe Edge test imports the actual Stripe SDK for signature validation but mocks provider/database calls. Install Stripe 22.6.0 in a temporary runtime, or set `STRIPE_MODULE` to its ESM entrypoint. Run:

```sh
STRIPE_MODULE=/absolute/path/to/stripe/esm/stripe.esm.node.js node scripts/test-specials-stripe-edge.mjs
PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node scripts/test-specials-checkout.mjs
node scripts/test-specials-edge.mjs
```
