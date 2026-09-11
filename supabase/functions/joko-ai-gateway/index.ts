import { serve } from "https://deno.land/std/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, x-joko-task-class",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const noStoreHeaders = {
  ...corsHeaders,
  "Cache-Control": "no-store",
};

const OLLAMA_BASE_URL = Deno.env.get("OLLAMA_BASE_URL") || "https://ollama.com/v1";
const OPENROUTER_BASE_URL = Deno.env.get("OPENROUTER_BASE_URL") || "https://openrouter.ai/api/v1";

type TextTier = "economy" | "standard" | "premium";
type ImageTier = "draft" | "standard" | "premium";
type ProviderName = "ollama-cloud" | "openrouter";

interface ProviderRoute {
  provider: ProviderName;
  model: string;
}

interface TextRoute {
  alias: string;
  tier: TextTier;
  primary: ProviderRoute;
  fallback: ProviderRoute;
}

interface ImageRoute {
  alias: string;
  tier: ImageTier;
  provider: "openrouter";
  model: string;
}

interface PricingEntry {
  input_per_million?: number;
  cached_input_per_million?: number;
  output_per_million?: number;
}

interface UsageShape {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
}

function env(name: string, fallback: string): string {
  const value = Deno.env.get(name)?.trim();
  return value || fallback;
}

const textRoutes: Record<TextTier, TextRoute> = {
  economy: {
    alias: "joko/economy",
    tier: "economy",
    primary: {
      provider: "ollama-cloud",
      model: env("JOKO_AI_OLLAMA_ECONOMY_MODEL", "glm-5.3-flash"),
    },
    fallback: {
      provider: "openrouter",
      model: env("JOKO_AI_OPENROUTER_ECONOMY_MODEL", "openrouter/auto"),
    },
  },
  standard: {
    alias: "joko/standard",
    tier: "standard",
    primary: {
      provider: "ollama-cloud",
      model: env("JOKO_AI_OLLAMA_STANDARD_MODEL", "gpt-oss:120b"),
    },
    fallback: {
      provider: "openrouter",
      model: env("JOKO_AI_OPENROUTER_STANDARD_MODEL", "openrouter/auto"),
    },
  },
  premium: {
    alias: "joko/premium",
    tier: "premium",
    primary: {
      provider: "ollama-cloud",
      model: env("JOKO_AI_OLLAMA_PREMIUM_MODEL", "deepseek-v4-pro"),
    },
    fallback: {
      provider: "openrouter",
      model: env("JOKO_AI_OPENROUTER_PREMIUM_MODEL", "openrouter/auto"),
    },
  },
};

const imageRoutes: Record<ImageTier, ImageRoute> = {
  draft: {
    alias: "joko/image-draft",
    tier: "draft",
    provider: "openrouter",
    model: env("JOKO_AI_IMAGE_DRAFT_MODEL", "google/gemini-3.1-flash-lite-image"),
  },
  standard: {
    alias: "joko/image-standard",
    tier: "standard",
    provider: "openrouter",
    model: env("JOKO_AI_IMAGE_STANDARD_MODEL", "google/gemini-3.1-flash-image"),
  },
  premium: {
    alias: "joko/image-premium",
    tier: "premium",
    provider: "openrouter",
    model: env("JOKO_AI_IMAGE_PREMIUM_MODEL", "openai/gpt-image-2.5-sunburst"),
  },
};

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...noStoreHeaders,
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function isAuthorized(req: Request): boolean {
  const expected = Deno.env.get("JOKO_AI_GATEWAY_KEY")?.trim();
  if (!expected) return false;
  const authorization = req.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return Boolean(match && constantTimeEqual(match[1], expected));
}

function requestId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizePath(url: string): string {
  const pathname = new URL(url).pathname.replace(/\/+$/, "");
  const marker = "/joko-ai-gateway";
  const index = pathname.indexOf(marker);
  return index >= 0 ? pathname.slice(index + marker.length) || "/" : pathname;
}

function textTierFromModel(model: unknown, taskHeader: string | null): TextTier | null {
  const normalizedTask = taskHeader?.trim().toLowerCase();
  if (normalizedTask === "economy" || normalizedTask === "standard" || normalizedTask === "premium") {
    return normalizedTask;
  }

  if (typeof model !== "string") return null;
  const normalized = model.trim().toLowerCase();
  if (normalized === "joko/economy") return "economy";
  if (normalized === "joko/standard") return "standard";
  if (normalized === "joko/premium") return "premium";
  return null;
}

