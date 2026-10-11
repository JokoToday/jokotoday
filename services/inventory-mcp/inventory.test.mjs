import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { createCatalog, publicConfig } from './catalog.mjs';
import { createApp } from './server.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const id = '00000000-0000-4000-8000-000000000001';
const location = '00000000-0000-4000-8000-000000000002';
const product = { id, slug: 'croissant', name_en: 'Croissant', name_th: 'ครัวซองต์', price: 80, is_active: true, product_origin: 'house' };
const pickup = { product_id: id, pickup_date: '2030-01-01', order_cutoff_at: '2030-01-01T00:00:00Z', remaining_quantity: 7, locations: [{ id: location, name_en: 'Bakery', customer_email: 'private' }] };
function fixture(products = [product], rows = [pickup], enabled = true) {
  return createCatalog({ url: 'https://example.supabase.co', key: 'sb_publishable_test' }, async (url, options) => {
    assert.equal(options.headers.Authorization, undefined);
    assert.ok(!url.includes('orders'));
    return Response.json(url.includes('cms_settings') ? [{ value: String(enabled) }] : url.includes('cms_products') ? products : rows);
  });
}
test('public credentials only', () => {
  assert.throws(() => publicConfig({ JOKO_SUPABASE_URL: 'https://example.com', JOKO_SUPABASE_PUBLIC_KEY: 'sb_secret_bad' }));
  assert.throws(() => publicConfig({ JOKO_SUPABASE_URL: 'http://example.com', JOKO_SUPABASE_PUBLIC_KEY: 'sb_publishable_test' }));
});
test('live public snapshot preserves quantity and strips private fields', async () => {
  const result = await fixture([{ ...product, customer_email: 'secret' }])({ query: 'ครัว' });
  assert.equal(result.results[0].pickups[0].remaining_quantity, 7);
  assert.equal(result.results[0].available_to_order, true);
  assert.equal(result.results[0].price, 80);
  assert.ok(!JSON.stringify(result).includes('private'));
  assert.ok(!JSON.stringify(result).includes('secret'));
});
test('sold out, preview maker and inactive products cannot appear orderable', async () => {
  for (const p of [{ ...product, is_sold_out: true }, { ...product, product_origin: 'maker', maker: { is_ordering_enabled: false } }]) {
    assert.equal((await fixture([p])({})).results[0].available_to_order, false);
  }
  assert.deepEqual((await fixture([{ ...product, is_active: false }])({})).results, []);
});
test('expired cutoff, different date/location and no inventory fail closed', async () => {
  assert.equal((await fixture()({ pickup_date: '2030-01-02' })).results[0].available_to_order, false);
  assert.equal((await fixture()({ location_id: id })).results[0].available_to_order, false);
  assert.equal((await fixture([product], [{ ...pickup, order_cutoff_at: '2020-01-01T00:00:00Z' }])({})).results[0].available_to_order, false);
  assert.equal((await fixture([product], [])({})).results[0].available_to_order, false);
  await assert.rejects(fixture([product], [pickup], false)({}));
});
test('upstream failure is never represented as zero stock', async () => {
  const query = createCatalog({ url: 'https://example.com', key: 'sb_publishable_test' }, async () => new Response('', { status: 503 }));
  await assert.rejects(query({}));
});
test('MCP initialize, discover, query, input validation and HTTP boundaries', async () => {
  const listener = createApp(fixture()).listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const url = new URL(`http://127.0.0.1:${listener.address().port}/mcp`);
  const client = new Client({ name: 'test', version: '1.0.0' });
  try {
    await client.connect(new StreamableHTTPClientTransport(url));
    const tools = (await client.listTools()).tools;
    assert.equal(tools.length, 2);
    assert.ok(tools.every(t => t.annotations.readOnlyHint && !t.annotations.destructiveHint));
    const result = await client.callTool({ name: 'search_joko_products', arguments: { query: 'croissant' } });
    assert.equal(result.structuredContent.results[0].pickups[0].remaining_quantity, 7);
    const bad = await client.callTool({ name: 'search_joko_products', arguments: { pickup_date: '2030-02-30' } });
    assert.equal(bad.isError, true);
    assert.equal((await fetch(url, { headers: { Origin: 'https://evil.example' } })).status, 403);
    const hostStatus = await new Promise((resolve, reject) => {
      const request = http.get(url, { headers: { Host: 'evil.example' } }, response => { response.resume(); resolve(response.statusCode); });
      request.on('error', reject);
    });
    assert.equal(hostStatus, 403);
    assert.equal((await fetch(url)).status, 405);
  } finally { await client.close(); listener.close(); }
});
