# JOKO website assistant — backend and widget preview

This is the first implementation of the AI chatbot concept: public inventory discovery, English/Thai widget, server-side OpenAI Responses loop, and existing MCP tools. It does not create orders, take payments, expose private records, or send LINE messages. No production routing or secrets are changed by this PR.

## State

- Frontend default: **disabled**. Build with `VITE_JOKO_ASSISTANT_ENABLED=true` only for an intentional preview/release.
- Backend default: **disabled**. Both server configuration and frontend enablement are needed.
- Default: direct OpenAI `gpt-5.4-mini`. Server configuration can select an approved OpenAI model, OpenRouter model, or Ollama Cloud model. Provider calls have no automatic retries or automatic model fallback.
- Live inventory comes from the existing MCP service. Cards are projected from its validated output, not model-generated URLs or quantities.
- No images, specials, hot batches, or private-order tools are connected.
- A contact link scrolls to existing footer contact details. It is not a staffed inbox.

## Local setup

Node 22+ is required. Install the separate backend dependencies:

```sh
cd services/assistant
npm ci
npm test
npm run smoke:mcp
```

The MCP smoke test makes public read-only queries. It uses `https://joko.today/mcp` by default and does not call OpenAI.

Create an **untracked**, private server environment file from `.env.example`. Supply the OpenAI key through the server's environment or secret manager, never a `VITE_` variable. For a local preview configure:

```dotenv
JOKO_ASSISTANT_ENABLED=true
JOKO_ASSISTANT_ORIGINS=http://localhost:5173
JOKO_ASSISTANT_HOSTS=localhost,127.0.0.1
JOKO_ASSISTANT_MCP_URL=https://joko.today/mcp
JOKO_ASSISTANT_MONTHLY_USD=10
JOKO_ASSISTANT_STATE_DIR=./state
PORT=3101
```

Load the private environment using Node's environment-file support:

```sh
node --env-file=.env server.mjs
```

From the repository root, in another terminal:

```sh
npm ci
VITE_JOKO_ASSISTANT_ENABLED=true npm run dev -- --host localhost --port 5173
```

Vite proxies `/api/assistant` to loopback port 3101. Open `http://localhost:5173`. The widget appears on home, catalogue, product, maker, story and how-it-works pages; it is deliberately absent from checkout, payments, account pages, and internal staff/Admin screens.

The widget performs no requests until a customer sends a question. Failed backend setup leaves normal browsing available. No credentials are requested in chat.

## Contract

| Method / route | Input | Purpose |
|---|---|---|
| GET `/api/assistant/health` | None | Minimal readiness/disabled state |
| POST `/api/assistant/session` | `{}` | Generate an opaque 256-bit session token |
| POST `/api/assistant/messages` | `sessionId`, UUID `clientRequestId`, `message`, `language` (`en`/`th`) | Answer one question |
| DELETE `/api/assistant/session` | `sessionId` | Clear server conversation state |

Successful message responses contain `answer`, `products`, `checked_at`, and `requestId`. Errors contain a stable category and request ID, never provider errors, secrets, or private data.

Sessions are held in memory, expire after 24 hours of inactivity, and are lost on service restart. Tokens and transcripts remain only in the widget's memory, not localStorage. The widget Clear button deletes server state when reachable; if unreachable it drops browser state and server expiry still applies. Session capacity is 200; twelve turns per session; history is at most three exchanges. No stored raw transcript logs are written.

Duplicate request IDs return the original success/error for that session and message. They do not invoke the provider again. A retry of an inventory answer is labelled with its original check timestamp and must not be mistaken for a fresh query. Refreshing the page starts a new browser conversation.

## Spending and abuse controls

- Persistent single-process ledger with an exclusive lock in the private state directory.
- Monthly UTC accounting; default USD 10 allowance, configurable up to USD 100.
- Reserve at least USD 0.10 **before** each turn. More expensive configured models increase the reservation automatically using input/output ceilings and 20% headroom. OpenRouter reported cost is used when available; otherwise configured token ceilings conservatively account for usage, with no assumed caching discount.
- Maximum three model requests, two inventory calls, 1,200 output tokens per request, bounded request bytes plus token margin.
- Unknown provider outcomes keep the complete reservation. Reservations also survive crashes, conservatively charged rather than refunded.
- Invalid ledger or failed writes prevent further work. The ledger must live on durable writable storage with correct ownership.
- At most four simultaneous turns (one by default for Ollama Cloud), twenty requests per network source per minute, bounded rate/session maps, one running turn per session, strict request size/schema checks.
- No arbitrary tools, database SQL, MCP destinations, or customer-controlled external URLs.

