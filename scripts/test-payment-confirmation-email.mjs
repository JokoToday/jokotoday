// Execute the actual handler with projection-aware database and email adapters.
// No provider calls or real customer messages.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile('supabase/functions/send-payment-confirmation/index.ts', 'utf8');
const compiled = ts.transpileModule(source.replace(/^import[\s\S]*?;\n/gm, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const order = {
  id: '11111111-1111-4111-8111-111111111111', order_number: 'TEST-EMAIL', customer_id: 'customer',
  customer_name: 'Synthetic Customer', customer_email: 'fixture@example.invalid',
  total_amount: 110, loyalty_discount_amount: 10, amount_paid: 100,
  payment_status: 'paid', payment_method: 'promptpay_online', status: 'confirmed',
  pickup_date: '2026-10-17', pickup_location_id: 'place',
  order_items: [{ product_id: 'product', product_name: 'Test bread', product_name_th: 'ขนมปังทดสอบ', product_name_zh: '测试面包', quantity: 1, price_at_order: 110 }],
};
const snapshot = { name_en: 'Original pickup place', name_th: 'สถานที่เดิม', name_zh: '原取货点', start_at: '2026-10-14T02:30:00Z', end_at: '2026-10-14T03:00:00Z' };
async function run({ lang = 'en', specials = false, paused = false, unpaid = false, amountPaid = 100 } = {}) {
  let handler; const sends = [], projections = [], filters = [];
  const row = { ...order, amount_paid: amountPaid, payment_status: unpaid ? 'unpaid' : 'paid', specials_pickup_snapshot: specials ? snapshot : null };
  const db = { from(table) {
    let projection;
    const q = { select(value) { projection = value; if (table === 'orders') projections.push(value); return q; },
      eq(key, value) { if (table === 'orders') filters.push([key, value]); return q; },
      async maybeSingle() {
        const data = table === 'orders' ? Object.fromEntries(projection.split(',').map(k => [k.trim(), row[k.trim()]]))
          : table === 'user_profiles' ? { preferred_language: lang }
          : table === 'payment_transactions' ? { payment_mode: 'stripe_promptpay' }
          : { id: 'place', name_en: 'Renamed place', name_th: 'สถานที่ใหม่', name_zh: '新取货点' };
        return { data, error: null };
      } };
    return q;
  } };
  const helpers = {
    authenticateNotificationRequest: async () => ({ ok: true, value: { supabase: db, user: { id: 'customer' }, internal: false } }),
    claimNotification: async () => ({ mode: 'outbox', claim: { outcome: 'claimed', event_id: 'event', language: lang } }),
    customerNotificationChannelEnabled: async (_, channel) => !paused && channel === 'email',
    finishNotification: async () => true, handlePreflight: () => new Response(),
    lineOnlyDeliveryResponse: (req, emailEnabled) => emailEnabled ? null : new Response('{}', { status: 200 }),
    isValidUuid: () => true, jsonResponse: (req, status, body) => new Response(JSON.stringify(body), { status }),
    notificationIdempotencyKey: () => 'fixture', providerErrorSummary: String,
    rejectDisallowedOrigin: () => null, sendCustomerLineNotification: async () => 'sent',
    buildTransactionalEmailShell: ({ contentHtml }) => contentHtml,
    escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;'),
    JOKO_EMAIL_THEME: {}, jokoEmailLogoAttachment: () => ({}), renderPrimaryButton: () => '',
    Resend: class { emails = { send: async message => { sends.push(message); return { data: { id: 'synthetic' }, error: null }; } }; },
    Deno: { env: { get: () => 'synthetic' }, serve: fn => { handler = fn; } },
  };
  new Function(...Object.keys(helpers), compiled)(...Object.values(helpers));
  const response = await handler(new Request('https://test.invalid', { method: 'POST', body: JSON.stringify({ order_id: order.id }) }));
  return { response, sends, projections, filters };
}
for (const lang of ['en', 'th', 'zh']) {
  const regular = await run({ lang });
  assert.equal(regular.response.status, 200); assert.equal(regular.sends.length, 1);
  assert.equal(regular.projections.length, 1);
  assert.ok(regular.projections[0].includes('specials_pickup_snapshot'));
  assert.ok(regular.sends[0].text.includes('฿100.00'));
  assert.ok(!regular.sends[0].text.includes('JOKO Specials'));
  assert.deepEqual(regular.filters, [['id', order.id], ['purchase_type', 'online'], ['customer_id', 'customer']]);
  const special = await run({ lang, specials: true });
  assert.equal(special.response.status, 200);
  const expected = lang === 'th' ? snapshot.name_th : lang === 'zh' ? snapshot.name_zh : snapshot.name_en;
  for (const body of [special.sends[0].html, special.sends[0].text]) {
    assert.ok(body.includes(expected)); assert.ok(body.includes('09:30–10:00'));
    assert.ok(body.includes('JOKO Specials')); assert.ok(!body.includes('Renamed place'));
    assert.ok(body.includes('฿100.00'));
  }
}
assert.equal((await run({ paused: true })).sends.length, 0);
const unpaid = await run({ unpaid: true }); assert.equal(unpaid.response.status, 409); assert.equal(unpaid.sends.length, 0);
assert.ok((await run({ amountPaid: null })).sends[0].text.includes('฿100.00'));
console.log('PASS: actual payment email handler; one complete projection; immutable Specials window/location in EN/TH/ZH; regular totals, ownership, unpaid and pause guards');
