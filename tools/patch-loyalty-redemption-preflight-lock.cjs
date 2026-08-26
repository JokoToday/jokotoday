const fs = require('fs');

const path = 'supabase/migrations/20260826021421_loyalty_v2_staff_fulfillment.sql';
let text = fs.readFileSync(path, 'utf8');

const anchor = `-- production reconciliation can be reviewed explicitly before retrying.\nDO $$`;
const replacement = `-- production reconciliation can be reviewed explicitly before retrying.\n-- Supabase applies each migration file transactionally. Take the same SHARE lock\n-- required by CREATE INDEX before inspecting the predicate so concurrent foundation\n-- redemption writes cannot slip in between the diagnostic preflight and index build.\n-- The lock is retained through the following CREATE UNIQUE INDEX until commit.\nLOCK TABLE public.loyalty_redemptions IN SHARE MODE;\n\nDO $$`;

const matches = text.split(anchor).length - 1;
if (matches !== 1) {
  throw new Error(`Expected exactly one duplicate-preflight anchor, found ${matches}`);
}

text = text.replace(anchor, replacement);
fs.writeFileSync(path, text);
