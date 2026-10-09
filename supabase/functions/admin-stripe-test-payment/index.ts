import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

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

function testOrderNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase();
  return `ST-${stamp}-${suffix}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    const match = authorization?.match(/^Bearer\s+(\S+)$/i);
    if (!match) return jsonResponse({ error: "Unauthorized" }, 401);

    const service = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );

    const { data: authData, error: authError } = await service.auth.getUser(match[1]);
    if (authError || !authData.user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: profile, error: profileError } = await service
      .from("user_profiles")
      .select("name, phone, role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile || profile.role !== "admin") return jsonResponse({ error: "Admin access required" }, 403);

    const body = await req.json().catch(() => null) as { amount?: number } | null;
    const amount = Number(body?.amount);
    if (!Number.isFinite(amount) || amount < 1 || amount > 1000) {
      return jsonResponse({ error: "Test amount must be between ฿1.00 and ฿1,000.00" }, 400);
    }
    const roundedAmount = Math.round(amount * 100) / 100;

    const { data: settings, error: settingsError } = await service
      .from("payment_settings")
      .select("payment_window_minutes")
      .eq("id", true)
      .maybeSingle();
    if (settingsError) throw settingsError;
    const paymentWindowMinutes = Math.max(5, Math.min(1440, Number(settings?.payment_window_minutes) || 15));

    const orderNumber = testOrderNumber();
    const { data: order, error: orderError } = await service
      .from("orders")
      .insert({
        customer_id: authData.user.id,
        order_number: orderNumber,
        order_items: [{
          product_id: null,
          product_name: "Stripe PromptPay Sandbox Test",
          quantity: 1,
          price_at_order: roundedAmount,
        }],
        total_amount: roundedAmount,
        status: "pending",
        payment_status: "unpaid",
        customer_name: profile.name || "JOKO Admin",
        customer_phone: profile.phone || "TEST",
        customer_email: authData.user.email || null,
        notes: "[STRIPE_SANDBOX_TEST] Admin-only automated PromptPay test order. No inventory is reserved.",
        purchase_type: "online",
        inventory_reserved: false,
        loyalty_discount_amount: 0,
      })
      .select("id, order_number, total_amount, status, payment_status")
      .single();

    if (orderError) throw orderError;

    const expiresAt = new Date(Date.now() + paymentWindowMinutes * 60_000).toISOString();
    const { data: payment, error: paymentError } = await service
      .from("payment_transactions")
      .insert({
        order_id: order.id,
        customer_id: authData.user.id,
        amount_due: roundedAmount,
        currency: "THB",
        status: "pending",
        expires_at: expiresAt,
      })
      .select("id, provider, payment_mode, amount_due, status, expires_at")
      .single();

    if (paymentError) {
      await service.from("orders").delete().eq("id", order.id);
      throw paymentError;
    }

    // The insert trigger intentionally applies the current global provider to
    // ordinary customer transactions. This admin-only test explicitly overrides
    // only the synthetic transaction, leaving production settings untouched.
    const { data: stripePayment, error: stripeUpdateError } = await service
      .from("payment_transactions")
      .update({
        provider: "stripe",
        payment_mode: "stripe_promptpay",
        rail: "promptpay",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id)
      .select("id, provider, payment_mode, amount_due, status, expires_at")
      .single();

    if (stripeUpdateError) {
      await service.from("payment_transactions").delete().eq("id", payment.id);
      await service.from("orders").delete().eq("id", order.id);
      throw stripeUpdateError;
    }

    return jsonResponse({
      state: "created",
      orderId: order.id,
      orderNumber: order.order_number,
      paymentTransactionId: stripePayment.id,
      amount: Number(stripePayment.amount_due),
      currency: "THB",
      expiresAt: stripePayment.expires_at,
      paymentMode: stripePayment.payment_mode,
      provider: stripePayment.provider,
      globalPaymentModeChanged: false,
    });
  } catch (error) {
    console.error("admin-stripe-test-payment failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Could not create Stripe sandbox test payment" }, 500);
  }
});
