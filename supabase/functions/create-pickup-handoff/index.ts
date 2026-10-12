import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import {
  handlePreflight,
  isValidUuid,
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
  if (req.method === "OPTIONS") return handlePreflight(req);
  if (req.method !== "POST") return jsonResponse(req, 405, { error: "Method not allowed" });

  const originRejection = rejectDisallowedOrigin(req);
  if (originRejection) return originRejection;

  try {
    const authorization = req.headers.get("Authorization");
    const bearer = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!bearer) return jsonResponse(req, 401, { error: "Authentication required" });

    const service = createClient(requiredEnv("SUPABASE_URL"), serviceKey(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: authData, error: authError } = await service.auth.getUser(bearer);
    if (authError || !authData.user) {
      return jsonResponse(req, 401, { error: "Authentication required" });
    }

    const { data: profile, error: profileError } = await service
      .from("user_profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile || !["staff", "admin"].includes(profile.role)) {
      return jsonResponse(req, 403, { error: "Staff access required" });
    }

    const body = await req.json().catch(() => null) as { orderId?: unknown } | null;
    const orderId = body?.orderId;
    if (!isValidUuid(orderId)) return jsonResponse(req, 400, { error: "Invalid order id" });

    const { data: order, error: orderError } = await service
      .from("orders")
      .select("id, order_number, customer_id, status, payment_status")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return jsonResponse(req, 404, { error: "Order not found" });

    if (order.status === "completed") {
      const { data: receipt } = await service
        .from("order_receipts")
        .select("receipt_number")
        .eq("order_id", order.id)
        .maybeSingle();

      return jsonResponse(req, 200, {
        state: "completed",
        orderNumber: order.order_number,
        receiptNumber: receipt?.receipt_number ?? null,
      });
    }

    if (order.payment_status !== "paid") {
      return jsonResponse(req, 409, { error: "Payment must be complete before handover" });
    }
    if (order.status !== "picked_up") {
      return jsonResponse(req, 409, { error: "Staff handover must be confirmed first" });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    await service
      .from("pickup_handoff_sessions")
      .update({ status: "cancelled", updated_at: now.toISOString() })
      .eq("order_id", order.id)
      .eq("status", "active");

    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const handoffToken = toBase64Url(tokenBytes);
    const tokenHash = await sha256Hex(handoffToken);

    const { data: handoff, error: handoffError } = await service
      .from("pickup_handoff_sessions")
      .insert({
        order_id: order.id,
        customer_id: order.customer_id,
        token_hash: tokenHash,
        status: "active",
        expires_at: expiresAt.toISOString(),
        created_by: authData.user.id,
      })
      .select("expires_at")
      .single();

    if (handoffError) throw handoffError;

    return jsonResponse(req, 200, {
      state: "active",
      handoffToken,
      orderNumber: order.order_number,
      expiresAt: handoff.expires_at,
    });
  } catch (error) {
    console.error("create-pickup-handoff failed", error);
    return jsonResponse(req, 500, { error: "Could not create customer receipt confirmation" });
  }
});
