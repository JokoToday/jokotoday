import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import Stripe from "npm:stripe@22.6.0";

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const cryptoProvider = Stripe.createSubtleCryptoProvider();


async function refundLateOrCancelledPayment(
  stripe: Stripe,
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

  // Configuration failures must not masquerade as invalid signatures or crash startup.
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY")?.trim();
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")?.trim();
  if (!secretKey || !webhookSecret) return new Response("Stripe webhook is not configured", {status:503});
  // Isolated staging must never process live Stripe payment events.
  if ((Deno.env.get("SUPABASE_URL") || "").includes("szijiljpasxddzgzckra") && !secretKey.startsWith("sk_test_")) {
    return new Response("Staging Stripe must use test-mode credentials", { status: 503 });
  }
  const stripe = new Stripe(secretKey);
  const signature = req.headers.get("stripe-signature") || "";
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
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
  if (eventInsertError) return new Response("Could not record Stripe webhook event", {status:500});

  const { data: recordedEvent, error: eventLookupError } = await service
    .from("stripe_webhook_events")
    .select("processed_at, processing_result")
    .eq("event_id", event.id)
    .maybeSingle();

  if (eventLookupError) return new Response("Could not read Stripe webhook event", {status:500});
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

  if (event.type === "refund.updated") {
    const refund = event.data.object as Stripe.Refund;
    const intentId = typeof refund.payment_intent === "string" ? refund.payment_intent : refund.payment_intent?.id;
    const { data: payment, error: lookupError } = await service.from("payment_transactions")
      .select("order_id").eq("provider", "stripe").eq("provider_transaction_ref", intentId || "").maybeSingle();
    if (lookupError) return new Response("Refund lookup failed", {status:500});
    if (payment) {
      const { data: order, error: orderError } = await service.from("orders").select("order_type").eq("id",payment.order_id).maybeSingle();
      if (orderError || !order) return new Response("Refund order lookup failed", {status:500});
      if (order?.order_type === "specials") {
        const { error } = await service.rpc("specials_stripe_refund_v1", {
          p_order:payment.order_id,p_intent:intentId,p_refund:refund.id,p_status:refund.status || "pending",
        });
        if (error) return new Response("Refund persistence failed",{status:500});
      }
    }
    const { error } = await service.from("stripe_webhook_events").update({processed_at:new Date().toISOString(),processing_result:"refund_updated"}).eq("event_id",event.id);
    return error ? new Response("Event persistence failed",{status:500}) : Response.json({received:true});
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
      .select("status, payment_status, order_type")
      .eq("id", payment.order_id)
      .maybeSingle();
    if (orderStateError) throw orderStateError;
    if (!orderState) throw new Error("Stripe payment order no longer exists");

    if (orderState.order_type === "specials") {
      const { data: result, error: resultError } = await service.rpc("specials_finish_stripe_v1", {
        p_order: payment.order_id, p_intent: paymentIntent.id,
        p_amount_satang: paymentIntent.amount_received,
        p_paid_at: new Date(event.created * 1000).toISOString(),
      });
      if (resultError) throw resultError;
      if (result.state === "refund_required") {
        const refund = await refundLateOrCancelledPayment(stripe, paymentIntent, payment);
        console.info("Stripe Specials late-refund evidence", { refund_id: refund.id, status: refund.status });
        const { error: refundError } = await service.rpc("specials_stripe_refund_v1", {
          p_order: payment.order_id, p_intent: paymentIntent.id,
          p_refund: refund.id, p_status: refund.status || "pending",
        });
        if (refundError) throw refundError;
      } else if (result.state === "verified") {
        await releasePaymentNotifications(payment.order_id);
      }
      const { error: eventError } = await service.from("stripe_webhook_events").update({
        processed_at: new Date().toISOString(), processing_result: `specials:${result.state}`, last_error: null,
      }).eq("event_id", event.id);
      if (eventError) throw eventError;
      return Response.json({ received: true });
    }

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

      const refund = await refundLateOrCancelledPayment(stripe, paymentIntent, payment);

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
        const refund = await refundLateOrCancelledPayment(stripe, paymentIntent, payment);
        await service.from("stripe_webhook_events").update({
          processed_at: new Date().toISOString(),
          processing_result: `race_payment_refunded:${refund.id}`,
          last_error: null,
        }).eq("event_id", event.id);
        return Response.json({ received: true, refunded: true, raceResolved: true });
      }

      throw finalizeError;
    }

    // Store stock is separate from Bakery inventory. Reconcile only after
    // canonical Stripe verification succeeds; never acknowledge the event
    // as complete while Store stock remains reserved.
    const { data: storeLink, error: storeLinkError } = await service
      .from("store_payment_links")
      .select("payment_transaction_id")
      .eq("payment_transaction_id", payment.id)
      .maybeSingle();
    if (storeLinkError) throw storeLinkError;
    if (storeLink) {
      const { error: reconcileError } = await service.rpc("service_reconcile_store_verified_v1", {
        p_payment: payment.id,
      });
      if (reconcileError) throw reconcileError;
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
      processed_at: null,
      processing_result: "error",
      last_error: message,
    }).eq("event_id", event.id);
    return new Response(message, { status: 500 });
  }
});
