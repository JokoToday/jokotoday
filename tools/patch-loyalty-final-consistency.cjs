const fs = require('fs');
const path = require('path');

function replaceOnce(text, from, to, label) {
  const first = text.indexOf(from);
  if (first < 0) throw new Error(`Missing expected pattern for ${label}`);
  if (text.indexOf(from, first + from.length) >= 0) throw new Error(`Ambiguous repeated pattern for ${label}`);
  return text.slice(0, first) + to + text.slice(first + from.length);
}

const foundationPath = 'supabase/migrations/20260825172000_loyalty_v2_foundation.sql';
const staffPath = 'supabase/migrations/20260826021421_loyalty_v2_staff_fulfillment.sql';
const auditPath = 'supabase/audits/20260826_loyalty_v2_staff_fulfillment.sql';

let foundation = fs.readFileSync(foundationPath, 'utf8');
foundation = replaceOnce(
  foundation,
  `CREATE TABLE IF NOT EXISTS public.loyalty_point_events (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n`,
  `CREATE TABLE IF NOT EXISTS public.loyalty_point_events (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  event_sequence bigint GENERATED ALWAYS AS IDENTITY,\n`,
  'loyalty point event sequence column'
);
foundation = replaceOnce(
  foundation,
  `CREATE INDEX IF NOT EXISTS loyalty_point_events_customer_created_idx\n  ON public.loyalty_point_events (customer_id, created_at DESC);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS loyalty_point_events_event_sequence_uq\n  ON public.loyalty_point_events (event_sequence);\n\nCREATE INDEX IF NOT EXISTS loyalty_point_events_customer_created_idx\n  ON public.loyalty_point_events (customer_id, created_at DESC);`,
  'loyalty point event sequence uniqueness'
);
fs.writeFileSync(foundationPath, foundation);

let staff = fs.readFileSync(staffPath, 'utf8');
const calculatorAnchor = `CREATE UNIQUE INDEX IF NOT EXISTS orders_staff_request_key_uq\n  ON public.orders (staff_request_key)\n  WHERE staff_request_key IS NOT NULL;`;
const calculatorReplacement = `-- Rebind the retained order calculator after amount_paid exists. Legacy and online\n-- orders still calculate from gross total_amount; v2 Walk-In orders persist their\n-- actual net-paid earning snapshot so the order row, ledger, and replay response agree.\nCREATE OR REPLACE FUNCTION public.calculate_loyalty_points_on_order()\nRETURNS trigger\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public\nAS $$\nDECLARE\n  v_rate numeric;\n  v_purchase_type text;\n  v_earning_amount numeric;\nBEGIN\n  v_purchase_type := COALESCE(NEW.purchase_type, 'online');\n\n  SELECT ls.points_per_baht\n  INTO v_rate\n  FROM public.loyalty_settings ls\n  WHERE ls.purchase_type = v_purchase_type;\n\n  v_rate := COALESCE(v_rate, 0);\n  v_earning_amount := CASE\n    WHEN v_purchase_type = 'walk_in' AND NEW.amount_paid IS NOT NULL\n      THEN NEW.amount_paid\n    ELSE NEW.total_amount\n  END;\n\n  NEW.loyalty_points_earned := round(COALESCE(v_earning_amount, 0) * v_rate);\n  NEW.loyalty_multiplier := v_rate;\n\n  RETURN NEW;\nEND;\n$$;\n\nREVOKE ALL ON FUNCTION public.calculate_loyalty_points_on_order() FROM PUBLIC, anon, authenticated;\n\n${calculatorAnchor}`;
staff = replaceOnce(staff, calculatorAnchor, calculatorReplacement, 'net-aware Walk-In loyalty calculator');

const returningAnchor = `  )\n  RETURNING * INTO v_order;\n\n  v_balance := COALESCE(v_customer.loyalty_points, 0);`;
const returningReplacement = `  )\n  RETURNING * INTO v_order;\n\n  -- The retained BEFORE INSERT calculator is authoritative for the persisted\n  -- earning snapshot. Reuse its returned value for the ledger and RPC response.\n  v_points_earned := COALESCE(v_order.loyalty_points_earned, 0);\n  v_balance := COALESCE(v_customer.loyalty_points, 0);`;
staff = replaceOnce(staff, returningAnchor, returningReplacement, 'Walk-In persisted earning authority');
fs.writeFileSync(staffPath, staff);

let audit = fs.readFileSync(auditPath, 'utf8');
audit = replaceOnce(
  audit,
  `WHERE o.loyalty_points_awarded_at IS NOT NULL\n  AND COALESCE(o.loyalty_discount_amount, 0) > 0`,
  `WHERE o.loyalty_points_awarded_at IS NOT NULL\n  AND COALESCE(o.purchase_type, 'online') = 'online'\n  AND COALESCE(o.loyalty_discount_amount, 0) > 0`,
  'legacy grandfather audit online scope'
);
audit = replaceOnce(
  audit,
  `ORDER BY e.customer_id, e.created_at DESC, e.id DESC`,
  `ORDER BY e.customer_id, e.event_sequence DESC`,
  'latest loyalty ledger deterministic ordering'
);
fs.writeFileSync(auditPath, audit);

// Targeted assertions.
const finalFoundation = fs.readFileSync(foundationPath, 'utf8');
const finalStaff = fs.readFileSync(staffPath, 'utf8');
const finalAudit = fs.readFileSync(auditPath, 'utf8');

for (const [label, ok] of [
  ['event sequence identity', finalFoundation.includes('event_sequence bigint GENERATED ALWAYS AS IDENTITY')],
  ['event sequence unique index', finalFoundation.includes('loyalty_point_events_event_sequence_uq')],
  ['Walk-In amount_paid calculator', finalStaff.includes("WHEN v_purchase_type = 'walk_in' AND NEW.amount_paid IS NOT NULL") && finalStaff.includes('THEN NEW.amount_paid')],
  ['persisted Walk-In earning authority', finalStaff.includes('v_points_earned := COALESCE(v_order.loyalty_points_earned, 0);')],
  ['grandfather audit online-only', finalAudit.includes("AND COALESCE(o.purchase_type, 'online') = 'online'")],
  ['latest ledger uses sequence', finalAudit.includes('ORDER BY e.customer_id, e.event_sequence DESC')],
  ['old timestamp/uuid latest ordering removed', !finalAudit.includes('ORDER BY e.customer_id, e.created_at DESC, e.id DESC')],
]) {
  if (!ok) throw new Error(`Assertion failed: ${label}`);
}

// Guard against another changed audit retaining the same nondeterministic latest-event idiom.
for (const file of fs.readdirSync('supabase/audits')) {
  if (!file.endsWith('.sql')) continue;
  const text = fs.readFileSync(path.join('supabase/audits', file), 'utf8');
  if (text.includes('ORDER BY e.customer_id, e.created_at DESC, e.id DESC')) {
    throw new Error(`Nondeterministic latest loyalty-event ordering remains in supabase/audits/${file}`);
  }
}

console.log('Applied final Loyalty v2 consistency fixes.');
