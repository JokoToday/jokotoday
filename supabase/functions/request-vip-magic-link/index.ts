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

const parseAppOrigin = (value: string | undefined) => {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
};

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

    const defaultAppOrigin = parseAppOrigin(Deno.env.get("APP_URL"));
    if (!defaultAppOrigin) throw new Error("APP_URL is not configured correctly");

    const configuredOrigins = (Deno.env.get("ALLOWED_APP_URLS") || "")
      .split(",")
      .map(origin => parseAppOrigin(origin))
      .filter((origin): origin is string => Boolean(origin));
    const allowedOrigins = new Set([defaultAppOrigin, ...configuredOrigins]);
    const requestedOrigin = typeof payload.app_url === "string"
      ? parseAppOrigin(payload.app_url)
      : null;
    const resolvedAppUrl = requestedOrigin && allowedOrigins.has(requestedOrigin)
      ? requestedOrigin
      : defaultAppOrigin;

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, flowType: "implicit" },
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    console.error("VIP Magic Link request failed", { message });
    return jsonResponse({ ok: false, error: "request_failed" }, 500);
  }
});
