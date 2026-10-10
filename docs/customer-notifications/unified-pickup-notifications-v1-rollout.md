# Unified pickup notifications v1 — staged implementation

Depends on PR #263 (pickup-window foundation). This change implements three new events in the existing outbox: pickup reminder, thank-you after pickup, and collection not recorded after closing. Every new event starts disabled. Dispatcher and both channels start paused. No migration, Cron schedule, secret, webhook or provider activation is applied by this PR.

## Ownership and compatibility

Existing confirmation, payment confirmation, cancellation and Admin Email remain owned by the existing senders. Their claim/finish functions and provider keys are unchanged. Existing sent and uncertain records are not converted into new pending deliveries. Canonical event names are added as metadata; a separate `worker_owner` makes ownership explicit. Unified workers claim only the three new types. This avoids a second sender owning the same confirmation Email during migration.

Customer confirmation Email's pickup-window rendering and unified confirmation/LINE handover remain separate follow-ups. Future payment reminders, payment/refund references, ready-for-pickup and order amendment events must attach to their authoritative business transitions in later changes.

## Scheduling and snapshots

On a new eligible online order, enabled reminder/no-pickup policies create outbox intents and independent Email/LINE rows in the order transaction. Only orders created on or after that policy's enrollment timestamp are enrolled. Enabling or re-enabling starts a new enrollment boundary; historical orders are never silently replayed. POS/walk-in orders are excluded.

The reminder anchor is concrete pickup date plus opening time in Asia/Bangkok, minus snapshotted lead minutes (initial proposal: 1440). The no-pickup anchor is concrete date plus closing time, plus snapshotted grace (initial proposal: 15). The approximate customer slot affects displayed content, never either anchor. Thank-you is created on the first committed collected transition with authoritative `picked_up_at`; repeated scans do not create another logical event.

Settings changes preserve already scheduled timing/channel intent. OFF suppresses eligible unsent work; ON does not add missing channels to old events. Pause keeps pending work. Reminder freshness ends at opening; no-pickup freshness ends 12 hours after its scheduled check. Thank-you has a proposed seven-day usefulness limit, subject to rollout review. Operation revisions and material order changes hold unsent work for review instead of silently retiming/re-rendering it.

Cancellation and recorded collection stop pending reminder/no-pickup sends. Payment-expired unpaid orders are suppressed even if a cancellation worker has not yet updated their order status. Booking closed/sold-out does not itself cancel an accepted order. A partial refund does not imply fulfillment cancellation. Reactivation is held explicitly; an audited restore workflow for those held intents is outstanding and must precede automatic resume support.

## Delivery reliability

One unique delivery per event/channel; one provider key per delivery; up to four claimed attempts. Retry delays are at least 5, 15 and 60 minutes after the preceding failure, and honor longer provider Retry-After values. Payload/language agree across channels. The shared semantic payload is finalized at first due claim; the channel's exact recipient/request bytes and SHA-256 hash are pinned before HTTP. Later retries reuse those bytes and the same key.

Claims have two-minute leases and random fencing tokens. Prepare revalidates current order, ownership, policy, operation revision, recipient and pause state immediately before HTTP; completion requires the current unexpired token. A stale worker cannot overwrite a newer claim. Requests have 15-second provider timeouts. The dispatcher alternates channels in bounded rounds within its runtime budget.

Expired claims and ambiguous acceptance recover only within the conservative 23-hour provider-key window. Unknown acceptance remains visible as uncertain, including when business state subsequently suppresses further requests. LINE 409 is acceptance only with `x-line-accepted-request-id`; Resend/LINE keys never rotate to retry a possibly accepted message. Auth, quota and conflicting-key errors pause the channel. Provider acceptance means sent to provider, not delivered/read by the customer.

There is no atomic database/provider transaction. Collection or cancellation after final preparation can race an in-flight request. Grace and factual wording reduce this risk; a send already accepted cannot be recalled. No-pickup does not cancel, refund, modify inventory, or promise future availability.

## LINE identity and friendship

Manual contact LINE IDs and browser friendship cache never authorize Messaging API delivery. Recipients must match a current `auth.identities` `custom:line` binding and current server OA evidence under the configured provider/destination context. Unlinking, unfollowing, account deletion or verification loss blocks unsent/retry work.

The webhook verifies HMAC-SHA256 against bounded exact raw bytes before parsing, checks destination, and durably deduplicates event IDs before acknowledgment. Older observations cannot overwrite newer ones; conflicting equal-time follow/unfollow is conservatively unknown. No message history or OAuth tokens are stored.

Existing OA friends can synchronize during a LINE login using their transient provider token. The server verifies token validity and Login channel ID, fetches LINE profile and friendship, then requires the profile ID to match the customer's current trusted identity before recording evidence. Observation time precedes the friendship call so a newer unfollow wins. The frontend keeps its existing browser-only fallback if rollout support is unavailable; fallback does not grant server messaging rights. No unfollow/refollow is required.

