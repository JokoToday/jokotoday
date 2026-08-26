const fs = require('fs');

const path = 'supabase/migrations/20260826025000_loyalty_v2_pickup_payment_guard.sql';
const text = fs.readFileSync(path, 'utf8');
const required = [
  "IF COALESCE(v_order.payment_status, 'unpaid') <> 'paid' THEN",
  "IF v_order.payment_method IS NULL",
  "OR v_order.payment_method NOT IN ('cash', 'qr_code', 'qr') THEN",
  "RAISE EXCEPTION 'Valid payment method must be recorded before pickup';",
];
for (const snippet of required) {
  if (!text.includes(snippet)) throw new Error(`Missing pickup payment guard: ${snippet}`);
}
const statusIndex = text.indexOf(required[0]);
const methodIndex = text.indexOf(required[1]);
const pickupIndex = text.indexOf("IF v_order.status NOT IN ('picked_up', 'completed') THEN");
if (!(statusIndex >= 0 && methodIndex > statusIndex && pickupIndex > methodIndex)) {
  throw new Error('Payment status/method guards must run before pickup state transition');
}
console.log(`Validated pickup payment method gate: status=${statusIndex}, method=${methodIndex}, pickup=${pickupIndex}`);
