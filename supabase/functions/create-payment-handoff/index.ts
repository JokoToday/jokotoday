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

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    const bearer = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!bearer) return json({ error: "Unauthorized" }, 401);

    const service = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );

    const { data: authData, error: authError } = await service.auth.getUser(bearer);
    if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => null) as { paymentTransactionId?: string } | null;
    const paymentTransactionId = body?.paymentTransactionId?.trim();
    if (!paymentTransactionId) return json({ error: "Payment transaction id is required" }, 400);

    const { data: payment, error: paymentError } = await service
      .from("payment_transactions")
      .select("id, order_id, customer_id, amount_due, currency, status, expires_at")
      .eq("id", paymentTransactionId)
      .maybeSingle();

    if (paymentError) throw paymentError;
    if (!payment) return json({ error: "Payment transaction not found" }, 404);
    if (payment.customer_id !== authData.user.id) return json({ error: "Forbidden" }, 403);

    if (payment.status === "verified") {
      return json({ state: "verified", paymentTransactionId: payment.id });
    }

    if (["expired", "cancelled"].includes(payment.status) || new Date(payment.expires_at).getTime() <= Date.now()) {
      return json({ state: "expired", error: "Payment request has expired" }, 410);
    }

    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const handoffToken = toBase64Url(tokenBytes);
    const tokenHash = await sha256Hex(handoffToken);

    await service
      .from("payment_handoff_sessions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("payment_transaction_id", payment.id)
      .eq("status", "active");

    const { data: handoff, error: handoffError } = await service
      .from("payment_handoff_sessions")
      .insert({
        payment_transaction_id: payment.id,
        order_id: payment.order_id,
        customer_id: payment.customer_id,
        token_hash: tokenHash,
        channel: "mobile_web",
        status: "active",
        expires_at: payment.expires_at,
      })
      .select("id, expires_at")
      .single();

    if (handoffError) throw handoffError;

    return json({
      state: "active",
      handoffId: handoff.id,
      handoffToken,
      paymentTransactionId: payment.id,
      amount: Number(payment.amount_due),
      currency: payment.currency,
      expiresAt: handoff.expires_at,
    });
  } catch (error) {
    console.error("create-payment-handoff failed", error);
    return json({ error: "Could not create payment handoff" }, 500);
  }
});