Before activation, verify in LINE console that Login and Messaging channels belong to the same provider and that the Login channel is linked to the intended OA. Service-only `notification_line_context_v1` records that reviewed context. `LINE_PROVIDER_MATCH_VERIFIED=true` is a deployment gate, not an automatic provider check.

## Admin and security

Admin / Notifications includes per-event activation/channels/timing, independent pause controls, Bangkok schedule previews, EN/TH/ZH branded Email previews, heartbeat/backlog, read-only no-pickup shadow candidates and masked delivery/attempt history. Preview and shadow checks never send or consume dedupe keys. New renderers reuse the existing JOKO transactional Email shell/logo and emit compact LINE Flex messages.

Trusted profile role checks protect Admin RPCs with optimistic versions. Raw delivery bodies/recipients, relationship evidence, webhook receipts and audit records are not readable or writable by browsers. Worker and verified-evidence RPCs are service-only; implementations live in the private schema with an empty search path and revoked PUBLIC privileges. Dispatcher HTTP requires a dedicated random bearer secret, not a customer JWT. Webhook signature authentication is separate from the internal send privilege.

## Ordered rollout gates

1. Review/merge/apply the pickup-window foundation through its separately authorized rollout. Configure actual concrete operation hours. Verify current payment and pickup changes from parallel work before this migration.
2. Apply `20261010150905_customer_notification_delivery_v1.sql` through the approved database rollout. Confirm disabled policies, paused controls, existing outbox states unchanged and restricted function/table grants. Run Supabase advisors and review any new findings.
3. Deploy the dispatcher, LINE webhook and friendship synchronization functions, then the frontend. Provision server secrets securely: `JOKO_NOTIFICATION_DISPATCH_KEY` (at least 32 random bytes), existing Resend configuration, `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`, `LINE_MESSAGING_CHANNEL_SECRET`, `LINE_PROVIDER_ID`, `LINE_OA_DESTINATION`, and `LINE_LOGIN_CHANNEL_ID`. Set the provider-match flag only after console verification. No credentials belong in browser variables or policy tables.
4. Configure the reviewed provider context with the service-only RPC. Register the webhook and verify signature/redelivery and existing-friend synchronization. Use expressly approved test recipients for live-provider testing; no automated test in this PR messages real customers.
5. Validate on representative staging: current payment/Makers/pickup triggers, real PostgreSQL concurrent workers, checkout and Admin browser flows, all language/long-content renderings, eligibility revocation, API quotas and provider acceptance recovery.
6. Set up the five-minute Cron only after review. The optional `supabase/operations/customer-notifications-cron-v1.sql` requires pg_cron, pg_net and Vault, plus named Vault secrets `joko_customer_notification_dispatch_url` and `joko_customer_notification_dispatch_key`. Review the URL against the intended project; the key must match the Edge secret. This script is not automatically applied. Credentials are read inside the private invocation and are not embedded in `cron.job.command`.
7. Enable reminder only for new orders first. Activate Email independently; activate LINE after recipient/relationship verification. Observe heartbeat, oldest due age, skips, failed attempts and uncertainty.
8. Validate pickup recording and late staff updates before enabling thank-you. Run read-only no-pickup shadow checks across representative closing operations. Agree grace, freshness limits, wording and support handling before enabling no-pickup.

For rollback, pause dispatch/channels and unschedule Cron; retain delivery records and provider keys. Do not drop populated tables or restore a stale backup and resume sending without reconciling provider acceptance. Retention/deletion and manual resend are intentionally not automated.

## Validation commands and limits

```sh
npm ci
npm run typecheck
npm run build
npx deno check --node-modules-dir=manual --no-config supabase/functions/dispatch-customer-notifications/index.ts supabase/functions/line-oa-webhook/index.ts supabase/functions/sync-line-oa-friendship/index.ts
node scripts/test-customer-notification-adapters.mjs
node scripts/test-customer-notification-edge.mjs
PGLITE_MODULE=/absolute/path/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-customer-notifications-db.mjs
```

The isolated SQL fixture checks enrollment, Bangkok anchors, legacy preservation, policy versions, per-channel claims, retry bytes/keys, fencing, stale leases, uncertain acceptance, payment expiry, pickup suppression, webhook replay/order, friendship ownership and actual role grants. PGlite is a single backend; this is not proof of real multi-session PostgreSQL concurrency or every production trigger. Edge request tests inject database/provider stubs, including acceptance followed by a lost response; they do not call live providers. Browser testing remains a rollout gate because the local Chromium download failed.

Current documentation checked: Supabase changelog (including the September PostgreSQL minor-release breaking notice), Functions scheduling guide, LINE Login token verification API, webhook signature guide and Messaging API retry guide. The breaking notice concerns ltree, legacy pgcrypto ciphers, float btree_gist indexes and custom estimators; this schema does not introduce those features.
