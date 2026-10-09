import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
const env = (key: string) => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing ${key}`);
  return value;
};
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return response({ error: "POST required" }, 405);
  let attempt: string | null = null;
  const admin = createClient(
    env("SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
  try {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return response({ error: "Sign in required" }, 401);
    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(token);
    if (authError || !user) return response({ error: "Sign in required" }, 401);
    // Fail before creating an in-flight attempt if provider credentials are missing.
    const providerKey = env("EASYSLIP_API_KEY");
    const form = await req.formData();
    const order = String(form.get("order_id") || "");
    const file = form.get("slip");
    if (
      !/^[0-9a-f-]{36}$/i.test(order) ||
      !(file instanceof File) ||
      !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
        file.type,
      ) ||
      !file.size ||
      file.size > 4 * 1024 * 1024
    )
      return response({ error: "Choose a slip image up to 4 MB" }, 400);
    const { data: checkout, error: lookupError } = await admin
      .from("specials_checkouts")
      .select("order_id,customer_id")
      .eq("order_id", order)
      .eq("customer_id", user.id)
      .maybeSingle();
    if (lookupError || !checkout)
      return response({ error: "Checkout not found" }, 404);
    attempt = crypto.randomUUID();
    const path = `${user.id}/${order}/${attempt}`;
    const { error: uploadError } = await admin.storage
      .from("payment-slips")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    const { data: context, error: beginError } = await admin.rpc(
      "specials_begin_verification_v1",
      { p_order: order, p_customer: user.id, p_attempt: attempt, p_path: path },
    );
    if (beginError) {
      await admin.storage.from("payment-slips").remove([path]);
      return response({ error: beginError.message }, 409);
    }
    const providerForm = new FormData();
    providerForm.set("image", file);
    providerForm.set("matchAccount", "true");
    providerForm.set("matchAmount", String(context.amount));
    providerForm.set("checkDuplicate", "true");
    providerForm.set("remark", context.order_number);
    const result = await fetch("https://api.easyslip.com/v2/verify/bank", {
      method: "POST",
      headers: { Authorization: `Bearer ${providerKey}` },
      body: providerForm,
      signal: AbortSignal.timeout(25000),
    });
    const payload = await result.json();
    const data = payload.data;
    const evidence = {
      provider_success: result.ok && payload.success === true,
      reference: data?.rawSlip?.transRef,
      amount: data?.amountInSlip,
      paid_at: data?.rawSlip?.date,
      account_matched: !!data?.matchedAccount,
      bank_code: data?.matchedAccount?.bank?.shortCode,
      bank_number: data?.matchedAccount?.bankNumber,
      duplicate: data?.isDuplicate,
      error_code: payload.error?.code,
    };
    const { data: finished, error: finishError } = await admin.rpc(
      "specials_finish_verification_v1",
      { p_attempt: attempt, p_evidence: evidence },
    );
    if (finishError) throw finishError;
    if (finished.state === "verified") {
      // Existing durable notification events are committed with payment. Failures here do not change it.
      await Promise.allSettled(
        ["send-payment-confirmation", "send-admin-order-notification"].map(
          (slug) =>
            fetch(`${env("SUPABASE_URL")}/functions/v1/${slug}`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                apikey: env("SUPABASE_ANON_KEY"),
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ order_id: order }),
              signal: AbortSignal.timeout(10000),
            }),
        ),
      );
    }
    return response(finished);
  } catch {
    // Do not reset a registered hold on transport ambiguity. Expiry/grace and reconciliation handle it.
    return response(
      {
        state: attempt ? "verifying" : "error",
        error:
          "Verification could not complete. Refresh checkout status; do not pay again.",
      },
      503,
    );
  }
});
