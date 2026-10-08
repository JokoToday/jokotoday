import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

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

function maskAccount(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.trim();
  if (normalized.length <= 4) return "*".repeat(normalized.length);
  return `${"*".repeat(Math.max(2, normalized.length - 4))}${normalized.slice(-4)}`;
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

    const supabase = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data: authData, error: authError } = await supabase.auth.getUser(bearerMatch[1]);
    if (authError || !authData.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (profile?.role !== "admin") {
      return jsonResponse({ error: "Admin access required" }, 403);
    }

    const incoming = await req.formData();
    const image = incoming.get("image");
    const remarkValue = incoming.get("remark");

    if (!(image instanceof File)) {
      return jsonResponse({ error: "Payment-slip image is required" }, 400);
    }

    if (!ALLOWED_TYPES.has(image.type)) {
      return jsonResponse({ error: "Use a JPEG, PNG, GIF or WebP payment-slip image" }, 400);
    }

    if (image.size <= 0 || image.size > MAX_FILE_BYTES) {
      return jsonResponse({ error: "Payment-slip image must be 4 MB or smaller" }, 400);
    }

    const remark = typeof remarkValue === "string" && remarkValue.trim()
      ? remarkValue.trim().slice(0, 255)
      : "JOKO-EASYSLIP-POC";

    const easySlipForm = new FormData();
    easySlipForm.append("image", image, image.name || "payment-slip");
    easySlipForm.append("remark", remark);
    easySlipForm.append("matchAccount", "true");
    easySlipForm.append("checkDuplicate", "true");

    const easySlipResponse = await fetch("https://api.easyslip.com/v2/verify/bank", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requiredEnv("EASYSLIP_API_KEY")}`,
      },
      body: easySlipForm,
    });

    const easySlipPayload = await easySlipResponse.json().catch(() => null) as {
      success?: boolean;
      message?: string;
      error?: { code?: string; message?: string };
      data?: {
        isDuplicate?: boolean;
        amountInSlip?: number;
        matchedAccount?: {
          bank?: { nameEn?: string; nameTh?: string; shortCode?: string };
          nameTh?: string;
          nameEn?: string;
          type?: string;
          bankNumber?: string;
        } | null;
        rawSlip?: {
          amount?: { amount?: number };
          transRef?: string;
          date?: string;
        };
      };
    } | null;

    if (!easySlipResponse.ok || !easySlipPayload?.success) {
      const providerError = easySlipPayload?.error;
      const code = typeof providerError?.code === "string" ? providerError.code : "EASYSLIP_ERROR";
      const message = typeof providerError?.message === "string"
        ? providerError.message
        : "EasySlip could not verify this payment slip.";

      if (code === "SLIP_PENDING") {
        return jsonResponse({
          state: "pending",
          code,
          message: "EasySlip has received the slip, but the bank transaction is not available yet. Please retry in a few minutes.",
        }, 202);
      }

      console.error("EasySlip verification failed", {
        status: easySlipResponse.status,
        code,
      });

      return jsonResponse({ error: message, code }, easySlipResponse.status >= 500 ? 502 : 400);
    }

    const data = easySlipPayload.data || {};
    const matchedAccount = data.matchedAccount || null;
    const rawSlip = data.rawSlip || {};

    return jsonResponse({
      state: "verified",
      message: easySlipPayload.message || "Bank slip verified successfully.",
      isDuplicate: Boolean(data.isDuplicate),
      matchedAccount: matchedAccount
        ? {
            bankName: matchedAccount.bank?.nameEn || matchedAccount.bank?.nameTh || null,
            bankShortCode: matchedAccount.bank?.shortCode || null,
            nameTh: matchedAccount.nameTh || null,
            nameEn: matchedAccount.nameEn || null,
            type: matchedAccount.type || null,
            bankNumberMasked: maskAccount(matchedAccount.bankNumber),
          }
        : null,
      amountInSlip: Number.isFinite(Number(data.amountInSlip))
        ? Number(data.amountInSlip)
        : Number.isFinite(Number(rawSlip.amount?.amount))
          ? Number(rawSlip.amount.amount)
          : null,
      transRef: typeof rawSlip.transRef === "string" ? rawSlip.transRef : null,
      transactionDate: typeof rawSlip.date === "string" ? rawSlip.date : null,
    });
  } catch (error) {
    console.error("EasySlip payment test failed", error);
    return jsonResponse({ error: "Could not complete EasySlip verification" }, 500);
  }
});
