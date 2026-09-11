# Hermes Cost & Routing v1

**Status:** implementation prepared, operational activation pending  
**Scope:** shared JOKO AI routing for Hermes and Creative Lab  
**Primary provider:** Ollama Cloud  
**Fallback / image gateway:** OpenRouter

## 1. Why this exists

Hermes and Creative Lab should not grow separate provider integrations, separate credentials, and separate cost policies. This v1 introduces one server-side **JOKO AI Gateway** that owns routing policy and cost telemetry while keeping product surfaces provider-neutral.

The gateway deliberately does **not** make Hermes itself a dependency of the public JOKO website. Hermes and Creative Lab are sibling consumers of the same AI routing layer.

```text
                    JOKO AI Gateway
              routing · fallback · cost
                         │
         ┌───────────────┼───────────────┐
         │                               │
      Hermes                        Creative Lab
         │                               │
         └───────────────┬───────────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
         Ollama Cloud           OpenRouter
        primary text          fallback + images
```

## 2. Live Hermes audit — 2026-09-11

The read-only audit established the current baseline:

- Hermes Agent is `v0.14.0 (2026.5.16)` and the checkout reports 3,096 commits behind upstream.
- The active `chief` profile uses `gpt-oss:120b-cloud` through a custom OpenAI-compatible endpoint at `http://127.0.0.1:11434/v1`.
- `design`, `forge`, and `memory` use the same Ollama endpoint and currently carry `openrouter/free` fallback configuration.
- The global config differs from the active profile: it names `kimi-k2.5:cloud` and `openrouter/owl-alpha`.
- `OPENROUTER_API_KEY` exists by name in the global Hermes `.env` and the memory profile `.env`, but `hermes status` still reports OpenRouter as not set for the active profile. Treat the existing fallback as **unverified** until exercised successfully.
- Ollama `0.23.2` is running and the local catalog contains cloud entries including `gpt-oss:120b-cloud`, `kimi-k2.5:cloud`, and `deepseek-v4-pro:cloud` plus local Qwen models.
- Hermes' gateway service is running under user systemd.

**Important:** do not combine the routing rollout with `hermes update`. The existing Hermes checkout is far behind upstream and upgrading it is a separate change requiring its own regression plan.

## 3. V1 routing contract

The gateway exposes OpenAI-compatible aliases rather than allowing callers to choose arbitrary provider models.

### Text

| Alias | Intent | Primary | Fallback |
| --- | --- | --- | --- |
| `joko/economy` | cheap repetitive work | Ollama Cloud | OpenRouter |
| `joko/standard` | normal Hermes work | Ollama Cloud | OpenRouter |
| `joko/premium` | difficult/high-value work | Ollama Cloud | OpenRouter |

Default model slugs are only starting values and are environment-overridable. The routing contract is the stable interface; individual models are replaceable.

### Images

| Alias | Intent | Provider |
| --- | --- | --- |
| `joko/image-draft` | cheap visual exploration | OpenRouter unified Image API |
| `joko/image-standard` | normal Creative Lab generation | OpenRouter unified Image API |
| `joko/image-premium` | master/fidelity-critical generation | OpenRouter unified Image API |

V1 sends Creative Lab Character Generation through `joko/image-standard`. The browser still talks only to the authenticated `generate-character-candidates` Edge Function; provider credentials never enter the browser.

## 4. Gateway endpoints

The Supabase Edge Function is `joko-ai-gateway`.

It accepts:

```text
GET  /v1/health
GET  /v1/models
POST /v1/chat/completions
POST /v1/images
```

The chat surface is OpenAI-compatible enough for Hermes' custom-endpoint mode. The Image API uses the same JOKO aliases and internally translates to OpenRouter's unified image endpoint.

The gateway does not expose arbitrary provider model IDs. This prevents an agent or browser client from silently opting into an expensive model outside JOKO policy.

## 5. Authentication

`joko-ai-gateway` has Supabase platform `verify_jwt = false` because Hermes is not a Supabase end-user session. The function performs its own server-to-server bearer authentication using:

```text
JOKO_AI_GATEWAY_KEY
```

That key must never be placed in Vite/browser environment variables.

`generate-character-candidates` remains `verify_jwt = true` and retains its independent JOKO Admin role check before it calls the gateway.

## 6. Required secrets / configuration

Activation requires these Supabase Edge Function secrets:

```text
JOKO_AI_GATEWAY_KEY=<random high-entropy shared service key>
OLLAMA_API_KEY=<Ollama Cloud API key>
OPENROUTER_API_KEY=<OpenRouter API key>
```

Optional route overrides:

