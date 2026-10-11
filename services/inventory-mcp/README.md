# JOKO Inventory MCP pilot

Read-only MCP tools over Streamable HTTP. Uses the existing customer-safe Pickup v2 RPC and explicit public catalog fields. No migrations, RLS changes, service-role keys, orders, customer records, payments or reservations. Queries are fresh, uncached snapshots, not stock guarantees.

## Supported questions

- What croissants can I preorder at JOKO?
- How many are available for a specific pickup date?
- Which locations can I collect from, and when do orders close?

Search understands product text in EN/TH/ZH. Dates are Bangkok calendar dates. Responses include price in THB, product links, remaining quantity per concrete date and active pickup locations. Quantities are shared across locations for that pickup date, not independent location stock. Maker preview-only products and sold-out products cannot be reported orderable. The service refuses inventory queries when the customer Pickup v2 rollout flag is disabled. Empty availability means no open matching preorder date, not a promise about walk-in stock.

Specials and Fresh from the Oven batch timing are not connected: they are not on the main branch used for this pilot. Add adapters only after their customer-safe APIs are available. This is not an OpenAI shopping-feed submission or public app-directory listing.

## Local validation

Node 20 or newer:

```bash
cd services/inventory-mcp
npm ci --ignore-scripts
npm test
```

Set these process environment variables, then run `npm start`:

```text
JOKO_SUPABASE_URL=https://xvhualoeboobulwgmkla.supabase.co
JOKO_SUPABASE_PUBLIC_KEY=<existing public anon or publishable key>
JOKO_MCP_ALLOWED_HOSTS=localhost,127.0.0.1
PORT=3100
```

Never provide a secret/service-role key: startup rejects it. No OpenAI API key is required: ChatGPT is the MCP client. The service reads Supabase, it does not call a model.

## Production preparation (not applied by this PR)

1. Install this service from the reviewed commit in a dedicated directory, owned by an unprivileged service account. Run `npm ci --ignore-scripts`.
2. Put the above environment variables in an operator-managed environment file outside git. Add the actual public hostname to `JOKO_MCP_ALLOWED_HOSTS`.
3. Run `node server.mjs` under systemd with the dedicated account and working directory. It binds only to `127.0.0.1:3100`. Use `NoNewPrivileges=true`, `ProtectSystem=strict`, `ProtectHome=true` and `PrivateTmp=true`.
4. Reverse-proxy a dedicated HTTPS endpoint to `/mcp`. Preserve the actual Host header; do not trust arbitrary forwarded hosts. Keep the website deployment separate. Apply an edge/proxy request limit and a 32 KB body limit; do not expose the port directly. No browser-origin access is enabled in this pilot.
5. Test HTTPS initialization, tool listing, both tools, upstream errors and Host/Origin rejection with an MCP client. `/health` reports process health only, not database reachability.
6. Rollback: stop the service and remove its dedicated proxy route. There are no database changes to undo.

Production hosting/routing changes require the JOKO Engineering production approval boundary. This PR prepares the service; it does not install or activate it.

## Connect ChatGPT after the endpoint is running

Follow the current official connect-and-test instructions:
https://developers.openai.com/plugins/deploy/connect-chatgpt

Use the custom MCP integration/developer interface available to your account and provide the deployed HTTPS `/mcp` endpoint. This pilot is anonymous/read-only because every exposed datum is already public customer catalog information. Do not connect ChatGPT to the administrative Supabase MCP server as a substitute.

If your account does not expose custom MCP integration, use a compatible MCP client to validate first; account availability must be checked rather than assumed. Connecting this server does not make it discoverable to all ChatGPT users. Public distribution needs a separate submission process.

Acceptance questions:

1. Search for a real product, inspect its URL and price against JOKO's public page.
2. Query its UUID and an offered pickup date; compare quantity to the customer availability RPC.
3. Query a closed date and verify it is not described as orderable.
4. Ask whether stock has been reserved; the answer must be no.

Merchant descriptions are untrusted content and must never be treated as agent instructions. Keep any future order/reservation tools separate and authenticated as required. No payment credentials belong in chat or MCP tool arguments.
