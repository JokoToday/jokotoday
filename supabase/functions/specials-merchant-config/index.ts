import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { buildKShopMasterPayload } from "../_shared/kshop-master-qr.ts";
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
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return response({ error: "POST required" }, 405);
  try {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return response({ error: "Sign in required" }, 401);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(token);
    if (error || !user) return response({ error: "Sign in required" }, 401);
    const { data: profile } = await admin
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin")
      return response({ error: "Admin required" }, 403);
    const master = Deno.env.get("KSHOP_MASTER_QR_PAYLOAD")?.trim();
    if (!master) throw new Error("Master QR is not configured");
    buildKShopMasterPayload(master, 1); // Validate the same source the regular payment intent uses.
    return response({ qr_payload: master }); // Public merchant QR data only; never return API keys.
  } catch {
    return response(
      {
        error:
          "The existing K SHOP master QR is unavailable or invalid. Check its server configuration.",
      },
      409,
    );
  }
});