function imageTierFromModel(model: unknown, taskHeader: string | null): ImageTier | null {
  const normalizedTask = taskHeader?.trim().toLowerCase();
  if (normalizedTask === "image-draft" || normalizedTask === "draft") return "draft";
  if (normalizedTask === "image-standard") return "standard";
  if (normalizedTask === "image-premium") return "premium";

  if (typeof model !== "string") return null;
  const normalized = model.trim().toLowerCase();
  if (normalized === "joko/image-draft") return "draft";
  if (normalized === "joko/image-standard") return "standard";
  if (normalized === "joko/image-premium") return "premium";
  return null;
}

function providerKey(provider: ProviderName): string | null {
  if (provider === "ollama-cloud") return Deno.env.get("OLLAMA_API_KEY")?.trim() || null;
  return Deno.env.get("OPENROUTER_API_KEY")?.trim() || null;
}

function providerBaseUrl(provider: ProviderName): string {
  return provider === "ollama-cloud" ? OLLAMA_BASE_URL : OPENROUTER_BASE_URL;
}

function pricingTable(): Record<string, PricingEntry> {
  const raw = Deno.env.get("JOKO_AI_PRICING_JSON")?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, PricingEntry>
      : {};
  } catch {
    console.error(JSON.stringify({ event: "joko_ai_pricing_config_error" }));
    return {};
  }
}

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function usageFromPayload(payload: unknown): UsageShape | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const usage = (payload as { usage?: unknown }).usage;
  return usage && typeof usage === "object" && !Array.isArray(usage) ? usage as UsageShape : null;
}

function estimateTextCost(provider: ProviderName, model: string, usage: UsageShape | null): number | null {
  if (!usage) return null;
  const reported = numeric(usage.cost);
  if (reported !== null) return reported;

  const entry = pricingTable()[`${provider}:${model}`];
  if (!entry) return null;

  const promptTokens = numeric(usage.prompt_tokens) ?? 0;
  const completionTokens = numeric(usage.completion_tokens) ?? 0;
  const cachedTokens = numeric(usage.prompt_tokens_details?.cached_tokens) ?? 0;
  const billablePrompt = Math.max(0, promptTokens - cachedTokens);

  const inputRate = numeric(entry.input_per_million) ?? 0;
  const cachedRate = numeric(entry.cached_input_per_million) ?? inputRate;
  const outputRate = numeric(entry.output_per_million) ?? 0;

  return (billablePrompt / 1_000_000) * inputRate
    + (cachedTokens / 1_000_000) * cachedRate
    + (completionTokens / 1_000_000) * outputRate;
}

function gatewayHeaders(input: {
  id: string;
  route: string;
  provider: ProviderName;
  model: string;
  fallbackUsed: boolean;
  latencyMs: number;
  costUsd?: number | null;
}): Headers {
  const headers = new Headers(noStoreHeaders);
  headers.set("X-JOKO-AI-Request-ID", input.id);
  headers.set("X-JOKO-AI-Route", input.route);
  headers.set("X-JOKO-AI-Provider", input.provider);
  headers.set("X-JOKO-AI-Model", input.model);
  headers.set("X-JOKO-AI-Fallback-Used", String(input.fallbackUsed));
  headers.set("X-JOKO-AI-Latency-Ms", String(input.latencyMs));
  if (typeof input.costUsd === "number" && Number.isFinite(input.costUsd)) {
    headers.set("X-JOKO-AI-Cost-USD", input.costUsd.toFixed(8));
  }
  return headers;
}

function logUsage(input: {
  id: string;
  kind: "chat" | "image";
  route: string;
  provider: ProviderName;
  model: string;
  fallbackUsed: boolean;
  latencyMs: number;
  ok: boolean;
  status: number;
  streaming?: boolean;
  usage?: UsageShape | null;
  costUsd?: number | null;
}) {
  console.log(JSON.stringify({
    event: "joko_ai_usage",
    request_id: input.id,
    kind: input.kind,
    route: input.route,
    provider: input.provider,
    model: input.model,
    fallback_used: input.fallbackUsed,
    latency_ms: input.latencyMs,
    ok: input.ok,
    status: input.status,
    streaming: input.streaming ?? false,
    prompt_tokens: input.usage?.prompt_tokens ?? null,
    completion_tokens: input.usage?.completion_tokens ?? null,
    total_tokens: input.usage?.total_tokens ?? null,
    cached_tokens: input.usage?.prompt_tokens_details?.cached_tokens ?? null,
    cost_usd: input.costUsd ?? null,
  }));
}

