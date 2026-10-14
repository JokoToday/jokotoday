import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const bearer = req.headers.get("Authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!bearer) return json({ error: "Unauthorized" }, 401);

    const service = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false },
    });

    const { data: authData, error: authError } = await service.auth.getUser(bearer);
    if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

    const { data: profile } = await service
      .from("user_profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (!profile || !["staff", "admin"].includes(profile.role)) return json({ error: "Staff access required" }, 403);

    const body = await req.json().catch(() => null) as { handoffId?: string; reason?: string } | null;
    const handoffId = body?.handoffId?.trim();
    const reason = body?.reason?.trim();
    if (!handoffId) return json({ error: "Handover id is required" }, 400);
    if (!reason || reason.length < 3 || reason.length > 200) return json({ error: "A short bypass reason is required" }, 400);

    const { data: handoff } = await service
      .from("pickup_handover_sessions")
      .select("id, staff_id, status")
      .eq("id", handoffId)
      .maybeSingle();
    if (!handoff) return json({ error: "Pickup handover not found" }, 404);
    if (handoff.staff_id !== authData.user.id && profile.role !== "admin") {
      return json({ error: "Only the initiating staff member or an admin can bypass confirmation" }, 403);
    }

    const { data, error } = await service.rpc("finalize_pickup_handover_v1", {
      p_handoff_id: handoff.id,
      p_bypass_reason: reason,
    });
    if (error) throw error;

    return json({ state: "completed", bypassed: true, result: data });
  } catch (error) {
    console.error("bypass-pickup-receipt failed", error);
    return json({ error: error instanceof Error ? error.message : "Could not complete pickup" }, 500);
  }
});
