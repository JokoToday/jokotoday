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

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => null) as { token?: string } | null;
    const token = body?.token?.trim();
    if (!token || token.length < 32 || token.length > 128) return json({ error: "Invalid pickup confirmation" }, 400);

    const service = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false },
    });

    const tokenHash = await sha256Hex(token);
    const { data: handoff, error: handoffError } = await service
      .from("pickup_handover_sessions")
      .select("id, status, expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (handoffError) throw handoffError;
    if (!handoff) return json({ error: "Pickup confirmation not found" }, 404);
    if (handoff.status === "expired" || new Date(handoff.expires_at).getTime() <= Date.now()) {
      if (handoff.status === "active") {
        await service.from("pickup_handover_sessions")
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("id", handoff.id);
      }
      return json({ error: "Pickup confirmation has expired", state: "expired" }, 410);
    }
    if (handoff.status === "cancelled") return json({ error: "Pickup confirmation is no longer active" }, 409);

    const { data, error } = await service.rpc("finalize_pickup_handover_v1", {
      p_handoff_id: handoff.id,
      p_bypass_reason: null,
    });

    if (error) throw error;

    return json({ state: "completed", result: data });
  } catch (error) {
    console.error("confirm-pickup-receipt failed", error);
    return json({ error: error instanceof Error ? error.message : "Could not confirm pickup receipt" }, 500);
  }
});
