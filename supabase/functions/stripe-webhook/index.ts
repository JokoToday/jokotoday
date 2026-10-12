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


async function refundLateOrCancelledPayment(
  paymentIntent: Stripe.PaymentIntent,
  payment: { id: string; order_id: string },
): Promise<Stripe.Refund> {
  return stripe.refunds.create({
    payment_intent: paymentIntent.id,
    metadata: {
      reason: "joko_payment_not_attachable",
      joko_payment_transaction_id: payment.id,
      joko_order_id: payment.order_id,
    },
  }, {
    idempotencyKey: `joko-late-refund-${paymentIntent.id}`,
  });
}

async function releasePaymentNotifications(orderId: string): Promise<void> {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  for (const functionName of ["send-payment-confirmation", "send-admin-order-notification"]) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ order_id: orderId }),
      });
      if (!response.ok && response.status !== 202) {
        console.error("Stripe post-payment notification could not be released", {
          functionName,
          orderId,
          status: response.status,
        });
      }
    } catch (error) {
      console.error("Stripe post-payment notification dispatch failed", {
        functionName,
        orderId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

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

  const { data: recordedEvent } = await service
    .from("stripe_webhook_events")
    .select("processed_at, processing_result")
    .eq("event_id", event.id)
    .maybeSingle();

  if (recordedEvent?.processed_at) {
    return Response.json({
      received: true,
      replay: true,
      result: recordedEvent.processing_result,
    });
  }

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

    const { data: orderState, error: orderStateError } = await service
      .from("orders")
      .select("status, payment_status")
      .eq("id", payment.order_id)
      .maybeSingle();
    if (orderStateError) throw orderStateError;
    if (!orderState) throw new Error("Stripe payment order no longer exists");

    // A QR can theoretically be paid after JOKO's reservation deadline. Never
    // resurrect released inventory. Refund the late Stripe payment automatically
    // and acknowledge the webhook so no manual payment handling is required.
    if (
      orderState.status === "cancelled"
      || ["expired", "cancelled"].includes(payment.status)
      || new Date(payment.expires_at).getTime() <= Date.now()
    ) {
      if (!(["expired", "cancelled"] as string[]).includes(payment.status)) {
        const { error: expireError } = await service.rpc("expire_payment_transaction_v1", {
          p_payment_transaction_id: payment.id,
        });
        if (expireError) throw expireError;
      }

      const refund = await refundLateOrCancelledPayment(paymentIntent, payment);

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

    if (finalizeError) {
      // Cancellation and expiry can win the row lock after Stripe has already
      // confirmed the bank payment. Re-read durable state and refund rather
      // than asking Stripe to retry forever or attaching funds to a dead order.
      const [{ data: freshPayment }, { data: freshOrder }] = await Promise.all([
        service.from("payment_transactions").select("status").eq("id", payment.id).maybeSingle(),
        service.from("orders").select("status").eq("id", payment.order_id).maybeSingle(),
      ]);

      if (
        freshOrder?.status === "cancelled"
        || freshPayment?.status === "cancelled"
        || freshPayment?.status === "expired"
      ) {
        const refund = await refundLateOrCancelledPayment(paymentIntent, payment);
        await service.from("stripe_webhook_events").update({
          processed_at: new Date().toISOString(),
          processing_result: `race_payment_refunded:${refund.id}`,
          last_error: null,
        }).eq("event_id", event.id);
        return Response.json({ received: true, refunded: true, raceResolved: true });
      }

      throw finalizeError;
    }

    await releasePaymentNotifications(payment.order_id);

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
