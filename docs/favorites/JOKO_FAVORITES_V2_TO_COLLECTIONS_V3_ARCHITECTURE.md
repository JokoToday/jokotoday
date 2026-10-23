# JOKO My Favorites v2 → Shareable Collections v3

**Status:** Architecture decision for PR #319; v3 is *not implemented*.
**Decision:** Keep Favorites private by default. Expose other customers' collections only through an explicit publishing mechanism with independently enforced read permissions. A like never grants access to the liker’s identity or personal library.

## Product behavior

- **v2:** My Favorites has All / JOKO Bakery / JOKO Store / Creators / Recipes. A customer's private product likes remain in `product_likes`; creator and recipe bookmarks live in `account_saved_items`. Likes and favorites are owned by one authenticated user; other customers see aggregated public counts only where published.
- **v3:** Customers may create *named collections*: “Weekend Baking Ideas,” “Chiang Mai Creators,” “Sunday Treats.” A collection has a title, optional description, cover and ordered entries. Initial visibility is **private**. Customer may explicitly select **Anyone with the link** or **Public**. No automatic publishing of My Favorites, follower graphs or contact lists.
- A public/shared collection exposes **only** its curated entries and the display attribution the owner consented to. It never exposes the owner’s entire favorites, internal user UUID, email, phone, purchases, checkout details or notification preferences.
- Visitors may browse public/shared collections, optionally save individual items into *their own* Favorites, and can see creator/source attribution. They cannot alter the collection. Public creator profiles and published recipes/products may be linked; unavailable/private items render as unavailable rather than leaking hidden content.

## Stable identity and source-of-truth

| Content | v2 source of truth | v3 collection reference |
|---|---|---|
| Bakery products | `product_likes` + `cms_products` | `product` + immutable product UUID |
| Store products (including maker products) | `product_likes` + `cms_products` | `product` + same product UUID |
| Creator profiles | `account_saved_items` + `cms_makers` | `creator` + immutable creator UUID |
| JOKO DIY recipes | `account_saved_items` with string fixture IDs | `recipe` + **published recipe UUID** once persistent recipe cards ship |

**Do not** classify creator-made products as creator-profile bookmarks. Product origin/`catalog_scope` is only a filter, never a separate favorite identity. When recipe drafts become published canonical records, migrate fixture IDs with an explicit mapping table; never silently reuse a title or source URL as a stable identifier. Collection item type references should resolve through a typed, server-validated registry or explicit lookups against published rows; polymorphic IDs cannot be protected by foreign keys alone.

## Proposed v3 tables (design only; do not migrate with PR #319)

`joko_collections`
- `id uuid primary key`, `owner_user_id uuid not null references auth.users`, `title text`, `description text`, `cover_asset_id`, `visibility text check in ('private','unlisted','public') default 'private'`, `created_at`, `updated_at`, `published_at`, `revoked_at`
- `public_slug` nullable unique for public discovery, and **opaque unguessable share token** for unlisted URLs. Store the token hash, never raw token, with a rotation/revocation operation. A public slug is not an unlisted access token.
- Explicit `share_display_name` / `show_attribution` preference, independent of user profile visibility. Default anonymous/attribution off.

`joko_collection_items`
- `collection_id uuid references joko_collections(id) on delete cascade`, `item_type text check in ('product','creator','recipe')`, `item_id text` (canonical stable ID), `position integer`, `note text`, `added_at`, composite unique `(collection_id,item_type,item_id)`; ownership enforced by parent collection authorization.
- **Snapshot policy:** Do not embed customer-private or product-private attributes in items. Public read resolves current published/active content from the appropriate public catalog and excludes unpublished/retired resources.

Potential `joko_collection_share_events` internal audit: creator, timestamp, action (publish, unpublish, revoke/rotate), actor; access restricted to owner/admin through controlled server functions.

## Access policy and API boundary

1. **Private:** owner only; use `auth.uid() = owner_user_id` for read/write. Items inherit authorization from parent; visitors cannot write parent or children.
2. **Public:** optionally browsable/indexable; read via a minimal `security_invoker` view or controlled read-only function/API that returns a *whitelist* of published collection metadata and active, published items; no direct access to the owner's `product_likes` or `account_saved_items`.
3. **Unlisted:** possessing the complete unguessable token grants read access to a *specific* collection, not a customer account. Do **not** grant unlisted reads through generic table SELECT policies that merely check `visibility='unlisted'`: a slug/UUID is not authorization. Validate hashed token in a dedicated server endpoint (with rate limits); avoid leaking token into analytics, third-party referrers or logs. Rotate/revoke tokens.
4. **Editing:** owner-authenticated mutations with RLS + server-side validation for max items, permitted content types, publication state and rate limits. A user must not add another user's unpublished resources or change `owner_user_id`.
5. **Aggregate likes:** query grouped counts via privacy-safe public aggregation, not lists of which users liked an item. Sharing collections does not change the privacy of likes.
6. **Safety/moderation:** flag/report and unpublish capabilities, limits on personal information in user-authored titles/notes, deletion handling, and optional search indexing only for public collections.

## Suggested public routes

- `/my-likes` remains the existing private dashboard (v2).
- `/my-collections` becomes the owner’s v3 collection manager.
- `/collections/{public-slug}` for deliberately public collections.
- `/c/{opaque-share-token}` for unlisted, revocable links, served via token-validating endpoint. Never put email, user UUID, or authenticated account IDs into share URLs.

## UX rollout

1. Ship **v2** account-scoped favorites after real Auth/browser integration tests and reviewed production migration.
2. Add **v3 private collections** first: create, rename, reorder, remove items; import a *copy* of chosen favorites into a collection. No automatic bulk exposure.
3. Add **unlisted** sharing with token revocation/expiration; verify unauthenticated access to shared items only and denial after token revocation.
4. Add **public** collections/discovery with owner opt-in, attribution choice, moderation, throttling, and explicit privacy messaging.

## Tests required before enabling any v3 sharing

- Two distinct genuine Auth sessions: A can edit own collection; B cannot see private collection, read raw favorite rows, add/remove entries, modify visibility, or publish on A's behalf.
- Anonymous/B access to public collection returns only whitelisted fields; private and unlisted collections are absent from public listing/search.
- Tokenless unlisted access fails even if UUID or slug is known; a valid token succeeds; rotation/revocation invalidates old token; rate limiting observed.
- Deleting an account or collection cascades content correctly; hiding a product/creator/recipe removes it from visitor-visible resolved items; no private data escapes from cached responses.
- English / Thai / Chinese and mobile layouts, blocked auth flow, sign-in, refresh, switch account, share-link copy, revoke and re-publish.

## PR #319 compatibility contract

Do **not** add collection tables or any policy allowing cross-user `SELECT` to `account_saved_items` in PR #319. Preserve existing `product_likes`. `account_saved_items` `(user_id,item_type,item_id)` remains the account-scoped v2 data source; future v3 collections *reference canonical catalog content*, not the owner's private favorite rows. This avoids future migration of user privacy settings and keeps v3 additive. This document is architecture only—not approval to publish user data.