```text
JOKO_AI_OLLAMA_ECONOMY_MODEL=glm-5.3-flash
JOKO_AI_OLLAMA_STANDARD_MODEL=gpt-oss:120b
JOKO_AI_OLLAMA_PREMIUM_MODEL=deepseek-v4-pro

JOKO_AI_OPENROUTER_ECONOMY_MODEL=openrouter/auto
JOKO_AI_OPENROUTER_STANDARD_MODEL=openrouter/auto
JOKO_AI_OPENROUTER_PREMIUM_MODEL=openrouter/auto

JOKO_AI_IMAGE_DRAFT_MODEL=google/gemini-3.1-flash-lite-image
JOKO_AI_IMAGE_STANDARD_MODEL=google/gemini-3.1-flash-image
JOKO_AI_IMAGE_PREMIUM_MODEL=openai/gpt-image-2.5-sunburst
```

`OLLAMA_BASE_URL` and `OPENROUTER_BASE_URL` are also overridable but normally remain at their hosted defaults.

## 7. Cost telemetry

Every completed request writes one structured Edge Function log event named:

```text
joko_ai_usage
```

It records only operational metadata:

- request ID
- chat/image kind
- JOKO route alias
- actual provider
- actual model
- whether fallback was used
- latency
- HTTP success/status
- token counts when supplied by the provider
- cached token count when supplied
- cost when supplied or estimable

It does **not** log prompts or reference-image contents.

Responses also include safe operational headers:

```text
X-JOKO-AI-Request-ID
X-JOKO-AI-Route
X-JOKO-AI-Provider
X-JOKO-AI-Model
X-JOKO-AI-Fallback-Used
X-JOKO-AI-Latency-Ms
X-JOKO-AI-Cost-USD      # when known
```

OpenRouter's reported `usage.cost` is used when available. Ollama Cloud estimation is optional and driven by `JOKO_AI_PRICING_JSON`, so changing public prices never requires a code deployment.

Example pricing configuration shape:

```json
{
  "ollama-cloud:gpt-oss:120b": {
    "input_per_million": 0.15,
    "cached_input_per_million": 0.014,
    "output_per_million": 0.60
  }
}
```

Pricing values above are examples only; use current provider pricing at activation time.

## 8. Creative Lab integration

`generate-character-candidates` no longer owns an OpenAI-specific provider implementation. It now:

1. authenticates the signed-in JOKO Admin;
2. validates CharacterSpec/reference input;
3. compiles the JOKO character prompt;
4. converts browser reference files to image data URLs server-side;
5. calls `joko/image-standard` on JOKO AI Gateway;
6. returns provider/model/route/request/cost provenance with the generated candidates.

Browser Library candidate provenance is now provider-neutral and can retain gateway route, request ID, and batch cost.

## 9. Hermes integration — activation plan

Do **not** repoint the existing AIAgentNerd profiles immediately. First test the gateway independently, then create/use an isolated JOKO Hermes profile.

Conceptual JOKO profile:

```yaml
model:
  default: joko/standard
  provider: custom
  base_url: https://<project-ref>.supabase.co/functions/v1/joko-ai-gateway/v1
```

The custom-endpoint API key for that isolated profile should be the same `JOKO_AI_GATEWAY_KEY`. Keep the secret in profile-scoped environment/auth configuration, not in committed YAML.

Once `joko/standard` works reliably, individual JOKO workflows can deliberately select `joko/economy` or `joko/premium` without knowing which underlying provider/model currently serves the tier.

## 10. Activation gates

This implementation intentionally does **not** perform these operational actions:

- no Supabase secret creation or rotation;
- no deployment of `joko-ai-gateway`;
- no redeployment of `generate-character-candidates`;
- no Hermes profile/config mutation;
- no Hermes upgrade;
- no database migration or RLS change;
- no DNS/Cloudflare change.

Recommended activation order after review/merge:

1. create a high-entropy `JOKO_AI_GATEWAY_KEY`;
2. add Ollama Cloud and OpenRouter provider keys to Supabase secrets;
3. deploy `joko-ai-gateway` with platform JWT verification disabled;
4. redeploy `generate-character-candidates` with JWT verification enabled;
5. call authenticated `/v1/health` and `/v1/models`;
6. run one low-volume Creative Lab character test;
7. inspect route/cost telemetry;
8. create an isolated JOKO Hermes profile and test `joko/standard`;
9. only then consider broader Hermes routing changes.

## 11. V1 non-goals

- persistent usage database / dashboard;
- automatic quality scoring;
- automatic budget enforcement;
- arbitrary model selection by end users;
- direct browser access to the gateway;
- Hermes upgrade;
- provider-specific prompt logic in Creative Lab.

Those can follow after real usage data tells us what is worth optimizing.