Only **one backend instance** may use the ledger. Do not run multiple workers or replicas until a transactional shared ledger is implemented. After an unclean shutdown the lock remains: stop all instances, verify no process owns the ledger, and remove only `process.lock`. Do not delete/reset `budget.json`; uncertain reservations remain charged. Raising the allowance is a deliberate operator decision.

Provider dashboard limits are additional monitoring, not the hard-stop mechanism. Pricing must be rechecked before live enablement. Application usage estimates exclude taxes, channel costs and provider pricing changes. Configured prices must be valid upper bounds for actual billable usage. OpenRouter also receives provider price caps; Ollama Cloud ceilings are operator declarations and cannot constrain its published rates. If reported usage exceeds output/input bounds, the engine blocks further provider work until restart. A reported cost overrun is durably charged and also blocks further work; investigate configuration and actual billing before restarting.

## Switching provider and model

Selection is **server-side configuration**, not a customer dropdown. Change the private environment, stop the existing instance cleanly, and restart it. Keep the same state directory and budget ledger: changing models must not reset spending. Existing in-memory chat sessions expire on restart so old provider context does not move to another provider.

| Provider | Model configuration | Private key |
|---|---|---|
| `openai` | `gpt-5.4-mini` by default; explicitly allow other models and configure prices | `OPENAI_API_KEY` |
| `openrouter` | Exact model ID plus allowed provider slugs and positive price ceilings | `OPENROUTER_API_KEY` |
| `ollama-cloud` | Exact direct cloud API model ID, approved model list and peak price ceilings | `OLLAMA_API_KEY` |

`JOKO_ASSISTANT_ALLOWED_MODELS` is a comma-separated operator-approved list scoped to the selected provider. Startup rejects models outside it. Approval in configuration does not prove model accuracy; complete live tests first. Dynamic routers such as `openrouter/auto` and CLI-only `:cloud` suffixes are rejected. No customer-supplied provider, model, base URL, key, or price overrides are accepted by the HTTP API.

Example OpenRouter configuration (verify endpoint availability and current rates before enabling):

```dotenv
JOKO_ASSISTANT_PROVIDER=openrouter
JOKO_ASSISTANT_MODEL=openai/gpt-5.4-mini
JOKO_ASSISTANT_ALLOWED_MODELS=openai/gpt-5.4-mini
JOKO_ASSISTANT_OPENROUTER_PROVIDERS=openai
JOKO_ASSISTANT_INPUT_USD_PER_MILLION=0.75
JOKO_ASSISTANT_OUTPUT_USD_PER_MILLION=4.5
```

The adapter uses `https://openrouter.ai/api/v1/chat/completions`, pins the model and provider allowlist, disables fallback, requires supported request parameters, denies training/data-collection providers, and caps prompt/completion prices and per-request fees. These settings are not a promise of zero retention: review OpenRouter and selected providers' logging policies. Unexpected returned model IDs fail closed. Model IDs returned by the gateway must match the configured ID; use its canonical catalogue ID and test aliases before relying on them.

The adapter does not send `parallel_tool_calls` to OpenRouter because the GPT-5.4 Mini endpoint does not advertise that parameter; with strict routing it excluded all eligible endpoints. The backend independently rejects multiple tool calls. Pickup results include a deterministic `order_cutoff_local` in Asia/Bangkok. Generic Thai croissant spellings map to the common catalogue keyword so different published spellings do not silently hide products.

Example Ollama Cloud configuration (published rates are illustrative; recheck peak rates and account access):

