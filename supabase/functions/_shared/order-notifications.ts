import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

export type NotificationType = "customer_confirmation" | "admin_new_order";
export type NotificationOutcome =
  | "claimed"
  | "already_sent"
  | "processing"
  | "uncertain"
  | "unavailable"
  | "unauthorized"
  | "invalid";

export interface ClaimResult {
  outcome: NotificationOutcome;
  event_id?: string;
  attempt_count?: number;
  language?: string | null;
}

export interface AuthenticatedRequest {
  supabase: SupabaseClient;
  user: User;
}

export type AuthResult =
  | { ok: true; value: AuthenticatedRequest }
  | { ok: false; response: Response };

export type ClaimModeResult =
  | { mode: "legacy" }
  | { mode: "outbox"; claim: ClaimResult }
  | { mode: "error"; error: unknown };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_ORIGINS = new Set([
  "https://joko.today",
  "https://www.joko.today",
  "https://jokotoday.pages.dev",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
]);

export function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.hostname.endsWith(".jokotoday.pages.dev");
  } catch {
    return false;
  }
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
    "Vary": "Origin",
  };
  if (origin && isAllowedOrigin(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

export function jsonResponse(req: Request, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

export function handlePreflight(req: Request): Response {
  if (!isAllowedOrigin(req.headers.get("Origin"))) {
    return new Response(null, { status: 403, headers: { "Vary": "Origin" } });
  }
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export function rejectDisallowedOrigin(req: Request): Response | null {
  if (isAllowedOrigin(req.headers.get("Origin"))) return null;
  return jsonResponse(req, 403, { error: "Origin not allowed" });
}

function readNamedKey(mapEnvName: string, legacyEnvName: string): string | null {
  const legacy = Deno.env.get(legacyEnvName);
  if (legacy) return legacy;
  const raw = Deno.env.get(mapEnvName);
  if (!raw) return null;
  try {
    const keys = JSON.parse(raw) as Record<string, unknown>;
    const value = keys.default;
    return typeof value === "string" && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export async function authenticateRequest(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, response: jsonResponse(req, 401, { error: "Authentication required" }) };
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return { ok: false, response: jsonResponse(req, 401, { error: "Authentication required" }) };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publicKey = readNamedKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
  if (!supabaseUrl || !publicKey) {
    console.error("SEC-005: Supabase public client environment is not configured");
    return { ok: false, response: jsonResponse(req, 500, { error: "Notification service unavailable" }) };
  }

  const supabase = createClient(supabaseUrl, publicKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    console.warn("SEC-005: authenticated notification request rejected", error?.message ?? "no user");
    return { ok: false, response: jsonResponse(req, 401, { error: "Authentication required" }) };
  }
  return { ok: true, value: { supabase, user } };
}

function createNotificationAdminClient(): SupabaseClient | null {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = readNamedKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !secretKey) {
    console.error("SEC-005: Supabase secret client environment is not configured");
    return null;
  }
  return createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function isMissingClaimRpc(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === "PGRST202"
    && typeof candidate.message === "string"
    && candidate.message.includes("claim_order_notification");
}

export async function claimNotification(
  _userSupabase: SupabaseClient,
  orderId: string,
  notificationType: NotificationType,
): Promise<ClaimModeResult> {
  const admin = createNotificationAdminClient();
  if (!admin) return { mode: "error", error: new Error("Notification admin client unavailable") };

  const { data, error } = await admin.rpc("claim_order_notification", {
    p_order_id: orderId,
    p_notification_type: notificationType,
  });

  // Rollout bridge: before SEC-005B is applied, SEC-005A still protects the
  // endpoint with JWT + explicit owner checks. Once the RPC exists, only the
  // server-side secret role can advance durable notification state.
  if (error && isMissingClaimRpc(error)) return { mode: "legacy" };
  if (error) return { mode: "error", error };
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { mode: "error", error: new Error("Invalid notification claim response") };
  }
  return { mode: "outbox", claim: data as ClaimResult };
}

export async function finishNotification(
  _userSupabase: SupabaseClient,
  eventId: string,
  outcome: "sent" | "failed" | "uncertain",
  providerMessageId: string | null,
  errorMessage: string | null,
): Promise<boolean> {
  const admin = createNotificationAdminClient();
  if (!admin) return false;

  const { data, error } = await admin.rpc("finish_order_notification", {
    p_event_id: eventId,
    p_outcome: outcome,
    p_provider_message_id: providerMessageId,
    p_error: errorMessage,
  });
  if (error || data !== true) {
    console.error("SEC-005: failed to persist notification outcome", {
      eventId,
      outcome,
      code: error?.code,
      message: error?.message,
    });
    return false;
  }
  return true;
}

export function notificationIdempotencyKey(type: NotificationType, orderId: string): string {
  return `order-${type}/${orderId}`;
}

export function providerErrorSummary(error: unknown): string {
  if (!error) return "Notification provider returned an unspecified error";
  if (typeof error === "string") return error.slice(0, 900);
  if (error instanceof Error) return error.message.slice(0, 900);
  if (typeof error === "object") {
    const candidate = error as { name?: unknown; code?: unknown; message?: unknown };
    const parts = [candidate.name, candidate.code, candidate.message]
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    if (parts.length > 0) return parts.join(": ").slice(0, 900);
  }
  return "Notification provider returned an unspecified error";
}
