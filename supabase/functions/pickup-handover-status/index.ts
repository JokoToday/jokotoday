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
    if (!token || token.length < 32 || token.length > 128) return json({ error: "Invalid pickup confirmation" }, 400);

    const service = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false },
    });

    const tokenHash = await sha256Hex(token);
    const { data: handoff, error: handoffError } = await service
      .from("pickup_handover_sessions")
      .select("id, order_id, status, expires_at, customer_confirmed_at, completed_at, bypass_reason")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (handoffError) throw handoffError;
    if (!handoff) return json({ error: "Pickup confirmation not found" }, 404);

    if (handoff.status === "active" && new Date(handoff.expires_at).getTime() <= Date.now()) {
      await service.from("pickup_handover_sessions")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", handoff.id)
        .eq("status", "active");
      handoff.status = "expired";
    }

    const { data: order, error: orderError } = await service
      .from("orders")
      .select("id, order_number, order_items, total_amount, loyalty_discount_amount, amount_paid, payment_status, payment_method, status, pickup_date, pickup_location_id")
      .eq("id", handoff.order_id)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return json({ error: "Order not found" }, 404);

    let pickupLocation: string | null = null;
    if (order.pickup_location_id) {
      const { data: location } = await service
        .from("cms_pickup_locations")
        .select("name_en, name_th, name_zh")
        .eq("id", order.pickup_location_id)
        .maybeSingle();
      pickupLocation = location?.name_en || null;
    }

    const state = ["confirmed", "bypassed"].includes(handoff.status) || ["picked_up", "completed"].includes(order.status)
      ? "completed"
      : handoff.status;

    return json({
      state,
      handoffId: handoff.id,
      expiresAt: handoff.expires_at,
      customerConfirmedAt: handoff.customer_confirmed_at,
      completedAt: handoff.completed_at,
      bypassed: handoff.status === "bypassed",
      order: {
        orderNumber: order.order_number,
        items: Array.isArray(order.order_items) ? order.order_items : [],
        totalAmount: Number(order.total_amount || 0),
        loyaltyDiscountAmount: Number(order.loyalty_discount_amount || 0),
        amountPaid: Number(order.amount_paid || 0),
        paymentStatus: order.payment_status,
        paymentMethod: order.payment_method,
        status: order.status,
        pickupDate: order.pickup_date,
        pickupLocation,
      },
    });
  } catch (error) {
    console.error("pickup-handover-status failed", error);
    return json({ error: "Could not load pickup confirmation" }, 500);
  }
});
