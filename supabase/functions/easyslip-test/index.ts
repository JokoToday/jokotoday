import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const EASYSLIP_URL = "https://api.easyslip.com/v2/verify/bank";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

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

function maskBankNumber(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const compact = value.replace(/\s+/g, "");
  if (compact.length <= 4) return compact;
  return `${"*".repeat(Math.max(0, compact.length - 4))}${compact.slice(-4)}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    const bearerMatch = authorization?.match(/^Bearer\s+(\S+)$/i);
    if (!bearerMatch) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data: authData, error: authError } = await supabase.auth.getUser(bearerMatch[1]);
    if (authError || !authData.user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (profile?.role !== "admin") return jsonResponse({ error: "Admin access required" }, 403);

    const requestForm = await req.formData();
    const image = requestForm.get("image");
    if (!(image instanceof File)) return jsonResponse({ error: "Slip image is required" }, 400);
    if (!ALLOWED_TYPES.has(image.type)) {
      return jsonResponse({ error: "Use a JPEG, PNG, GIF or WebP slip image" }, 400);
    }
    if (image.size <= 0 || image.size > MAX_IMAGE_BYTES) {
      return jsonResponse({ error: "Slip image must be 4 MB or smaller" }, 400);
    }

    const expectedAmountRaw = requestForm.get("expectedAmount");
    const expectedAmount = typeof expectedAmountRaw === "string" && expectedAmountRaw.trim() !== ""
      ? Number(expectedAmountRaw)
      : null;
    if (expectedAmount !== null && (!Number.isFinite(expectedAmount) || expectedAmount <= 0)) {
      return jsonResponse({ error: "Expected amount must be a positive number" }, 400);
    }

    const providerForm = new FormData();
    providerForm.append("image", image, image.name || "slip");
    providerForm.append("remark", "JOKO TODAY EasySlip proof-of-concept");
    providerForm.append("matchAccount", "true");
    providerForm.append("checkDuplicate", "true");
    if (expectedAmount !== null) providerForm.append("matchAmount", String(expectedAmount));

    const providerResponse = await fetch(EASYSLIP_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requiredEnv("EASYSLIP_API_KEY")}`,
      },
      body: providerForm,
    });

    const providerBody = await providerResponse.json().catch(() => null) as Record<string, any> | null;

    if (!providerResponse.ok || providerBody?.success !== true) {
      const code = providerBody?.error?.code ?? "EASYSLIP_ERROR";
      const message = providerBody?.error?.message ?? "EasySlip could not verify this slip";
      const pending = code === "SLIP_PENDING";
      return jsonResponse({
        success: false,
        pending,
        code,
        message: pending
          ? "EasySlip has received the slip but the bank transaction is still pending. Try again in a few minutes."
          : message,
      }, pending ? 202 : providerResponse.status || 400);
    }

    const data = providerBody.data ?? {};
    const rawSlip = data.rawSlip ?? {};
    const matchedAccount = data.matchedAccount ?? null;

    return jsonResponse({
      success: true,
      result: {
        duplicate: Boolean(data.isDuplicate),
        amountInSlip: Number(data.amountInSlip ?? rawSlip?.amount?.amount ?? 0),
        amountInOrder: data.amountInOrder ?? null,
        amountMatched: data.isAmountMatched ?? null,
        accountMatched: Boolean(matchedAccount),
        matchedAccount: matchedAccount
          ? {
              bank: matchedAccount.bank?.shortCode ?? matchedAccount.bank?.nameEn ?? null,
              nameTh: matchedAccount.nameTh ?? null,
              nameEn: matchedAccount.nameEn ?? null,
              type: matchedAccount.type ?? null,
              bankNumber: maskBankNumber(matchedAccount.bankNumber),
            }
          : null,
        transactionReference: rawSlip.transRef ?? null,
        transactionDate: rawSlip.date ?? null,
        receiverBank: rawSlip.receiver?.bank?.short ?? rawSlip.receiver?.bank?.name ?? null,
      },
      message: providerBody.message ?? "Bank slip verified successfully",
    });
  } catch (error) {
    console.error("EasySlip test verification failed", error);
    return jsonResponse({ error: "Could not verify the payment slip" }, 500);
  }
});
