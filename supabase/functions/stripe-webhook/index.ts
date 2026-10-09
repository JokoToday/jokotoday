import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import Stripe from "npm:stripe@22";

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"));
const cryptoProvider = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const signature = req.headers.get("stripe-signature") || "";
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      requiredEnv("STRIPE_WEBHOOK_SECRET"),
      undefined,
      cryptoProvider,
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return new Response("Invalid signature", { status: 400 });
  }

  const service = createClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const paymentIntentId = paymentIntent?.object === "payment_intent" ? paymentIntent.id : null;

  const { error: eventInsertError } = await service.from("stripe_webhook_events").upsert({
    event_id: event.id,
    event_type: event.type,
    payment_intent_id: paymentIntentId,
    received_at: new Date().toISOString(),
  }, { onConflict: "event_id", ignoreDuplicates: true });
  if (eventInsertError) console.error("Could not record Stripe webhook event", eventInsertError);

  if (event.type === "payment_intent.payment_failed" && paymentIntentId) {
    const txId = paymentIntent.metadata?.joko_payment_transaction_id;
    if (txId) {
      await service.from("payment_transactions").update({
        status: "failed",
        last_error_code: "STRIPE_PAYMENT_FAILED",
        last_error_message: paymentIntent.last_payment_error?.message || "Stripe PromptPay payment failed.",
        updated_at: new Date().toISOString(),
      }).eq("id", txId).eq("provider", "stripe").in("status", ["pending", "verifying", "failed"]);
    }
    await service.from("stripe_webhook_events").update({
      processed_at: new Date().toISOString(),
      processing_result: "payment_failed_recorded",
    }).eq("event_id", event.id);
    return Response.json({ received: true });
  }

  if (event.type !== "payment_intent.succeeded") {
    await service.from("stripe_webhook_events").update({
      processed_at: new Date().toISOString(),
      processing_result: "ignored",
    }).eq("event_id", event.id);
    return Response.json({ received: true });
  }

  try {
    const txId = paymentIntent.metadata?.joko_payment_transaction_id;
    if (!txId) throw new Error("Stripe PaymentIntent is missing JOKO payment transaction metadata");

    const { data: payment, error: paymentError } = await service
      .from("payment_transactions")
      .select("id, order_id, provider, payment_mode, amount_due, currency, status, expires_at, provider_transaction_ref")
      .eq("id", txId)
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment || payment.provider !== "stripe" || payment.payment_mode !== "stripe_promptpay") {
      throw new Error("Stripe webhook does not map to an active Stripe JOKO payment transaction");
    }
    if (payment.provider_transaction_ref !== paymentIntent.id) {
      throw new Error("Stripe PaymentIntent id does not match the JOKO payment transaction");
    }

    const expectedSatang = Math.round(Number(payment.amount_due) * 100);
    if (paymentIntent.currency !== "thb" || paymentIntent.amount_received !== expectedSatang) {
      throw new Error("Stripe payment currency or amount does not match the JOKO amount due");
    }

    // A QR can theoretically be paid after JOKO's reservation deadline. Never
    // resurrect released inventory. Refund the late Stripe payment automatically
    // and acknowledge the webhook so no manual payment handling is required.
    if (["expired", "cancelled"].includes(payment.status) || new Date(payment.expires_at).getTime() <= Date.now()) {
      if (!(["expired", "cancelled"] as string[]).includes(payment.status)) {
        const { error: expireError } = await service.rpc("expire_payment_transaction_v1", {
          p_payment_transaction_id: payment.id,
        });
        if (expireError) throw expireError;
      }

      const refund = await stripe.refunds.create({
        payment_intent: paymentIntent.id,
        metadata: {
          reason: "joko_payment_window_expired",
          joko_payment_transaction_id: payment.id,
          joko_order_id: payment.order_id,
        },
      }, {
        idempotencyKey: `joko-late-refund-${paymentIntent.id}`,
      });

      await service.from("stripe_webhook_events").update({
        processed_at: new Date().toISOString(),
        processing_result: `late_payment_refunded:${refund.id}`,
        last_error: null,
      }).eq("event_id", event.id);

      return Response.json({ received: true, refunded: true });
    }

    const { data: finalized, error: finalizeError } = await service.rpc("finalize_verified_payment_v1", {
      p_payment_transaction_id: payment.id,
      p_provider_transaction_ref: paymentIntent.id,
      p_amount_in_slip: Number(payment.amount_due),
      p_account_matched: true,
      p_amount_matched: true,
      p_provider_duplicate: false,
    });
    if (finalizeError) throw finalizeError;

    await service.from("stripe_webhook_events").update({
      processed_at: new Date().toISOString(),
      processing_result: "payment_finalized",
      last_error: null,
    }).eq("event_id", event.id);

    return Response.json({ received: true, finalized: Boolean(finalized) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe webhook processing failed";
    console.error("Stripe webhook processing failed", error);
    await service.from("stripe_webhook_events").update({
      processed_at: new Date().toISOString(),
      processing_result: "error",
      last_error: message,
    }).eq("event_id", event.id);
    return new Response(message, { status: 500 });
  }
});
