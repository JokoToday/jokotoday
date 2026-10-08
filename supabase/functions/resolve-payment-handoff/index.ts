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

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => null) as { token?: string } | null;
    const token = body?.token?.trim();
    if (!token || token.length < 32 || token.length > 128) return jsonResponse({ error: "Invalid handoff" }, 400);

    const service = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );

    const tokenHash = await sha256Hex(token);
    const { data: handoff, error: handoffError } = await service
      .from("payment_handoff_sessions")
      .select("id, payment_transaction_id, order_id, status, expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (handoffError) throw handoffError;
    if (!handoff) return jsonResponse({ error: "Handoff not found" }, 404);

    const expired = new Date(handoff.expires_at).getTime() <= Date.now();
    if (expired && !["verified", "expired", "cancelled"].includes(handoff.status)) {
      await service.from("payment_handoff_sessions")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", handoff.id);
    }

    const { data: payment, error: paymentError } = await service
      .from("payment_transactions")
      .select("id, amount_due, currency, status, expires_at")
      .eq("id", handoff.payment_transaction_id)
      .maybeSingle();
    if (paymentError) throw paymentError;

    const { data: order, error: orderError } = await service
      .from("orders")
      .select("id, order_number, payment_status, status, pickup_date")
      .eq("id", handoff.order_id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!payment || !order) return jsonResponse({ error: "Payment no longer exists" }, 404);

    const verified = payment.status === "verified" || order.payment_status === "paid";
    const state = verified
      ? "verified"
      : expired || payment.status === "expired" || handoff.status === "expired"
        ? "expired"
        : ["cancelled"].includes(payment.status) || handoff.status === "cancelled"
          ? "cancelled"
          : payment.status === "verifying"
            ? "verifying"
            : "pending";

    return jsonResponse({
      state,
      orderNumber: order.order_number,
      amount: Number(payment.amount_due),
      currency: payment.currency,
      expiresAt: payment.expires_at,
      pickupDate: order.pickup_date,
    });
  } catch (error) {
    console.error("resolve-payment-handoff failed", error);
    return jsonResponse({ error: "Could not load payment handoff" }, 500);
  }
});
