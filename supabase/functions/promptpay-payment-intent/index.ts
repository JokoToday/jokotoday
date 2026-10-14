import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { buildKShopMasterPayload } from "../_shared/kshop-master-qr.ts";
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

function field(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function crc16Ccitt(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function normalizePromptPayTarget(raw: string): { subTag: "01" | "02"; value: string } {
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 10 && digits.startsWith("0")) {
    return { subTag: "01", value: `0066${digits.slice(1)}` };
  }

  if (digits.length === 13) {
    return { subTag: "02", value: digits };
  }

  throw new Error("PROMPTPAY_ID must be a Thai mobile number or 13-digit national/tax id");
}

type EasySlipQrResponse = {
  status?: number;
  message?: string;
  data?: {
    image?: string;
    mime?: string;
    payload?: string;
  };
};

function sanitizeKShopRef(orderNumber: string, orderId: string): string {
  const preferred = orderNumber.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
  if (preferred) return preferred;
  return orderId.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) || "JOKOORDER";
}

async function buildKShopPayload(orderNumber: string, orderId: string, amount: number): Promise<string> {
  const response = await fetch("https://api.easyslip.com/v1/qr/generate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredEnv("EASYSLIP_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "KSHOP",
      ref1: sanitizeKShopRef(orderNumber, orderId),
      amount: Number(amount.toFixed(2)),
    }),
  });

  const result = await response.json().catch(() => null) as EasySlipQrResponse | null;
  if (!response.ok || result?.status !== 200 || !result?.data?.payload) {
    console.error("EasySlip K SHOP QR generation failed", {
      status: response.status,
      providerStatus: result?.status,
      providerMessage: result?.message,
    });
    throw new Error("K SHOP QR generation failed");
  }

  return result.data.payload;
}

function buildPromptPayPayload(targetRaw: string, amount: number): string {
  const target = normalizePromptPayTarget(targetRaw);
  const merchantAccount =
    field("00", "A000000677010111") +
    field(target.subTag, target.value);

  const base =
    field("00", "01") +
    field("01", "12") +
    field("29", merchantAccount) +
    field("53", "764") +
    field("54", amount.toFixed(2)) +
    field("58", "TH") +
    "6304";

  return base + crc16Ccitt(base);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

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
    if (!paymentTransactionId) {
      return jsonResponse({ error: "Payment transaction id is required" }, 400);
    }

    const { data: payment, error: paymentError } = await service
      .from("payment_transactions")
      .select("id, order_id, customer_id, amount_due, currency, status, expires_at")
      .eq("id", paymentTransactionId)
      .maybeSingle();

    if (paymentError) throw paymentError;
    if (!payment) return jsonResponse({ error: "Payment transaction not found" }, 404);
    if (payment.customer_id !== authData.user.id) return jsonResponse({ error: "Forbidden" }, 403);

    const { data: order, error: orderError } = await service
      .from("orders")
      .select("id, order_number, customer_id, payment_status, status, order_type")
      .eq("id", payment.order_id)
      .maybeSingle();

    if (orderError) throw orderError;
    if (order?.order_type === "specials") return jsonResponse({ error: "Use the JOKO Specials checkout for this order" }, 409);
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
      });
    }

    if (["expired", "cancelled"].includes(payment.status) || new Date(payment.expires_at).getTime() <= Date.now()) {
      return jsonResponse({ state: "expired", error: "Payment request has expired" }, 410);
    }

    const amount = Number(payment.amount_due);
    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonResponse({ error: "Invalid payment amount" }, 409);
    }

    const { data: setting, error: settingError } = await service
      .from("payment_settings")
      .select("payment_qr_mode")
      .eq("id", true)
      .maybeSingle();

    if (settingError) throw settingError;

    const qrMode = setting?.payment_qr_mode === "kshop_master"
      ? "kshop_master"
      : setting?.payment_qr_mode === "kshop_easyslip"
        ? "kshop_easyslip"
        : "promptpay_legacy";

    const payload = qrMode === "kshop_master"
      ? buildKShopMasterPayload(requiredEnv("KSHOP_MASTER_QR_PAYLOAD"), amount)
      : qrMode === "kshop_easyslip"
        ? await buildKShopPayload(order.order_number, order.id, amount)
        : buildPromptPayPayload(requiredEnv("PROMPTPAY_ID"), amount);

    return jsonResponse({
      state: "pending",
      paymentTransactionId: payment.id,
      orderId: order.id,
      orderNumber: order.order_number,
      amount,
      currency: payment.currency,
      expiresAt: payment.expires_at,
      qrMode,
      promptPayPayload: payload,
    });
  } catch (error) {
    console.error("promptpay-payment-intent failed", error);
    return jsonResponse({ error: "Could not prepare payment QR" }, 500);
  }
});
