const fs = require('fs');

const path = 'supabase/migrations/20260826021421_loyalty_v2_staff_fulfillment.sql';
let text = fs.readFileSync(path, 'utf8');
const needle = 'LOCK TABLE public.loyalty_redemptions IN SHARE MODE;\n\nDO $\nDECLARE';
const replacement = 'LOCK TABLE public.loyalty_redemptions IN SHARE MODE;\n\nDO $$\nDECLARE';
const count = text.split(needle).length - 1;
if (count !== 1) throw new Error(`Expected one malformed DO $ opener after the SHARE lock, found ${count}`);
text = text.replace(needle, () => replacement);
if (!text.includes(replacement) || text.includes('\nDO $\nDECLARE')) {
  throw new Error('Dollar-quote repair assertion failed');
}
fs.writeFileSync(path, text);
