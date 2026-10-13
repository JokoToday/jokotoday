import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Budget } from './budget.mjs';
import { createEngine, createOpenAI, TURN_RESERVE_MICROS } from './engine.mjs';
import { projectSnapshot, validateArguments, createInventory } from './inventory.mjs';
import { createAssistantServer } from './server.mjs';

const id = '00000000-0000-4000-8000-000000000001';
const snapshot = () => ({ checked_at: new Date().toISOString(), timezone: 'Asia/Bangkok', scope: 'regular_preorders', results: [{ id, name: { en: 'Croissant', th: 'ครัวซองต์', zh: '' }, price: 40, currency: 'THB', product_url: 'https://joko.today/products/croissant', available_to_order: true, pickups: [{ pickup_date: '2030-10-19', order_cutoff_at: '2030-10-18T10:00:00Z', remaining_quantity: 8, locations: [{ id, name_en: 'Mae Rim', name_th: 'แม่ริม' }] }] }] });
function budgetFor(t, allowance = TURN_RESERVE_MICROS) {
  const path = mkdtempSync(join(tmpdir(), 'joko-assistant-'));
  const budget = new Budget(path, allowance);
  t.after(() => { budget.close(); rmSync(path, { recursive: true, force: true }); });
  return { budget, path };
}
const usage = { input_tokens: 300, output_tokens: 100 };
const toolResponse = { status: 'completed', usage, output: [{ type: 'function_call', name: 'search_joko_products', call_id: 'call1', arguments: JSON.stringify({ query: 'croissant', limit: 3, pickup_date: null, location_id: null }) }] };
const answerResponse = { status: 'completed', usage, output: [{ type: 'message', content: [{ type: 'output_text', text: 'Choose a pickup date. Availability is checked again at checkout.' }] }] };

