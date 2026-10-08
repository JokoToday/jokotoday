import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

type EasySlipPayload = {
  success?: boolean;
  message?: string;
  error?: { code?: string; message?: string };
  data?: {
    isDuplicate?: boolean;
    amountInOrder?: number;
    amountInSlip?: number;
    isAmountMatched?: boolean;
    matchedAccount?: {
      bank?: { nameEn?: string; nameTh?: string; shortCode?: string };
      nameTh?: string;
      nameEn?: string;
      type?: string;
      bankNumber?: string;
    } | null;
    rawSlip?: {
      transRef?: string;
      date?: string;
      amount?: { amount?: number };
    };
  };
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

function extensionFor(type: string): string {
  switch (type) {
    case "image/png": return "png";
    case "image/gif": return "gif";
    case "image/webp": return "webp";
    default: return "jpg";
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const service = createClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  let attemptId: string | null = null;
  let paymentTransactionId: string | null = null;

  try {
    const authorization = req.headers.get("Authorization");
    const bearerMatch = authorization?.match(/^Bearer\s+(\S+)$/i);
    if (!bearerMatch) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: authData, error: authError } = await service.auth.getUser(bearerMatch[1]);
    if (authError || !authData.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const incoming = await req.formData();
    const image = incoming.get("image");
    const transactionValue = incoming.get("paymentTransactionId");
    paymentTransactionId = typeof transactionValue === "string" ? transactionValue.trim() : "";

    if (!paymentTransactionId) {
      return jsonResponse({ error: "Payment transaction id is required" }, 400);
    }

    if (!(image instanceof File)) {
      return jsonResponse({ error: "Payment-slip image is required" }, 400);
    }

    if (!ALLOWED_TYPES.has(image.type)) {
      return jsonResponse({ error: "Use a JPEG, PNG, GIF or WebP payment-slip image" }, 400);
    }

    if (image.size <= 0 || image.size > MAX_FILE_BYTES) {
      return jsonResponse({ error: "Payment-slip image must be 4 MB or smaller" }, 400);
    }

    const { data: payment, error: paymentError } = await service
      .from("payment_transactions")
      .select("id, order_id, customer_id, provider, amount_due, currency, status, expires_at, provider_transaction_ref")
      .eq("id", paymentTransactionId)
      .maybeSingle();

    if (paymentError) throw paymentError;
    if (!payment) return jsonResponse({ error: "Payment transaction not found" }, 404);
    if (payment.customer_id !== authData.user.id) {
      return jsonResponse({ error: "You may only verify payment for your own order" }, 403);
    }

    const { data: order, error: orderError } = await service
      .from("orders")
      .select("id, order_number, customer_id, payment_status, status")
      .eq("id", payment.order_id)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order || order.customer_id !== authData.user.id) {
      return jsonResponse({ error: "Order not found" }, 404);
    }

    if (payment.status === "verified" && order.payment_status === "paid") {
      return jsonResponse({
        state: "verified",
        payment_status: "paid",
        order_status: order.status,
        paymentTransactionId: payment.id,
        transRef: payment.provider_transaction_ref,
        message: "Payment was already verified.",
        idempotent_replay: true,
      });
    }

    if (["expired", "cancelled"].includes(payment.status) || new Date(payment.expires_at).getTime() <= Date.now()) {
      await service
        .from("payment_transactions")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", payment.id);
      return jsonResponse({ state: "expired", error: "Payment request has expired" }, 410);
    }

    if (order.payment_status === "paid") {
      return jsonResponse({ error: "Order is already paid" }, 409);
    }

    const storagePath = [
      authData.user.id,
      order.id,
      payment.id,
      `${crypto.randomUUID()}.${extensionFor(image.type)}`,
    ].join("/");

    const { error: uploadError } = await service.storage
      .from("payment-slips")
      .upload(storagePath, image, {
        contentType: image.type,
        upsert: false,
        cacheControl: "0",
      });

    if (uploadError) throw uploadError;

    const { data: attempt, error: attemptError } = await service
      .from("payment_slip_verifications")
      .insert({
        payment_transaction_id: payment.id,
        order_id: order.id,
        customer_id: authData.user.id,
        provider: "easyslip",
        status: "verifying",
        storage_path: storagePath,
        expected_amount: Number(payment.amount_due),
      })
      .select("id")
      .single();

    if (attemptError) throw attemptError;
    attemptId = attempt.id;

    await service
      .from("payment_transactions")
      .update({
        status: "verifying",
        last_error_code: null,
        last_error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    const easySlipForm = new FormData();
    easySlipForm.append("image", image, image.name || "payment-slip");
    easySlipForm.append("remark", order.order_number);
    easySlipForm.append("matchAccount", "true");
    easySlipForm.append("matchAmount", Number(payment.amount_due).toFixed(2));
    easySlipForm.append("checkDuplicate", "true");

    const easySlipResponse = await fetch("https://api.easyslip.com/v2/verify/bank", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requiredEnv("EASYSLIP_API_KEY")}`,
      },
      body: easySlipForm,
    });

    const payload = await easySlipResponse.json().catch(() => null) as EasySlipPayload | null;

    if (!easySlipResponse.ok || !payload?.success) {
      const code = payload?.error?.code || "EASYSLIP_ERROR";
      const providerMessage = payload?.error?.message || "EasySlip could not verify this payment slip.";

      if (code === "SLIP_PENDING") {
        await Promise.all([
          service.from("payment_slip_verifications").update({
            status: "pending",
            error_code: code,
            provider_message: providerMessage,
            completed_at: new Date().toISOString(),
          }).eq("id", attemptId),
          service.from("payment_transactions").update({
            status: "verifying",
            last_error_code: code,
            last_error_message: providerMessage,
            updated_at: new Date().toISOString(),
          }).eq("id", payment.id),
        ]);

        return jsonResponse({
          state: "pending",
          code,
          message: "The bank transaction is not available yet. JOKO will keep this payment pending; please retry in a few minutes.",
        }, 202);
      }

      await Promise.all([
        service.from("payment_slip_verifications").update({
          status: easySlipResponse.status >= 500 ? "provider_error" : "rejected",
          error_code: code,
          provider_message: providerMessage,
          completed_at: new Date().toISOString(),
        }).eq("id", attemptId),
        service.from("payment_transactions").update({
          status: "pending",
          last_error_code: code,
          last_error_message: providerMessage,
          updated_at: new Date().toISOString(),
        }).eq("id", payment.id),
      ]);

      console.error("EasySlip verification failed", { status: easySlipResponse.status, code });
      return jsonResponse({ state: "rejected", error: providerMessage, code }, easySlipResponse.status >= 500 ? 502 : 400);
    }

    const data = payload.data || {};
    const rawSlip = data.rawSlip || {};
    const matchedAccount = data.matchedAccount || null;
    const amountInSlip = Number.isFinite(Number(data.amountInSlip))
      ? Number(data.amountInSlip)
      : Number.isFinite(Number(rawSlip.amount?.amount))
        ? Number(rawSlip.amount?.amount)
        : null;
    const transRef = typeof rawSlip.transRef === "string" && rawSlip.transRef.trim()
      ? rawSlip.transRef.trim()
      : null;
    const accountMatched = Boolean(matchedAccount);
    const amountMatched = data.isAmountMatched === true;
    const providerDuplicate = data.isDuplicate === true;

    const rejectionCode = !accountMatched
      ? "ACCOUNT_MISMATCH"
      : !amountMatched
        ? "AMOUNT_MISMATCH"
        : providerDuplicate
          ? "DUPLICATE_SLIP"
          : !transRef
            ? "MISSING_TRANSACTION_REFERENCE"
            : null;

    await service
      .from("payment_slip_verifications")
      .update({
        status: rejectionCode ? "rejected" : "verified",
        provider_transaction_ref: transRef,
        amount_in_slip: amountInSlip,
        expected_amount: Number(payment.amount_due),
        amount_matched: amountMatched,
        account_matched: accountMatched,
        provider_duplicate: providerDuplicate,
        receiver_bank_short_code: matchedAccount?.bank?.shortCode || null,
        receiver_name: matchedAccount?.nameEn || matchedAccount?.nameTh || null,
        error_code: rejectionCode,
        provider_message: payload.message || null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", attemptId);

    if (rejectionCode) {
      const message = rejectionCode === "ACCOUNT_MISMATCH"
        ? "The payment was not sent to the registered JOKO receiving account."
        : rejectionCode === "AMOUNT_MISMATCH"
          ? "The bank transfer amount does not match this order."
          : rejectionCode === "DUPLICATE_SLIP"
            ? "This bank transaction has already been used."
            : "EasySlip did not return a bank transaction reference.";

      await service
        .from("payment_transactions")
        .update({
          status: "pending",
          last_error_code: rejectionCode,
          last_error_message: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);

      return jsonResponse({
        state: "rejected",
        code: rejectionCode,
        message,
        amountInSlip,
        expectedAmount: Number(payment.amount_due),
      }, 400);
    }

    const { data: finalized, error: finalizeError } = await service.rpc("finalize_verified_payment_v1", {
      p_payment_transaction_id: payment.id,
      p_provider_transaction_ref: transRef,
      p_amount_in_slip: amountInSlip,
      p_account_matched: accountMatched,
      p_amount_matched: amountMatched,
      p_provider_duplicate: providerDuplicate,
    });

    if (finalizeError) {
      await Promise.all([
        service.from("payment_slip_verifications").update({
          status: "rejected",
          error_code: "FINALIZE_REJECTED",
          provider_message: finalizeError.message,
          completed_at: new Date().toISOString(),
        }).eq("id", attemptId),
        service.from("payment_transactions").update({
          status: "pending",
          last_error_code: "FINALIZE_REJECTED",
          last_error_message: "The verified transaction could not be attached to this order.",
          updated_at: new Date().toISOString(),
        }).eq("id", payment.id),
      ]);
      console.error("Payment finalization rejected", { paymentTransactionId: payment.id, message: finalizeError.message });
      return jsonResponse({
        state: "rejected",
        code: "FINALIZE_REJECTED",
        message: "The verified transaction could not be attached to this order.",
      }, 409);
    }

    try {
      const notificationResponse = await fetch(
        `${requiredEnv("SUPABASE_URL")}/functions/v1/send-payment-confirmation`,
        {
          method: "POST",
          headers: {
            Authorization: authorization,
            apikey: requiredEnv("SUPABASE_ANON_KEY"),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ order_id: order.id }),
        },
      );

      if (!notificationResponse.ok && notificationResponse.status !== 202) {
        console.error("Payment confirmation notification could not be sent", {
          orderId: order.id,
          status: notificationResponse.status,
        });
      }
    } catch (notificationError) {
      console.error("Payment confirmation notification failed after successful payment", {
        orderId: order.id,
        message: notificationError instanceof Error ? notificationError.message : String(notificationError),
      });
    }

    try {
      const adminNotificationResponse = await fetch(
        `${requiredEnv("SUPABASE_URL")}/functions/v1/send-admin-order-notification`,
        {
          method: "POST",
          headers: {
            Authorization: authorization,
            apikey: requiredEnv("SUPABASE_ANON_KEY"),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ order_id: order.id }),
        },
      );

      if (!adminNotificationResponse.ok && adminNotificationResponse.status !== 202) {
        console.error("Admin order notification could not be released after payment", {
          orderId: order.id,
          status: adminNotificationResponse.status,
        });
      }
    } catch (adminNotificationError) {
      console.error("Admin order notification failed after successful payment", {
        orderId: order.id,
        message: adminNotificationError instanceof Error
          ? adminNotificationError.message
          : String(adminNotificationError),
      });
    }

    return jsonResponse({
      state: "verified",
      payment_status: finalized?.order?.payment_status || "paid",
      order_status: finalized?.order?.status || "confirmed",
      paymentTransactionId: payment.id,
      amountPaid: finalized?.order?.amount_paid ?? Number(payment.amount_due),
      transRef,
      message: "Payment verified. Your order is confirmed.",
      idempotent_replay: Boolean(finalized?.idempotent_replay),
    });
  } catch (error) {
    console.error("verify-payment-slip failed", {
      paymentTransactionId,
      attemptId,
      error: error instanceof Error ? error.message : String(error),
    });

    if (attemptId) {
      await service
        .from("payment_slip_verifications")
        .update({
          status: "provider_error",
          error_code: "INTERNAL_ERROR",
          provider_message: "Payment verification could not be completed.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", attemptId);
    }

    if (paymentTransactionId) {
      await service
        .from("payment_transactions")
        .update({
          status: "pending",
          last_error_code: "INTERNAL_ERROR",
          last_error_message: "Payment verification could not be completed.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentTransactionId);
    }

    return jsonResponse({ error: "Could not complete payment verification" }, 500);
  }
});
