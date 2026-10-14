# Test-only prerequisite for regular checkout release verification

Prepared, not applied. Target: JOKO Specials Test (szijiljpasxddzgzckra).
Production rollout does not include this package.

Root cause: getProducts() queries cms_products with the cms_makers relationship; the sandbox has neither cms_makers nor cms_products.maker_id. Three test catalogue products already exist. Pickup schedules/dates and dated regular inventory are absent.

Apply these existing reviewed migrations only to the test project:
- 20261009152636_joko_makers_v1.sql: Makers table, product relationship/origin, publication RLS, Admin write policies, order snapshot/ordering guard.
- 20261010102901_makers_snapshot_immutability_fix.sql: preserve historical maker attribution on order updates.
Then apply specials-test-regular-checkout-fixtures-20261014.sql: one test Saturday schedule/date (17 October), Test Mae Rim 09:00–17:00 in 30-minute slots, existing TEST — Butter Croissant with 10 fictitious units; test dated checkout and pickup-window requirement enabled. Sales cutoff: 15 October 17:00 Bangkok.
Do not import real customer/production data, change credentials, activate notifications or mark payment/refund evidence manually.

Validation: existing Makers isolated SQL suite passed (role permissions, draft visibility, snapshot immutability, checkout guards). Fixture SQL ran successfully against the test project inside a transaction that was rolled back; verified no fixture was retained. Existing test notification pause flags remain true.

Refund gate: JOKO order JT-1018 remains refund_pending; inventory released, fulfillment cancelled. Stripe connector read attempts returned repeated authentication failures, so current provider status/next_action could not be retrieved. PromptPay documentation requires customer bank information for refunds; sandbox behavior is not real-money settlement. Do not enter real bank details or label this refund completed without signed provider evidence.

Approval requested for these two schema migrations and named fixtures in the test project only, since they add RLS/access policies and an order trigger beyond the previously approved notification-preferences migration. The package is atomic and records individual migration history. Stop on an unexpected project or existing Makers schema, rather than applying blindly.
