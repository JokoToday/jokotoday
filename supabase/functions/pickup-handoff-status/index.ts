import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import {
  handlePreflight,
  jsonResponse,
  rejectDisallowedOrigin,
} from "../_shared/order-notifications.ts";

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function serviceKey(): string {
  const direct = Deno.env.get("SUPABASE_SECRET_KEY")?.trim()
    || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (direct) return direct;
  const mapped = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (mapped) {
    try {
      const parsed = JSON.parse(mapped) as Record<string, unknown>;
      if (typeof parsed.default === "string" && parsed.default.trim()) return parsed.default.trim();
    } catch {
      // Fall through.
    }
  }
  throw new Error("Supabase secret key is not configured");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handlePreflight(req);
  if (req.method !== "POST") return jsonResponse(req, 405, { error: "Method not allowed" });

  const originRejection = rejectDisallowedOrigin(req);
  if (originRejection) return originRejection;

  try {
    const body = await req.json().catch(() => null) as { token?: unknown } | null;
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (token.length < 32 || token.length > 128) {
      return jsonResponse(req, 400, { error: "Invalid pickup confirmation" });
    }

    const service = createClient(requiredEnv("SUPABASE_URL"), serviceKey(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const tokenHash = await sha256Hex(token);
    const { data: handoff, error: handoffError } = await service
      .from("pickup_handoff_sessions")
      .select("id, order_id, customer_id, status, expires_at, confirmed_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (handoffError) throw handoffError;
    if (!handoff) return jsonResponse(req, 404, { error: "Pickup confirmation not found" });

    const expired = new Date(handoff.expires_at).getTime() <= Date.now();
    if (expired && handoff.status === "active") {
      await service
        .from("pickup_handoff_sessions")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", handoff.id);
    }

    const [{ data: order, error: orderError }, { data: receipt, error: receiptError }] = await Promise.all([
      service
        .from("orders")
        .select("id, order_number, order_items, total_amount, loyalty_discount_amount, amount_paid, payment_status, status, picked_up_at, customer_received_at")
        .eq("id", handoff.order_id)
        .maybeSingle(),
      service
        .from("order_receipts")
        .select("receipt_number, issued_at")
        .eq("order_id", handoff.order_id)
        .maybeSingle(),
    ]);

    if (orderError) throw orderError;
    if (receiptError) throw receiptError;
    if (!order) return jsonResponse(req, 404, { error: "Order not found" });

    let preferredLanguage: "en" | "th" | "zh" = "en";
    if (handoff.customer_id) {
      const { data: profile } = await service
        .from("user_profiles")
        .select("preferred_language")
        .eq("id", handoff.customer_id)
        .maybeSingle();
      if (profile?.preferred_language === "th" || profile?.preferred_language === "zh") {
        preferredLanguage = profile.preferred_language;
      }
    }

    const discount = Math.max(0, Number(order.loyalty_discount_amount) || 0);
    const gross = Number(order.total_amount) || 0;
    const storedPaid = Number(order.amount_paid);
    const totalPaid = order.amount_paid !== null && order.amount_paid !== undefined && Number.isFinite(storedPaid)
      ? storedPaid
      : Math.max(0, gross - discount);

    const state = handoff.status === "confirmed" || (order.status === "completed" && receipt)
      ? "confirmed"
      : expired || handoff.status === "expired"
        ? "expired"
        : "active";

    return jsonResponse(req, 200, {
      state,
      orderNumber: order.order_number,
      items: Array.isArray(order.order_items) ? order.order_items : [],
      totalPaid,
      pickedUpAt: order.picked_up_at,
      customerReceivedAt: order.customer_received_at,
      receiptNumber: receipt?.receipt_number ?? null,
      preferredLanguage,
    });
  } catch (error) {
    console.error("pickup-handoff-status failed", error);
    return jsonResponse(req, 500, { error: "Could not load pickup confirmation" });
  }
});