async function callChatProvider(route: ProviderRoute, requestBody: Record<string, unknown>): Promise<Response> {
  const key = providerKey(route.provider);
  if (!key) throw new Error(`${route.provider} is not configured`);

  const body = { ...requestBody, model: route.model };
  delete (body as Record<string, unknown>).joko;
  delete (body as Record<string, unknown>).task_class;

  return fetch(`${providerBaseUrl(route.provider)}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(route.provider === "openrouter" ? {
        "HTTP-Referer": "https://joko.today",
        "X-Title": "JOKO AI Gateway",
      } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function handleChat(req: Request, body: Record<string, unknown>): Promise<Response> {
  const id = requestId();
  const tier = textTierFromModel(body.model, req.headers.get("X-JOKO-Task-Class"));
  if (!tier) {
    return json({ error: "Use one of the JOKO model aliases: joko/economy, joko/standard, joko/premium" }, 400);
  }

  const route = textRoutes[tier];
  const started = Date.now();
  let selected = route.primary;
  let fallbackUsed = false;
  let upstream: Response | null = null;
  let primaryFailure: string | null = null;

  try {
    upstream = await callChatProvider(route.primary, body);
    if (!upstream.ok) {
      primaryFailure = `${upstream.status}: ${(await upstream.text()).slice(0, 500)}`;
      upstream = null;
    }
  } catch (error) {
    primaryFailure = error instanceof Error ? error.message : "primary provider failed";
  }

  if (!upstream) {
    selected = route.fallback;
    fallbackUsed = true;
    try {
      upstream = await callChatProvider(route.fallback, body);
    } catch (error) {
      const message = error instanceof Error ? error.message : "fallback provider failed";
      console.error(JSON.stringify({ event: "joko_ai_route_failure", request_id: id, route: route.alias, primary_failure: primaryFailure, fallback_failure: message }));
      return json({ error: "No configured AI route could complete the request" }, 503, { "X-JOKO-AI-Request-ID": id });
    }
  }

  const latencyMs = Date.now() - started;
  const contentType = upstream.headers.get("Content-Type") || "application/json";
  if (!upstream.ok) {
    const raw = await upstream.text();
    logUsage({ id, kind: "chat", route: route.alias, provider: selected.provider, model: selected.model, fallbackUsed, latencyMs, ok: false, status: upstream.status });
    return new Response(raw, {
      status: upstream.status,
      headers: {
        ...Object.fromEntries(gatewayHeaders({ id, route: route.alias, provider: selected.provider, model: selected.model, fallbackUsed, latencyMs })),
        "Content-Type": contentType,
      },
    });
  }

  if (contentType.includes("text/event-stream")) {
    logUsage({ id, kind: "chat", route: route.alias, provider: selected.provider, model: selected.model, fallbackUsed, latencyMs, ok: true, status: upstream.status, streaming: true });
    const headers = gatewayHeaders({ id, route: route.alias, provider: selected.provider, model: selected.model, fallbackUsed, latencyMs });
    headers.set("Content-Type", contentType);
    return new Response(upstream.body, { status: upstream.status, headers });
  }

  const raw = await upstream.text();
  let payload: unknown = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    // Preserve the upstream payload even if a provider returns non-JSON content.
  }

  const usage = usageFromPayload(payload);
  const costUsd = estimateTextCost(selected.provider, selected.model, usage);
  logUsage({ id, kind: "chat", route: route.alias, provider: selected.provider, model: selected.model, fallbackUsed, latencyMs, ok: true, status: upstream.status, usage, costUsd });
  const headers = gatewayHeaders({ id, route: route.alias, provider: selected.provider, model: selected.model, fallbackUsed, latencyMs, costUsd });
  headers.set("Content-Type", contentType);
  return new Response(raw, { status: upstream.status, headers });
}

async function callOpenRouterImage(route: ImageRoute, requestBody: Record<string, unknown>): Promise<{ payload: Record<string, unknown>; status: number; latencyMs: number }> {
  const key = providerKey("openrouter");
  if (!key) throw new Error("openrouter is not configured");

  const body = { ...requestBody, model: route.model, n: 1 };
  delete (body as Record<string, unknown>).joko;
  delete (body as Record<string, unknown>).task_class;

  const started = Date.now();
  const response = await fetch(`${OPENROUTER_BASE_URL}/images`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://joko.today",
      "X-Title": "JOKO AI Gateway",
    },
    body: JSON.stringify(body),
  });
  const latencyMs = Date.now() - started;
  const raw = await response.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(`OpenRouter image API returned invalid JSON (${response.status})`);
  }
  if (!response.ok) {
    const message = typeof payload.error === "object" ? JSON.stringify(payload.error).slice(0, 500) : raw.slice(0, 500);
    throw new Error(`OpenRouter image API ${response.status}: ${message}`);
  }
  return { payload, status: response.status, latencyMs };
}

async function handleImages(req: Request, body: Record<string, unknown>): Promise<Response> {
  const id = requestId();
  const tier = imageTierFromModel(body.model, req.headers.get("X-JOKO-Task-Class"));
  if (!tier) {
    return json({ error: "Use one of the JOKO image aliases: joko/image-draft, joko/image-standard, joko/image-premium" }, 400);
  }

  const route = imageRoutes[tier];
  const requested = typeof body.n === "number" && Number.isFinite(body.n) ? Math.floor(body.n) : 1;
  const count = Math.min(3, Math.max(1, requested));
  const images: unknown[] = [];
  let totalLatencyMs = 0;
  let totalCostUsd = 0;
  let hasCost = false;
  let aggregateUsage: UsageShape = {};

  try {
    for (let index = 0; index < count; index += 1) {
      const { payload, latencyMs } = await callOpenRouterImage(route, body);
      totalLatencyMs += latencyMs;
      const data = Array.isArray(payload.data) ? payload.data : [];
      images.push(...data);
      const usage = usageFromPayload(payload);
      if (usage) {
        aggregateUsage.prompt_tokens = (aggregateUsage.prompt_tokens ?? 0) + (usage.prompt_tokens ?? 0);
        aggregateUsage.completion_tokens = (aggregateUsage.completion_tokens ?? 0) + (usage.completion_tokens ?? 0);
        aggregateUsage.total_tokens = (aggregateUsage.total_tokens ?? 0) + (usage.total_tokens ?? 0);
        const cost = numeric(usage.cost);
        if (cost !== null) {
          totalCostUsd += cost;
          hasCost = true;
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generation failed";
    console.error(JSON.stringify({ event: "joko_ai_image_failure", request_id: id, route: route.alias, error: message }));
    logUsage({ id, kind: "image", route: route.alias, provider: "openrouter", model: route.model, fallbackUsed: false, latencyMs: totalLatencyMs, ok: false, status: 502 });
    return json({ error: "Image generation failed", detail: message }, 502, { "X-JOKO-AI-Request-ID": id });
  }

  const costUsd = hasCost ? totalCostUsd : null;
  logUsage({ id, kind: "image", route: route.alias, provider: "openrouter", model: route.model, fallbackUsed: false, latencyMs: totalLatencyMs, ok: true, status: 200, usage: aggregateUsage, costUsd });
  const headers = gatewayHeaders({ id, route: route.alias, provider: "openrouter", model: route.model, fallbackUsed: false, latencyMs: totalLatencyMs, costUsd });
  return json({
    created: Math.floor(Date.now() / 1000),
    data: images,
    usage: {
      ...aggregateUsage,
      ...(costUsd !== null ? { cost: costUsd } : {}),
    },
  }, 200, Object.fromEntries(headers));
}

function modelsResponse() {
  return {
    object: "list",
    data: [
      ...Object.values(textRoutes).map((route) => ({
        id: route.alias,
        object: "model",
        owned_by: "joko",
        metadata: { kind: "chat", tier: route.tier },
      })),
      ...Object.values(imageRoutes).map((route) => ({
        id: route.alias,
        object: "model",
        owned_by: "joko",
        metadata: { kind: "image", tier: route.tier },
      })),
    ],
  };
}

function healthResponse() {
  return {
    ok: true,
    gateway: "joko-ai-gateway",
    version: 1,
    providers: {
      ollama_cloud: Boolean(providerKey("ollama-cloud")),
      openrouter: Boolean(providerKey("openrouter")),
    },
    routes: {
      text: Object.fromEntries(Object.entries(textRoutes).map(([tier, route]) => [tier, {
        alias: route.alias,
        primary: { provider: route.primary.provider, model: route.primary.model },
        fallback: { provider: route.fallback.provider, model: route.fallback.model },
      }])),
      image: Object.fromEntries(Object.entries(imageRoutes).map(([tier, route]) => [tier, {
        alias: route.alias,
        provider: route.provider,
        model: route.model,
      }])),
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!isAuthorized(req)) return json({ error: "Unauthorized" }, 401);

  const path = normalizePath(req.url);

  if (req.method === "GET" && (path === "/health" || path === "/v1/health")) {
    return json(healthResponse());
  }
  if (req.method === "GET" && (path === "/models" || path === "/v1/models")) {
    return json(modelsResponse());
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return json({ error: "Invalid JSON request" }, 400);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return json({ error: "Invalid request body" }, 400);
  }
  const body = parsed as Record<string, unknown>;

  if (path === "/chat/completions" || path === "/v1/chat/completions" || path === "/") {
    return handleChat(req, body);
  }
  if (path === "/images" || path === "/v1/images") {
    return handleImages(req, body);
  }

  return json({ error: "Not found" }, 404);
});
