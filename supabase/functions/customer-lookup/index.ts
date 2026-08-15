import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const customerFields =
  "id, name, email, phone, line_id, whatsapp, wechat_id, qr_token, short_code";
const customerFieldsWithLoyalty = `${customerFields}, loyalty_points`;
const memberCodePattern = /^VIP\d+$/i;
const qrTokenPattern = /^[A-Za-z0-9_-]{8,}$/;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function findByToken(
  supabase: ReturnType<typeof createClient>,
  table: "user_profiles" | "customers",
  fields: string,
  token: string,
) {
  const byQrToken = await supabase
    .from(table)
    .select(fields)
    .eq("qr_token", token)
    .maybeSingle();
  if (byQrToken.error) throw byQrToken.error;
  if (byQrToken.data) return byQrToken.data;

  const byShortCode = await supabase
    .from(table)
    .select(fields)
    .eq("short_code", token)
    .maybeSingle();
  if (byShortCode.error) throw byShortCode.error;
  return byShortCode.data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authorization = req.headers.get("Authorization");
    const bearerMatch = authorization?.match(/^Bearer\s+(\S+)$/i);
    if (!bearerMatch) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: authData, error: authError } = await supabase.auth.getUser(
      bearerMatch[1],
    );
    if (authError || !authData.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: callerProfile, error: roleError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (roleError) throw roleError;

    if (callerProfile?.role !== "staff" && callerProfile?.role !== "admin") {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid request body" }, 400);
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return jsonResponse({ error: "Invalid request body" }, 400);
    }

    const rawToken = (body as Record<string, unknown>).token;
    if (typeof rawToken !== "string" || !rawToken.trim()) {
      return jsonResponse({ error: "Missing token" }, 400);
    }

    const trimmedToken = rawToken.trim();
    if (!memberCodePattern.test(trimmedToken) && !qrTokenPattern.test(trimmedToken)) {
      return jsonResponse({ error: "Invalid token" }, 400);
    }
    const token = memberCodePattern.test(trimmedToken)
      ? trimmedToken.toUpperCase()
      : trimmedToken;

    // 1. Try user_profiles
    const profile = await findByToken(
      supabase,
      "user_profiles",
      customerFields,
      token,
    );

    if (profile) {
      const { data: customer, error: loyaltyError } = await supabase
        .from("customers")
        .select("loyalty_points")
        .eq("id", profile.id)
        .maybeSingle();
      if (loyaltyError) throw loyaltyError;

      return jsonResponse({
        ...profile,
        loyalty_points: customer?.loyalty_points ?? 0,
      }, 200);
    }

    // 2. Fallback to customers
    const customer = await findByToken(
      supabase,
      "customers",
      customerFieldsWithLoyalty,
      token,
    );

    if (customer) {
      return jsonResponse(customer, 200);
    }

    return jsonResponse(null, 200);
  } catch (err) {
    console.error("Customer lookup failed", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
