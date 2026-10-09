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
  const admin = createClient(
    env("SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
  let batch: string | null = null;
  let claimed = false;
  try {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return response({ error: "Sign in required" }, 401);
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
    const channelToken = env("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN");
    const body = await req.json();
    batch = body.batch_id;
    if (!batch || !/^[0-9a-f-]{36}$/i.test(batch))
      return response({ error: "Batch required" }, 400);
    const { data: job, error: claimError } = await admin.rpc(
      "specials_line_action_v1",
      { p_action: "claim", p_batch: batch },
    );
    if (claimError) throw claimError;
    if (!job.send) return response(job);
    claimed = true;
    const sent = await fetch("https://api.line.me/v2/bot/message/broadcast", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${channelToken}`,
        "Content-Type": "application/json",
        "X-Line-Retry-Key": job.retry_key,
      },
      body: JSON.stringify({ messages: [{ type: "text", text: job.message }] }),
      signal: AbortSignal.timeout(20000),
    });
    const accepted =
      sent.ok ||
      (sent.status === 409 && !!sent.headers.get("x-line-accepted-request-id"));
    const result = {
      status: accepted
        ? "accepted"
        : sent.status >= 500 || sent.status === 429
          ? "uncertain"
          : "failed",
      request_id:
        sent.headers.get("x-line-accepted-request-id") ||
        sent.headers.get("x-line-request-id"),
      error: accepted ? null : `LINE HTTP ${sent.status}`,
    };
    const { data: finished, error: finishError } = await admin.rpc(
      "specials_line_action_v1",
      { p_action: "finish", p_batch: batch, p_result: result },
    );
    if (finishError) throw finishError;
    return response(finished);
  } catch {
    if (claimed && batch)
      await admin.rpc("specials_line_action_v1", {
        p_action: "finish",
        p_batch: batch,
        p_result: {
          status: "uncertain",
          error:
            "Transport or persistence failure; retry the same announcement",
        },
      });
    return response(
      {
        error:
          "Announcement could not be confirmed. Refresh its status before retrying.",
      },
      503,
    );
  }
});
