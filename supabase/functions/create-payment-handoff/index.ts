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

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
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
      .select("id, order_id, customer_id, amount_due, currency, status, expires_at")
      .eq("id", paymentTransactionId)
      .maybeSingle();

    if (paymentError) throw paymentError;
    if (!payment) return jsonResponse({ error: "Payment transaction not found" }, 404);
    if (payment.customer_id !== authData.user.id) return jsonResponse({ error: "Forbidden" }, 403);
    if (payment.status === "verified") return jsonResponse({ error: "Payment is already verified" }, 409);
    if (["expired", "cancelled"].includes(payment.status) || new Date(payment.expires_at).getTime() <= Date.now()) {
      return jsonResponse({ error: "Payment request has expired" }, 410);
    }

    const { data: order, error: orderError } = await service
      .from("orders")
      .select("id, order_number, customer_id, payment_status, status")
      .eq("id", payment.order_id)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order || order.customer_id !== authData.user.id) return jsonResponse({ error: "Order not found" }, 404);
    if (order.payment_status === "paid") return jsonResponse({ error: "Order is already paid" }, 409);
    if (!["pending", "confirmed", "ready"].includes(order.status)) {
      return jsonResponse({ error: "This order can no longer accept payment" }, 409);
    }

    await service
      .from("payment_handoff_sessions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("payment_transaction_id", payment.id)
      .eq("status", "active");

    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = base64Url(bytes);
    const tokenHash = await sha256Hex(token);

    const { error: insertError } = await service
      .from("payment_handoff_sessions")
      .insert({
        payment_transaction_id: payment.id,
        order_id: order.id,
        customer_id: authData.user.id,
        token_hash: tokenHash,
        channel: "phone_web",
        status: "active",
        expires_at: payment.expires_at,
      });

    if (insertError) throw insertError;

    const appUrl = (Deno.env.get("PUBLIC_APP_URL") || "https://joko.today").replace(/\/$/, "");
    return jsonResponse({
      handoffUrl: `${appUrl}/pay/handoff/${encodeURIComponent(token)}`,
      expiresAt: payment.expires_at,
      amount: Number(payment.amount_due),
      currency: payment.currency,
      orderNumber: order.order_number,
    });
  } catch (error) {
    console.error("create-payment-handoff failed", error);
    return jsonResponse({ error: "Could not create phone payment handoff" }, 500);
  }
});
