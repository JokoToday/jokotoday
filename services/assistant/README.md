# JOKO website assistant — backend and widget preview

This is the first implementation of the AI chatbot concept: public inventory discovery, English/Thai widget, server-side OpenAI Responses loop, and existing MCP tools. It does not create orders, take payments, expose private records, or send LINE messages. No production routing or secrets are changed by this PR.

## State

- Frontend default: **disabled**. Build with `VITE_JOKO_ASSISTANT_ENABLED=true` only for an intentional preview/release.
- Backend default: **disabled**. Both server configuration and frontend enablement are needed.
- Model: `gpt-5.4-mini`, fixed until pricing and live evaluation are reviewed. Provider calls have no automatic retries.
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
- Reserve USD 0.10 **before** each turn. Known usage is reconciled at current GPT-5.4 Mini standard input/output rates, with no assumed caching discount.
- Maximum three model requests, two inventory calls, 1,200 output tokens per request, bounded request bytes plus token margin.
- Unknown provider outcomes keep the complete reservation. Reservations also survive crashes, conservatively charged rather than refunded.
- Invalid ledger or failed writes prevent further work. The ledger must live on durable writable storage with correct ownership.
- Four simultaneous turns, twenty requests per network source per minute, bounded rate/session maps, one running turn per session, strict request size/schema checks.
- No arbitrary tools, database SQL, MCP destinations, or customer-controlled external URLs.

Only **one backend instance** may use the ledger. Do not run multiple workers or replicas until a transactional shared ledger is implemented. After an unclean shutdown the lock remains: stop all instances, verify no process owns the ledger, and remove only `process.lock`. Do not delete/reset `budget.json`; uncertain reservations remain charged. Raising the allowance is a deliberate operator decision.

Provider dashboard limits are additional monitoring, not the hard-stop mechanism. Pricing must be rechecked before live enablement. Application usage estimates exclude taxes, channel costs and provider pricing changes. Do not change models without updating rate assumptions and tests.

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

Before production: supply a private API key, test actual GPT-5.4 Mini English/Thai/date behavior and response latency, verify costs against provider usage, review privacy/abuse configuration, prepare deployment, then approve rollout. Current FAQ coverage is limited to inventory facts; approved opening hours, policy and allergen knowledge are not fabricated.

LINE is a later adapter. Preserve the existing webhook/notification flow, validate signatures, deduplicate events, respect reply timing, and verify messaging costs before connecting it.
