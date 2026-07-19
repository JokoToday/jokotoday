import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
};

const normalizeOrigin = (value: string) => value.replace(/\/+$/, "");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  try {
    const payload = await req.json().catch(() => ({}));
    const shortCode = typeof payload.short_code === "string"
      ? payload.short_code.trim().toUpperCase()
      : "";

    if (shortCode.length > 24 || !/^VIP[0-9]{1,12}$/.test(shortCode)) {
      return jsonResponse({ ok: false, error: "invalid_short_code" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error("Server configuration is incomplete");
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const forwardedFor = req.headers.get("cf-connecting-ip")
      || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || "unknown";
    const [ipHash, codeHash] = await Promise.all([
      sha256(`ip:${forwardedFor}`),
      sha256(`code:${shortCode}`),
    ]);
    const { data: allowed, error: rateLimitError } = await adminClient.rpc(
      "check_vip_magic_link_rate_limit",
      { p_ip_hash: ipHash, p_code_hash: codeHash },
    );

    if (rateLimitError) throw rateLimitError;
    if (!allowed) return jsonResponse({ ok: true });

    const { data: profile, error: lookupError } = await adminClient
      .from("user_profiles")
      .select("id")
      .eq("short_code", shortCode)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!profile?.id) return jsonResponse({ ok: true });

    const { data: authUserData, error: authUserError } = await adminClient.auth.admin
      .getUserById(profile.id);
    const email = authUserData.user?.email;
    if (authUserError || !email) return jsonResponse({ ok: true });

    const productionOrigin = normalizeOrigin(
      Deno.env.get("APP_URL") || "https://jokotoday.pages.dev",
    );
    const configuredOrigins = (Deno.env.get("ALLOWED_AUTH_REDIRECT_ORIGINS") || "")
      .split(",")
      .map(origin => normalizeOrigin(origin.trim()))
      .filter(Boolean);
    const allowedOrigins = new Set([
      productionOrigin,
      "http://localhost:5173",
      "http://localhost:4173",
      ...configuredOrigins,
    ]);
    const requestedOrigin = typeof payload.redirect_origin === "string"
      ? normalizeOrigin(payload.redirect_origin)
      : "";
    const resolvedAppUrl = allowedOrigins.has(requestedOrigin) ? requestedOrigin : productionOrigin;

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: otpError } = await authClient.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${resolvedAppUrl}/auth/callback`,
        shouldCreateUser: false,
      },
    });

    if (otpError) throw otpError;
    return jsonResponse({ ok: true });
  } catch {
    console.error("VIP Magic Link request failed");
    return jsonResponse({ ok: false, error: "request_failed" }, 500);
  }
});
