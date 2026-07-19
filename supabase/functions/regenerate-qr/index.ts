import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

const generateSecureToken = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ message: "Method not allowed" }, 405);
  }

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse({ message: "Authentication required" }, 401);
    }

    const accessToken = authorization.slice("Bearer ".length);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Server configuration is incomplete");
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await adminClient.auth.getUser(accessToken);

    if (authError || !user) {
      return jsonResponse({ message: "Invalid or expired session" }, 401);
    }

    const newToken = generateSecureToken();
    const { data: profile, error: updateError } = await adminClient
      .from("user_profiles")
      .update({ qr_token: newToken })
      .eq("id", user.id)
      .select("qr_token")
      .single();

    if (updateError || !profile) {
      throw updateError ?? new Error("Profile not found");
    }

    return jsonResponse({ qr_token: profile.qr_token }, 200);
  } catch {
    console.error("QR regeneration failed");
    return jsonResponse({ message: "Unable to regenerate QR code" }, 500);
  }
});