test('persistent spending reservation excludes concurrent work and survives restart', t => {
  const { budget, path } = budgetFor(t);
  const settle = budget.reserve(TURN_RESERVE_MICROS);
  assert.throws(() => budget.reserve(1), /Budget exhausted/);
  assert.throws(() => new Budget(path, TURN_RESERVE_MICROS), /EEXIST/);
  budget.close();
  const restarted = new Budget(path, TURN_RESERVE_MICROS);
  assert.throws(() => restarted.reserve(1), /Budget exhausted/);
  restarted.close();
  settle(500);
  assert.equal(budget.state.charged, 500);
});
test('valid model tool round uses projected inventory and usage settlement', async t => {
  const { budget } = budgetFor(t);
  const requests = [];
  let step = 0;
  const engine = createEngine({ budget, provider: async body => { requests.push(structuredClone(body)); return step++ === 0 ? toolResponse : answerResponse; }, inventory: async () => snapshot() });
  const result = await engine({ message: 'Croissants?', language: 'th' });
  assert.equal(result.products[0].price, 40);
  assert.equal(requests[0].store, false);
  assert.equal(requests[0].tool_choice, 'required');
  assert.match(requests[0].instructions, /Thai/);
  assert.equal(budget.state.charged, 1350);
  assert.equal(result.products[0].pickups[0].locations[0].name.en, 'Mae Rim');
  assert.equal(result.products[0].pickups[0].order_cutoff_local, '2030-10-18 17:00');
});
test('unknown provider outcome remains fully charged', async t => {
  const { budget } = budgetFor(t);
  const engine = createEngine({ budget, provider: async () => { throw Error('timeout'); }, inventory: async () => snapshot() });
  await assert.rejects(engine({ message: 'Croissants?' }));
  assert.equal(budget.state.charged, TURN_RESERVE_MICROS);
});
test('upstream failure never returns stale stock and only known usage is charged', async t => {
  const { budget } = budgetFor(t);
  const engine = createEngine({ budget, provider: async () => toolResponse, inventory: async () => { throw Error('Unavailable'); } });
  await assert.rejects(engine({ message: 'Croissants?' }));
  assert.equal(budget.state.charged, 675);
});
test('unapproved tools and arbitrary arguments never reach inventory', async t => {
  const { budget } = budgetFor(t);
  let called = false;
  const engine = createEngine({ budget, provider: async () => ({ ...toolResponse, output: [{ ...toolResponse.output[0], name: 'delete_order' }] }), inventory: async () => { called = true; } });
  await assert.rejects(engine({ message: 'Delete order' }));
  assert.equal(called, false);
  assert.throws(() => validateArguments('search_joko_products', { url: 'http://evil' }));
  assert.throws(() => validateArguments('search_joko_products', { pickup_date: '2030-02-30' }));
  assert.throws(() => createInventory('http://169.254.169.254/mcp'));
  assert.equal(validateArguments('search_joko_products', { query: 'ครัวซองต์' }).query, 'croissant');
  assert.equal(validateArguments('search_joko_products', { query: 'ครัวซอง' }).query, 'croissant');
  assert.equal(validateArguments('search_joko_products', { query: 'ครัวซองต์อัลมอนด์' }).query, 'ครัวซองต์อัลมอนด์');
});
test('inventory projection rejects stale/unsafe links and removes private fields', () => {
  const raw = snapshot(); raw.results[0].customer_email = 'private@example.com';
  const projected = projectSnapshot(raw);
  assert.equal(projected.results[0].customer_email, undefined);
  raw.checked_at = '2020-01-01T00:00:00Z'; assert.throws(() => projectSnapshot(raw));
  raw.checked_at = new Date().toISOString(); raw.results[0].product_url = 'https://evil.test/product'; assert.throws(() => projectSnapshot(raw));
});
test('expired cutoff is not orderable and quantity is not duplicated by location', () => {
  const raw = snapshot();
  raw.results[0].pickups[0].locations.push({ id, name_en: 'Town', name_th: '' });
  assert.equal(projectSnapshot(raw).results[0].pickups[0].remaining_quantity, 8);
  raw.results[0].pickups[0].order_cutoff_at = '2020-01-01T00:00:00Z';
  assert.equal(projectSnapshot(raw).results[0].available_to_order, false);
});
test('no tool evidence or unbounded context cannot produce an inventory answer', async t => {
  const { budget } = budgetFor(t, TURN_RESERVE_MICROS * 2);
  let calls = 0;
  const engine = createEngine({ budget, provider: async () => { calls++; return answerResponse; }, inventory: async () => snapshot() });
  await assert.rejects(engine({ message: 'Croissants?' }), /No inventory evidence/);
  await assert.rejects(engine({ message: 'x'.repeat(20000) }), /Context too large/);
  assert.equal(calls, 1);
});
async function apiFor(t, options = {}) {
  const server = createAssistantServer({ enabled: true, origins: ['https://joko.today'], engine: async () => ({ answer: 'Hello', products: [], checked_at: new Date().toISOString() }), ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return async (path, body, extra = {}) => fetch(`http://127.0.0.1:${server.address().port}/api/assistant/${path}`, { method: 'POST', headers: { Origin: 'https://joko.today', 'Content-Type': 'application/json', ...(extra.headers ?? {}) }, body: JSON.stringify(body), ...extra, ...(extra.headers ? { headers: { Origin: 'https://joko.today', 'Content-Type': 'application/json', ...extra.headers } } : {}) });
}
test('HTTP origin/session validation and duplicate messages', async t => {
  let calls = 0;
  const api = await apiFor(t, { engine: async ({ message }) => { calls++; return { answer: message, products: [] }; } });
  assert.equal((await api('session', {}, { headers: { Origin: 'https://evil.test' } })).status, 403);
  assert.equal((await api('messages', { sessionId: 'invented' })).status, 401);
  const { sessionId } = await (await api('session', {})).json();
  const body = { sessionId, clientRequestId: randomUUID(), message: 'ครัวซองต์', language: 'th' };
  const result = await (await api('messages', body)).json();
  assert.equal(result.answer, 'ครัวซองต์');
  assert.equal((await api('messages', body)).status, 200);
  assert.equal(calls, 1);
  assert.equal((await api('messages', { ...body, message: 'different' })).status, 400);
  await api('session', { sessionId }, { method: 'DELETE' });
  assert.equal((await api('messages', body)).status, 401);
});
test('disabled service cannot invoke engine', async t => {
  const api = await apiFor(t, { enabled: false, engine: () => { throw Error('must not call'); } });
  assert.equal((await api('session', {})).status, 503);
});
test('same-session concurrent work is rejected and uncertain failure is cached', async t => {
  let release;
  let calls = 0;
  const api = await apiFor(t, { engine: async () => { calls++; await new Promise(resolve => { release = resolve; }); throw Error('provider timeout'); } });
  const { sessionId } = await (await api('session', {})).json();
  const body = { sessionId, clientRequestId: randomUUID(), message: 'Croissants?', language: 'en' };
  const pending = api('messages', body);
  while (!release) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal((await api('messages', body)).status, 409);
  release(); assert.equal((await pending).status, 503);
  assert.equal((await api('messages', body)).status, 503);
  assert.equal(calls, 1);
});
test('OpenAI transport uses fixed server key endpoint and no retries', async () => {
  let calls = 0;
  const provider = createOpenAI('test-only', async (url, options) => {
    calls++; assert.equal(url, 'https://api.openai.com/v1/responses'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer test-only'); return { ok: false };
  });
  await assert.rejects(provider({})); assert.equal(calls, 1);
});

test('Chinese requests and croissant aliases use the approved inventory path', async t => {
  let seenLanguage;
  const api = await apiFor(t, { engine: async ({ language }) => { seenLanguage = language; return { answer: '请选择取货日期。', products: [] }; } });
  const { sessionId } = await (await api('session', {})).json();
  const response = await api('messages', { sessionId, clientRequestId: randomUUID(), message: '有哪些可颂？', language: 'zh' });
  assert.equal(response.status, 200); assert.equal(seenLanguage, 'zh');
  assert.equal(validateArguments('search_joko_products', { query: '可颂' }).query, 'croissant');
  assert.equal(validateArguments('search_joko_products', { query: '牛角包' }).query, 'croissant');
  const { budget } = budgetFor(t); let rounds = 0;
  const engine = createEngine({ budget, inventory: async () => snapshot(), provider: async body => { assert.match(body.instructions, /Simplified Chinese/); return rounds++ ? answerResponse : toolResponse; } });
  await engine({ message: '可颂', language: 'zh', requestId: 'fixture' });
});