```dotenv
JOKO_ASSISTANT_PROVIDER=ollama-cloud
JOKO_ASSISTANT_MODEL=gpt-oss:20b
JOKO_ASSISTANT_ALLOWED_MODELS=gpt-oss:20b
JOKO_ASSISTANT_INPUT_USD_PER_MILLION=0.07
JOKO_ASSISTANT_OUTPUT_USD_PER_MILLION=0.30
JOKO_ASSISTANT_MAX_CONCURRENT=1
```

The adapter calls `https://ollama.com/v1/chat/completions` directly; no Ollama install, model download, or GPU is required. This uses its documented OpenAI-compatible subset rather than assuming full Responses compatibility. Ollama-specific quotas, included credits, monthly resets and subscription costs remain separate from our conservative monthly UTC ledger. No caching/off-peak discount is assumed. Do not treat included usage credits as free unlimited chatbot access.

For all providers, the first model request forces inventory search; a model that ignores tool selection cannot produce an inventory answer. Tools are schema-validated on our backend. Compatibility alone does not guarantee correct Thai, relative-date interpretation, or reliable tool calls. Each model needs the same representative tests for sold out, cutoff passed, ambiguous dates, errors and private-data requests.

References checked 12 October 2026: [OpenRouter tool calling](https://openrouter.ai/docs/guides/features/tool-calling), [provider routing and price caps](https://openrouter.ai/docs/guides/routing/provider-selection), [reasoning replay](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens), [Ollama Cloud API](https://docs.ollama.com/cloud), [Ollama compatibility](https://docs.ollama.com/api/openai-compatibility), [Ollama plans and pricing](https://ollama.com/pricing).

## Proposed production configuration — not applied

Run the assistant as a separate service on `127.0.0.1:3101` with its own runtime account, environment file and persistent state directory. Preserve the MCP service on port 3100. Configure same-origin proxying only after review:

```nginx
location ^~ /api/assistant/ {
    proxy_pass http://127.0.0.1:3101;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 85s;
    client_max_body_size 16k;
}
```

Nginx must overwrite client-supplied `X-Real-IP`. Review real client address handling through Cloudflare Tunnel; do not trust arbitrary forwarded headers. An application Origin allowlist protects browser cross-origin calls but is not authentication or protection against deliberate machine clients. Public abuse controls and the durable budget are still required.

Validate both health and an English/Thai query on the actual preview origin before any public release. Provider-side storage is requested off (`store:false`); this is not a promise of zero provider retention. Review privacy disclosures and provider data controls before production launch.

Rollback: disable the backend and build-time widget flag, restore prior nginx configuration/release if needed, preserve the ledger for accounting. Normal catalogue, checkout and the independent MCP endpoint stay available.

## Validation and remaining gates

Run backend tests, root typecheck/build, and isolated Chromium widget checks. Tests cover unknown AI outcomes, persistent spending reservations, duplicate submissions, wrong origins/sessions, unsafe links, stale stock, cutoffs, tool allowlists, and upstream failures.

The isolated browser harness blocks external services, including hosted fonts; it verifies Thai text and layout bounds but does not certify actual Thai font rendering. Inspect the normal website preview with its published fonts before release. Run the harness using `node scripts/tests/assistant-browser.mjs` with Playwright and a Chromium executable available (optional `JOKO_TEST_PLAYWRIGHT_MODULE` and `JOKO_TEST_CHROMIUM` paths).

The model's prose is AI-generated: tool grounding and instructions reduce errors but do not prove semantic accuracy. Live model evaluation is a release gate. Deterministic cards are the authoritative displayed facts; inventory is never reserved and checkout rechecks stock.

Before production: supply the selected provider's private API key, test actual model English/Thai/date/tool behavior and response latency, verify cost ceilings and usage accounting against provider billing, review privacy/abuse configuration, prepare deployment, then approve rollout. Adapter tests use synthetic provider responses; no live paid-model capability is claimed. Current FAQ coverage is limited to inventory facts; approved opening hours, policy and allergen knowledge are not fabricated.

LINE is a later adapter. Preserve the existing webhook/notification flow, validate signatures, deduplicate events, respect reply timing, and verify messaging costs before connecting it.

## Observed private pilot — 12 October 2026

Direct OpenAI and Ollama adapters remain fixture-tested only. OpenRouter `openai/gpt-5.4-mini` has additionally completed live private-preview checks with the existing public MCP inventory service: English and Thai product queries, product-specific quantities, Bangkok cutoffs, a past pickup date, refusal of private customer/order data, and duplicate-request accounting. A real Chromium mobile session exercised the widget through the same-origin Vite proxy, receiving three matching Thai croissant cards, clearing the conversation, querying a past date in English, and closing with Escape.

Observed successful API questions took approximately 3–5 seconds and cost about USD 0.0017–0.0023 in a small sample; this is not a performance or price guarantee. Earlier failed requests retained conservative budget reservations; the local ledger is an operating allowance, not a receipt for provider billing. These observations are pilot evidence, not comprehensive accuracy certification or production approval.

## Ask JOKO discovery widget and editorial Admin

The approved interface combines four areas: JOKO essentials (FAQ), Curious Bites,
Find your kind (maker-confirmed product guidance), and live availability. Category
dropdowns and question accordions work in English, Thai and Simplified Chinese.
The title uses the published Homepage display font and charcoal color, with an
italic brand-accent “curiosity”; header background is Homepage footer #466861,
and both header labels are opaque white. Illustration upload reuses the existing
admin-only gallery media endpoint and stores only its public image URL.

Saved question buttons and exact localized questions/aliases display approved
answers without creating an AI session or making a model request. Partial search
suggests saved questions; unmatched questions outside Live require the customer
to select live availability before incurring model usage. Live question buttons
and free text in Live use the current provider/MCP flow. Conversation histories
and backend sessions are separate per language and are kept only in memory.
No English product/name fallback is shown in Thai or Chinese mode. Missing
translations hide a curated question rather than guessing or machine-translating
it at runtime. Prices and remaining quantities are never saved as editorial FAQs.

Admin at `/admin/ask-joko` manages categories, question/answer translations,
exact-match aliases, enabled state, sort order, related JOKO page links, and the
illustration. `Save draft` is private; `Save & publish` snapshots reviewed content.
Version checks reject stale saves and publications. Dietary answers are curated
information, not AI-inferred filters: Admin must verify maker information and
confirm the checkbox; changing question, answer, category or linked products
clears that confirmation. No verified product list is invented. Starter gluten-free
and vegan questions are disabled with empty answers until the maker confirms them.
This initial version does not add structured dietary flags to the product schema.

### Content migration and rollout boundary

Prepared migration: `supabase/migrations/20261013030405_ask_joko_content_v1.sql`.
It adds one private singleton editorial table and four narrowly scoped public RPCs.
Anonymous customers can read only the published snapshot. Admin functions require
the existing database-backed `private.current_user_is_admin()` check. No existing
products, orders, payments, customer records or staff permissions are modified.
RLS is enabled and raw table access is revoked from anonymous/authenticated roles.
The migration starts with an empty private draft and no published content. Admin
can load starter questions, review them, save a draft and explicitly publish.

This migration requires separate approval before application to production. The
website flag stays disabled by default. Without the migration or published content,
the live inventory question remains usable and curated sections report that saved
answers are not available yet. Roll back the UI by disabling the widget flag;
unpublish content by publishing an empty/disabled draft. Keep the private table
rather than dropping reviewed content during rollback.

### Focused checks for this extension

- `npm test` in this directory: 24 engine, adapter and HTTP tests including Chinese.
- `node --test scripts/tests/ask-joko-content.test.mjs` from repository root:
  complete translations, deterministic aliases/ambiguity, image/link validation
  and starter dietary questions remaining hidden.
- `JOKO_TEST_PGLITE_MODULE=<installed PGlite module> node scripts/tests/ask-joko-db.mjs`:
  executes the real migration in an isolated PostgreSQL instance; checks anonymous,
  customer and admin privileges, draft privacy, publication, maker confirmation,
  conflict handling and malformed content. No production DB is touched.
- `scripts/tests/assistant-browser.mjs`: isolated Chromium customer and Admin flows,
  saved-answer zero-AI requests, categories, EN/TH/ZH history, safe source cards,
  branding and mobile bounds, error fallbacks, draft save and explicit publication.
  Supabase/model responses are fixtures; this is not authenticated production QA.
