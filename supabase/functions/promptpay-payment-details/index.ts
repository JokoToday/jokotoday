import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { payloadFor } from "npm:@thai-qr-payment/payload@1.2.0";

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
    );
    const { data: authData, error: authError } = await service.auth.getUser(bearerMatch[1]);
    if (authError || !authData.user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => null) as { order_id?: string } | null;
    const orderId = body?.order_id?.trim();
    if (!orderId) return jsonResponse({ error: "Order id is required" }, 400);

    const userClient = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_ANON_KEY"),
      {
        global: {
          headers: {
            Authorization: authorization!,
          },
        },
      },
    );

    const { data: started, error: startError } = await userClient.rpc(
      "begin_promptpay_payment_v1",
      { p_order_id: orderId },
    );

    if (startError) {
      return jsonResponse({ error: startError.message }, 409);
    }

    const result = started as {
      order_id?: string;
      order_number?: string;
      amount_due?: number | string;
      payment_due_at?: string;
      payment_status?: string;
      payment_transaction?: {
        id?: string;
        status?: string;
        payment_due_at?: string;
      } | null;
    } | null;

    if (!result?.order_id || !result.order_number) {
      throw new Error("Payment preparation returned an invalid result");
    }

    if (result.payment_status === "paid" || result.payment_transaction?.status === "paid") {
      return jsonResponse({
        state: "paid",
        order_id: result.order_id,
        order_number: result.order_number,
        message: "Payment is already confirmed.",
      });
    }

    const amount = Number(result.amount_due);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("Payment amount is invalid");
    }

    const recipient = requiredEnv("JOKO_PROMPTPAY_ID");
    const promptpayPayload = payloadFor({
      recipient,
      amount: Number(amount.toFixed(2)),
    });

    return jsonResponse({
      state: "awaiting_payment",
      order_id: result.order_id,
      order_number: result.order_number,
      payment_transaction_id: result.payment_transaction?.id || null,
      amount: Number(amount.toFixed(2)),
      payment_due_at: result.payment_due_at || result.payment_transaction?.payment_due_at || null,
      promptpay_payload: promptpayPayload,
    });
  } catch (error) {
    console.error("PromptPay payment preparation failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return jsonResponse({ error: "Could not prepare PromptPay payment" }, 500);
  }
});
