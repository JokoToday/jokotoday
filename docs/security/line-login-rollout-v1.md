# JOKO TODAY — LINE Login v1 rollout

Status: **PR only. No production rollout/configuration change in this PR.**

## Architecture

- **LINE Login channel**: `2008976086` (provider `JOKO Today`). The Messaging API channel `2011890578` is separate.
- **Supabase Auth** performs OAuth code exchange, PKCE/state verification, stores the provider identity, and creates trusted sessions. No LINE user ID–derived passwords or fake email addresses; no client inserts into `line_users`.
- Supabase custom OAuth provider: `custom:line` (Manual **OAuth2**). LINE's userinfo endpoint returns stable `sub`. LINE Login web ID tokens may be HS256, so do not assume OIDC/JWKS verification will work interchangeably.
- Existing email OTP, QR login, staff/admin authorization, customer IDs, loyalty and orders remain unchanged.
- The LINE sign-in and identity-link buttons are **OFF by default**. Build with `VITE_ENABLE_LINE_LOGIN=true` only when tested and ready. This is **not a server-side signup restriction**.

## Step 1 — Configure Supabase custom OAuth provider (trusted dashboard only)

Go to Supabase JOKO Today Auth Providers (project `xvhualoeboobulwgmkla`) and create, without replacing existing providers:

| Parameter | Value |
|---|---|
| Provider type | Manual OAuth2 |
| Identifier | `custom:line` |
| Display name | LINE |
| Client ID | **LINE Login** channel ID `2008976086` |
| Client secret | **LINE Login channel secret**, NOT Messaging API secret |
| Authorization URL | `https://access.line.me/oauth2/v2.1/authorize` |
| Token URL | `https://api.line.me/oauth2/v2.1/token` |
| UserInfo URL | `https://api.line.me/oauth2/v2.1/userinfo` |
| Scopes | `openid profile` |
| PKCE | Enabled (default) |
| Email optional | **true** (mandatory; current LINE channel does not have email permission) |

If the dashboard cannot set `email_optional=true`, **stop** and use the documented Supabase Auth Admin API from a trusted environment. Never expose a service-role key or LINE secret in frontend, `VITE_*` or GitHub.

Enable Supabase's **manual identity linking** setting for `linkIdentity()`. Add exact allowlisted **Redirect URLs** for `https://joko.today/auth/callback` and separately the staging host's `/auth/callback` used in a staged pilot (avoid broad wildcards). Test the provider returns a verified Supabase session with an identity whose provider is `custom:line`, including when LINE supplies no email.

## Step 2 — Set LINE Developers callback

In **JOKO Today Login → LINE Login → Callback URL**, register the **read-only Supabase callback** shown while creating the custom provider, expected to be:

`https://xvhualoeboobulwgmkla.supabase.co/auth/v1/callback`

The retired Bolt endpoint `https://joko-today-pre-order-yamv.bolt.host/functions/v1/line-callback` is **not** the new LINE callback. The frontend `https://joko.today/auth/callback` is a **second redirect**, from Supabase back to the application. Do not use the Messaging API webhook URL as a callback. The linked LINE Official Account and its Messaging API channel can remain as configured; the webhook may remain blank.

Optional later: only after separate testing, use LINE's `bot_prompt=normal` authorization parameter to suggest adding the linked Official Account as a friend. LINE Login itself does **not** prove the customer has added the OA or can receive messages.

## Step 3 — Account ownership and duplicates

**Existing customer (preferred):** first sign in with email OTP or the existing JOKO QR. In **My Profile → Connect LINE**, authenticate with LINE, then return to My Profile. Check that the *same* `auth.users.id`, `user_profiles.id`, QR token, VIP short code, orders and loyalty ledger remain. Sign out, then sign in with LINE and verify all are unchanged.

**New customer:** direct Continue with LINE creates a new Supabase Auth user if it has never been linked. Existing JOKO profile requirements (name, phone and a reachable social contact) still apply. Because LINE does not provide a verified email in the current configuration, do not promise email order confirmations; obtain and verify an email later through Supabase Auth if needed.

**Limitation:** without a verified email or pre-existing link, there is no trustworthy automatic way to recognize that a LINE-only login belongs to an existing email customer. Never merge by name, phone, manually entered LINE ID, profile picture or unverified email. The UI warns existing customers to link first. This is a *user-flow safeguard*, not a guarantee against duplicate signup. If zero duplicates is required during migration, keep direct LINE signup disabled at the Auth service level (separate backend signup policy) and run a link-only pilot. An already-linked LINE identity must not be linked to another user.

## Step 4 — Staged tests before production

- [ ] PR CI passes typecheck, ESLint, build, dependency audit, LINE security contract.
- [ ] Feature OFF baseline: email OTP, QR sign-in, checkout and staff/admin login still work.
- [ ] Add the custom OAuth provider with `email_optional=true` and manual identity linking in a safe environment.
- [ ] Allowlist exact Supabase and frontend callback URLs. Verify LINE and Supabase client credentials remain server-side.
- [ ] Existing customer email/QR → Connect LINE → callback → same UUID/QR/orders/loyalty.
- [ ] Sign out → Continue with LINE → same customer account.
- [ ] New LINE user → customer profile/QR allocation; check no confirmed email is assumed.
- [ ] Cancellation / access_denied must show an error, not a successful login or linking.
- [ ] Already-used LINE identity cannot link to another account.
- [ ] Test desktop and mobile LINE app/browser; no stale `bolt.host` redirect.
- [ ] Verify that absent email does not break checkout and that no email confirmation is promised.
- [ ] Only after successful pilot, set `VITE_ENABLE_LINE_LOGIN=true` on approved production build, deploy, and smoke test.

## Retire legacy Edge function (separate backend action)

This PR removes the old frontend callback component, Edge function source and local config, **but it does not undeploy the live Edge function**. When safe, remove the deployed `line-callback` through the backend rollout, verify it is unavailable, and remove obsolete Edge secrets (`LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET`, `LINE_REDIRECT_URI`, `APP_URL`) **only after** verifying no other function uses them. Assess legacy `line_users` records before any separate migration/drop. Do not delete the LINE Messaging API channel.

References:
- https://supabase.com/docs/guides/auth/custom-oauth-providers
- https://supabase.com/docs/guides/auth/auth-identity-linking
- https://developers.line.biz/en/reference/line-login/
