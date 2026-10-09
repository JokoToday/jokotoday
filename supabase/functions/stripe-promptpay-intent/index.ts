import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import Stripe from "npm:stripe@22";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    const bearerMatch = authorization?.match(/^Bearer\s+(\S+)$/i);
    if (!bearerMatch) return jsonResponse({ error: "Unauthorized" }, 401);

    const service = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );

    const { data: authData, error: authError } = await service.auth.getUser(bearerMatch[1]);
    if (authError || !authData.user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => null) as { paymentTransactionId?: string } | null;
    const paymentTransactionId = body?.paymentTransactionId?.trim();
    if (!paymentTransactionId) return jsonResponse({ error: "Payment transaction id is required" }, 400);

    const { data: payment, error: paymentError } = await service
      .from("payment_transactions")
      .select("id, order_id, customer_id, provider, payment_mode, amount_due, currency, status, expires_at, provider_transaction_ref")
      .eq("id", paymentTransactionId)
      .maybeSingle();

    if (paymentError) throw paymentError;
    if (!payment) return jsonResponse({ error: "Payment transaction not found" }, 404);
    if (payment.customer_id !== authData.user.id) return jsonResponse({ error: "Forbidden" }, 403);
    if (payment.provider !== "stripe" || payment.payment_mode !== "stripe_promptpay") {
      return jsonResponse({ error: "This payment transaction is not configured for Stripe PromptPay" }, 409);
    }

    const { data: order, error: orderError } = await service
      .from("orders")
      .select("id, order_number, customer_id, customer_email, payment_status, status")
      .eq("id", payment.order_id)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order || order.customer_id !== authData.user.id) return jsonResponse({ error: "Order not found" }, 404);

    if (payment.status === "verified" || order.payment_status === "paid") {
      return jsonResponse({
        state: "verified",
        paymentTransactionId: payment.id,
        orderId: order.id,
        orderNumber: order.order_number,
        amount: Number(payment.amount_due),
        currency: payment.currency,
        expiresAt: payment.expires_at,
        qrMode: "stripe_promptpay",
      });
    }

    if (["expired", "cancelled"].includes(payment.status) || new Date(payment.expires_at).getTime() <= Date.now()) {
      return jsonResponse({ state: "expired", error: "Payment request has expired" }, 410);
    }

    const amount = Number(payment.amount_due);
    if (!Number.isFinite(amount) || amount <= 0) return jsonResponse({ error: "Invalid payment amount" }, 409);
    if ((payment.currency || "THB").toUpperCase() !== "THB") return jsonResponse({ error: "Stripe PromptPay requires THB" }, 409);
    if (amount < 10) {
      return jsonResponse({
        code: "STRIPE_MINIMUM_AMOUNT",
        minimumAmount: 10,
        currency: "THB",
        error: "Stripe PromptPay requires a minimum payment of ฿10. Please add another item or choose another payment method.",
      }, 422);
    }

    const billingEmail = order.customer_email?.trim() || authData.user.email?.trim();
    if (!billingEmail) {
      return jsonResponse({ error: "Stripe PromptPay requires a customer email address" }, 409);
    }

    const stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"));
    let intent: Stripe.PaymentIntent;

    if (payment.provider_transaction_ref?.startsWith("pi_")) {
      intent = await stripe.paymentIntents.retrieve(payment.provider_transaction_ref);
    } else {
      intent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: "thb",
        payment_method_types: ["promptpay"],
        payment_method_data: {
          type: "promptpay",
          billing_details: { email: billingEmail },
        },
        confirm: true,
        description: `JOKO TODAY ${order.order_number}`,
        metadata: {
          joko_payment_transaction_id: payment.id,
          joko_order_id: order.id,
          joko_order_number: order.order_number,
        },
      }, {
        idempotencyKey: `joko-stripe-promptpay-${payment.id}`,
      });

      const { error: updateError } = await service
        .from("payment_transactions")
        .update({ provider_transaction_ref: intent.id, updated_at: new Date().toISOString() })
        .eq("id", payment.id)
        .eq("provider", "stripe")
        .is("provider_transaction_ref", null);
      if (updateError) throw updateError;
    }

    if (intent.status === "succeeded") {
      return jsonResponse({
        state: "pending",
        paymentTransactionId: payment.id,
        orderId: order.id,
        orderNumber: order.order_number,
        amount,
        currency: "THB",
        expiresAt: payment.expires_at,
        qrMode: "stripe_promptpay",
        stripeStatus: intent.status,
        stripeLivemode: intent.livemode,
      });
    }

    const qr = intent.next_action?.promptpay_display_qr_code;
    if (!qr?.data) {
      console.error("Stripe PromptPay PaymentIntent missing QR next_action", {
        paymentIntentId: intent.id,
        status: intent.status,
        nextActionType: intent.next_action?.type,
      });
      return jsonResponse({ error: "Stripe did not return a PromptPay QR for this payment" }, 502);
    }

    return jsonResponse({
      state: "pending",
      paymentTransactionId: payment.id,
      orderId: order.id,
      orderNumber: order.order_number,
      amount,
      currency: "THB",
      expiresAt: payment.expires_at,
      qrMode: "stripe_promptpay",
      promptPayPayload: qr.data,
      stripePaymentIntentId: intent.id,
      stripeHostedInstructionsUrl: qr.hosted_instructions_url,
      stripeLivemode: intent.livemode,
    });
  } catch (error) {
    console.error("stripe-promptpay-intent failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Could not prepare Stripe PromptPay QR" }, 500);
  }
});
