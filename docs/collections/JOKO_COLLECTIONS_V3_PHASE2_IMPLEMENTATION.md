# JOKO Collections v3 — Phase 2: unlisted link sharing

Status: work in progress; do not deploy or expose sharing yet.

## Privacy contract

- Existing private collections and `product_likes`/`account_saved_items` remain private under their existing RLS rules.
- A user explicitly enables an unlisted link for one collection. The full URL carries an opaque random token with at least 256 bits of entropy.
- Database persists only a cryptographic hash of the token, never the original. Creating a new link replaces the old hash atomically, immediately invalidating old links. Turning sharing off revokes the link.
- Anonymous reads go through an Edge Function that validates the token server-side and returns only title, sanitized display metadata, and published catalog items. No direct public SQL policies and no member UUID, email, phone, orders or favorites.
- Disable shared DIY recipes until their canonical published UUIDs exist. Never render unverified fixture IDs or unpublished item descriptions.
- Prefer `Cache-Control: no-store` and `Referrer-Policy: no-referrer` on share pages; do not send share URLs to analytics.
- Implement owner-only creation, rotation and revocation; rate limits, server-side item validation, anonymous/non-owner tests, and link expiration before enabling public access.

## Isolated rollout checklist

1. Build Edge Function for authenticated owner create/rotate/revoke and token-only read.
2. Ensure Edge Function resolves active products and published creators with a strict response-field allowlist, excluding fixture recipes.
3. Deploy to isolated Supabase only; run A/B/anonymous, invalid/expired/rotated token, and unpublished content tests.
4. Build three-language owner UI and read-only visitor page; verify mobile and no private identifiers in network responses.
5. Merge and deploy only after security review, explicit authorization and production migration.

Public discoverable collections are **Phase 3**, not part of this change.
