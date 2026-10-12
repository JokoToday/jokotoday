import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
    const bearer = req.headers.get("Authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!bearer) return json({ error: "Unauthorized" }, 401);

    const service = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false },
    });

    const { data: authData, error: authError } = await service.auth.getUser(bearer);
    if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

    const { data: profile } = await service
      .from("user_profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (!profile || !["staff", "admin"].includes(profile.role)) return json({ error: "Staff access required" }, 403);

    const body = await req.json().catch(() => null) as { orderId?: string } | null;
    const orderId = body?.orderId?.trim();
    if (!orderId) return json({ error: "Order id is required" }, 400);

    const { data: order, error: orderError } = await service
      .from("orders")
      .select("id, order_number, customer_id, payment_status, payment_method, status, picked_up_at, purchase_type")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return json({ error: "Order not found" }, 404);
    if (order.purchase_type !== "online") return json({ error: "Customer receipt confirmation is for online pickup orders" }, 409);
    if (order.status === "cancelled") return json({ error: "Cancelled orders cannot be handed over" }, 409);
    if (order.picked_up_at || ["picked_up", "completed"].includes(order.status)) {
      return json({ state: "completed", orderNumber: order.order_number }, 200);
    }
    if (order.payment_status !== "paid") return json({ error: "Payment must be verified before handover" }, 409);
    if (!order.payment_method) return json({ error: "Verified payment method is missing" }, 409);

    await service
      .from("pickup_handover_sessions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("order_id", order.id)
      .eq("status", "active");

    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const token = toBase64Url(tokenBytes);
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { data: handoff, error: handoffError } = await service
      .from("pickup_handover_sessions")
      .insert({
        order_id: order.id,
        customer_id: order.customer_id,
        staff_id: authData.user.id,
        token_hash: tokenHash,
        status: "active",
        expires_at: expiresAt,
      })
      .select("id, expires_at")
      .single();

    if (handoffError) throw handoffError;

    return json({
      state: "active",
      handoffId: handoff.id,
      token,
      orderNumber: order.order_number,
      expiresAt: handoff.expires_at,
      confirmUrl: `https://joko.today/pickup/confirm/${encodeURIComponent(token)}`,
    });
  } catch (error) {
    console.error("create-pickup-handover failed", error);
    return json({ error: "Could not start pickup handover" }, 500);
  }
});
