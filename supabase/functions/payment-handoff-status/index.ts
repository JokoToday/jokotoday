import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
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
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => null) as { token?: string } | null;
    const token = body?.token?.trim();
    if (!token || token.length < 32 || token.length > 128) {
      return json({ error: "Invalid payment handoff" }, 400);
    }

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
    if (!handoff) return json({ error: "Payment handoff not found" }, 404);

    if (new Date(handoff.expires_at).getTime() <= Date.now() && !["verified", "expired"].includes(handoff.status)) {
      await service.from("payment_handoff_sessions")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", handoff.id);
      return json({ state: "expired", error: "Payment handoff has expired" }, 410);
    }

    const [{ data: payment, error: paymentError }, { data: order, error: orderError }] = await Promise.all([
      service.from("payment_transactions")
        .select("id, amount_due, currency, status, expires_at, verified_at")
        .eq("id", handoff.payment_transaction_id)
        .maybeSingle(),
      service.from("orders")
        .select("id, order_number, payment_status, status")
        .eq("id", handoff.order_id)
        .maybeSingle(),
    ]);

    if (paymentError) throw paymentError;
    if (orderError) throw orderError;
    if (!payment || !order) return json({ error: "Payment handoff is no longer available" }, 404);

    const state = payment.status === "verified" || order.payment_status === "paid"
      ? "verified"
      : ["expired", "cancelled"].includes(payment.status)
        ? "expired"
        : handoff.status;

    return json({
      state,
      paymentTransactionId: payment.id,
      orderNumber: order.order_number,
      amount: Number(payment.amount_due),
      currency: payment.currency,
      expiresAt: payment.expires_at,
      paymentStatus: order.payment_status,
      orderStatus: order.status,
    });
  } catch (error) {
    console.error("payment-handoff-status failed", error);
    return json({ error: "Could not load payment handoff" }, 500);
  }
});
