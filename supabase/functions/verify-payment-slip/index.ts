import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { verifyWithEasySlip } from "./easyslip.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

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

function extensionFor(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/gif") return "gif";
  if (file.type === "image/webp") return "webp";
  return "jpg";
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
  );

  let verificationId: string | null = null;
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
    const orderIdValue = incoming.get("order_id");
    const image = incoming.get("image");

    const orderId = typeof orderIdValue === "string" ? orderIdValue.trim() : "";
    if (!orderId) return jsonResponse({ error: "Order id is required" }, 400);
    if (!(image instanceof File)) {
      return jsonResponse({ error: "Payment-slip image is required" }, 400);
    }
    if (!ALLOWED_TYPES.has(image.type)) {
      return jsonResponse({ error: "Use a JPEG, PNG, GIF or WebP payment-slip image" }, 400);
    }
    if (image.size <= 0 || image.size > MAX_FILE_BYTES) {
      return jsonResponse({ error: "Payment-slip image must be 4 MB or smaller" }, 400);
    }

    const { data: order, error: orderError } = await service
      .from("orders")
      .select("id, order_number, customer_id, total_amount, loyalty_discount_amount, payment_status, payment_method, payment_due_at, status, created_at")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return jsonResponse({ error: "Order not found" }, 404);
    if (order.customer_id !== authData.user.id) {
      return jsonResponse({ error: "You may only verify payment for your own order" }, 403);
    }
    if (order.payment_status === "paid") {
      return jsonResponse({
        state: "paid",
        order_id: order.id,
        order_number: order.order_number,
        message: "Payment is already confirmed.",
      });
    }
    if (order.payment_method !== "promptpay_online") {
      return jsonResponse({ error: "This order is not awaiting online PromptPay payment" }, 409);
    }
    if (order.status === "cancelled") {
      return jsonResponse({ error: "This order has been cancelled" }, 409);
    }

    const { data: payment, error: paymentError } = await service
      .from("payment_transactions")
      .select("id, customer_id, expected_amount, status, payment_due_at, verification_provider")
      .eq("context_type", "regular_order")
      .eq("context_id", order.id)
      .maybeSingle();

    if (paymentError) throw paymentError;
    if (!payment) {
      return jsonResponse({ error: "PromptPay payment has not been started for this order" }, 409);
    }
    paymentTransactionId = payment.id;

    if (payment.customer_id !== authData.user.id) {
      return jsonResponse({ error: "Payment ownership mismatch" }, 403);
    }
    if (payment.status === "paid") {
      return jsonResponse({
        state: "paid",
        order_id: order.id,
        order_number: order.order_number,
        message: "Payment is already confirmed.",
      });
    }
    if (["expired", "refund_pending", "refunded"].includes(payment.status)) {
      return jsonResponse({ error: "This payment can no longer be verified" }, 409);
    }
    if (payment.payment_due_at && Date.now() > new Date(payment.payment_due_at).getTime()) {
      return jsonResponse({ error: "The payment deadline for this order has passed" }, 409);
    }

    const expectedAmount = Number(payment.expected_amount);
    if (!Number.isFinite(expectedAmount) || expectedAmount < 0) {
      throw new Error("Stored payment amount is invalid");
    }

    const { data: verification, error: verificationError } = await service
      .from("payment_slip_verifications")
      .insert({
        payment_transaction_id: payment.id,
        provider: "easyslip",
        expected_amount: expectedAmount,
        verification_status: "uploaded",
      })
      .select("id")
      .single();

    if (verificationError) throw verificationError;
    verificationId = verification.id;

    const storagePath = `${authData.user.id}/${payment.id}/${verification.id}.${extensionFor(image)}`;

    const { error: storageError } = await service.storage
      .from("payment-slips")
      .upload(storagePath, image, {
        contentType: image.type,
        upsert: false,
      });

    if (storageError) throw storageError;

    await service
      .from("payment_slip_verifications")
      .update({
        storage_path: storagePath,
        verification_status: "verifying",
        updated_at: new Date().toISOString(),
      })
      .eq("id", verification.id);

    await service
      .from("payment_transactions")
      .update({
        status: "verifying",
        last_error_code: null,
        last_error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    const result = await verifyWithEasySlip({
      image,
      expectedAmount,
      remark: order.order_number,
    });

    if (result.state === "pending") {
      await service
        .from("payment_slip_verifications")
        .update({
          verification_status: "pending",
          error_code: result.code,
          error_message: result.message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", verification.id);

      await service
        .from("payment_transactions")
        .update({
          status: "verifying",
          last_error_code: result.code,
          last_error_message: result.message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);

      return jsonResponse({
        state: "pending",
        message: "We received your slip but could not verify it yet. We will keep it for retry.",
      }, 202);
    }

    if (result.state === "rejected") {
      await service
        .from("payment_slip_verifications")
        .update({
          verification_status: "rejected",
          error_code: result.code,
          error_message: result.message,
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", verification.id);

      await service
        .from("payment_transactions")
        .update({
          status: "failed",
          last_error_code: result.code,
          last_error_message: result.message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);

      return jsonResponse({
        state: "rejected",
        code: result.code,
        message: result.code === "SLIP_NOT_FOUND"
          ? "We could not read this payment slip. Please upload the original slip image from your banking app."
          : "We could not verify this payment slip.",
      }, 400);
    }

    const transactionAt = result.transactionDate
      ? new Date(result.transactionDate)
      : null;
    const transactionAtIso = transactionAt && !Number.isNaN(transactionAt.getTime())
      ? transactionAt.toISOString()
      : null;
    const orderCreatedAt = new Date(order.created_at);

    let rejectionCode: string | null = null;
    let rejectionMessage: string | null = null;

    if (!result.receiverMatched) {
      rejectionCode = "RECEIVER_MISMATCH";
      rejectionMessage = "We could not verify this payment to the JOKO account.";
    } else if (!result.amountMatched || result.amount === null || Number(result.amount.toFixed(2)) !== Number(expectedAmount.toFixed(2))) {
      rejectionCode = "AMOUNT_MISMATCH";
      rejectionMessage = "The transferred amount does not match this order.";
    } else if (result.duplicate) {
      rejectionCode = "DUPLICATE_TRANSACTION";
      rejectionMessage = "This payment slip has already been used.";
    } else if (!result.transactionRef) {
      rejectionCode = "TRANSACTION_REFERENCE_MISSING";
      rejectionMessage = "The banking transaction reference could not be verified.";
    } else if (!transactionAtIso) {
      rejectionCode = "TRANSACTION_TIME_UNAVAILABLE";
      rejectionMessage = "The banking transaction time could not be verified.";
    } else if (!Number.isNaN(orderCreatedAt.getTime()) && transactionAt!.getTime() < orderCreatedAt.getTime()) {
      rejectionCode = "TRANSACTION_BEFORE_ORDER";
      rejectionMessage = "This transaction was created before the order.";
    }

    if (rejectionCode) {
      await service
        .from("payment_slip_verifications")
        .update({
          provider_transaction_ref: result.transactionRef,
          verified_amount: result.amount,
          receiver_matched: result.receiverMatched,
          amount_matched: result.amountMatched,
          duplicate_detected: result.duplicate,
          transaction_at: transactionAtIso,
          verification_status: "rejected",
          error_code: rejectionCode,
          error_message: rejectionMessage,
          provider_data: result.safeProviderData,
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", verification.id);

      await service
        .from("payment_transactions")
        .update({
          status: "failed",
          last_error_code: rejectionCode,
          last_error_message: rejectionMessage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);

      return jsonResponse({
        state: "rejected",
        code: rejectionCode,
        message: rejectionMessage,
        expected_amount: expectedAmount,
        verified_amount: result.amount,
      }, 400);
    }

    await service
      .from("payment_slip_verifications")
      .update({
        provider_transaction_ref: result.transactionRef,
        verified_amount: result.amount,
        receiver_matched: true,
        amount_matched: true,
        duplicate_detected: false,
        transaction_at: transactionAtIso,
        verification_status: "verified",
        provider_data: result.safeProviderData,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", verification.id);

    const { data: finalization, error: finalizationError } = await service.rpc(
      "finalize_verified_payment_v1",
      {
        p_payment_transaction_id: payment.id,
        p_verification_id: verification.id,
        p_provider_transaction_ref: result.transactionRef,
        p_verified_amount: result.amount,
        p_paid_at: transactionAtIso,
      },
    );

    if (finalizationError) {
      const duplicate = /already been used|unique/i.test(finalizationError.message || "");
      await service
        .from("payment_slip_verifications")
        .update({
          verification_status: duplicate ? "rejected" : "error",
          error_code: duplicate ? "DUPLICATE_TRANSACTION" : "FINALIZATION_FAILED",
          error_message: duplicate
            ? "This banking transaction has already been used."
            : "The verified payment could not be finalized automatically.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", verification.id);

      await service
        .from("payment_transactions")
        .update({
          status: duplicate ? "failed" : "exception",
          last_error_code: duplicate ? "DUPLICATE_TRANSACTION" : "FINALIZATION_FAILED",
          last_error_message: duplicate
            ? "This banking transaction has already been used."
            : "Verified payment requires finalization retry.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);

      if (duplicate) {
        return jsonResponse({
          state: "rejected",
          code: "DUPLICATE_TRANSACTION",
          message: "This payment slip has already been used.",
        }, 409);
      }

      console.error("Verified payment finalization failed", {
        orderId: order.id,
        paymentTransactionId: payment.id,
        verificationId: verification.id,
      });

      return jsonResponse({
        state: "pending",
        code: "FINALIZATION_FAILED",
        message: "Your payment was verified, but confirmation is still being finalized. You do not need to upload the slip again.",
      }, 202);
    }

    return jsonResponse({
      state: "paid",
      order_id: order.id,
      order_number: order.order_number,
      amount: expectedAmount,
      payment_transaction_id: payment.id,
      message: "Payment confirmed.",
      finalization,
    });
  } catch (error) {
    console.error("Payment slip verification failed", {
      paymentTransactionId,
      verificationId,
      error: error instanceof Error ? error.message : "unknown",
    });

    if (verificationId) {
      await service
        .from("payment_slip_verifications")
        .update({
          verification_status: "error",
          error_code: "INTERNAL_ERROR",
          error_message: "Payment verification could not be completed.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", verificationId);
    }

    if (paymentTransactionId) {
      await service
        .from("payment_transactions")
        .update({
          status: "exception",
          last_error_code: "INTERNAL_ERROR",
          last_error_message: "Payment verification could not be completed.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentTransactionId);
    }

    return jsonResponse({ error: "Could not complete payment verification" }, 500);
  }
});
