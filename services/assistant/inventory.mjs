import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export const toolNames = ['search_joko_products', 'get_joko_product_availability'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
export function validateArguments(name, args) {
  if (!toolNames.includes(name) || !args || typeof args !== 'object' || Array.isArray(args)) throw Error('Invalid tool');
  const fields = name === toolNames[0] ? ['query', 'pickup_date', 'location_id', 'limit'] : ['product_id', 'pickup_date', 'location_id'];
  if (Object.keys(args).some(key => !fields.includes(key))) throw Error('Unexpected argument');
  const result = {};
  for (const [key, value] of Object.entries(args)) {
    if (value === null) continue;
    if (key === 'query' && (typeof value !== 'string' || value.length > 100)) throw Error('Invalid query');
    if (['product_id', 'location_id'].includes(key) && (typeof value !== 'string' || !uuid.test(value))) throw Error('Invalid identifier');
    if (key === 'pickup_date' && (typeof value !== 'string' || !date(value))) throw Error('Invalid date');
    if (key === 'limit' && (!Number.isInteger(value) || value < 1 || value > 10)) throw Error('Invalid limit');
    // Public catalogue search is substring-based; these spellings denote the
    // same generic product family but published Thai names use mixed spellings.
    result[key] = key === 'query' && /^(?:ครัวซอง(?:ต์|ท์)?|可颂|可頌|牛角包)$/.test(value.trim()) ? 'croissant' : value;
  }
  if (name === toolNames[1] && !result.product_id) throw Error('Product required');
  if (name === toolNames[0]) result.limit ??= 6;
  return result;
}
const stringField = (value, max) => typeof value === 'string' && value.length <= max ? value : '';
const names = object => Object.fromEntries(['en', 'th', 'zh'].map(key => [key, stringField(object?.[key], 150)]));
export function projectSnapshot(raw, now = Date.now()) {
  if (raw?.scope !== 'regular_preorders' || raw.timezone !== 'Asia/Bangkok' || !Array.isArray(raw.results) || raw.results.length > 10 || !Number.isFinite(Date.parse(raw.checked_at)) || Math.abs(now - Date.parse(raw.checked_at)) > 60000) throw Error('Invalid or stale inventory');
  const results = raw.results.map(product => {
    if (!uuid.test(product.id) || !Number.isFinite(product.price) || product.price < 0 || product.currency !== 'THB') throw Error('Invalid product');
    const url = new URL(product.product_url);
    if (url.origin !== 'https://joko.today' || url.username || url.password || !/^\/products\/[^/]+$/.test(url.pathname) || url.search || url.hash) throw Error('Invalid product link');
    if (!Array.isArray(product.pickups)) throw Error('Invalid pickups');
    const pickups = product.pickups.slice(0, 20).filter(p => Date.parse(p.order_cutoff_at) > now).map(p => {
      if (!date(p.pickup_date) || !Number.isSafeInteger(p.remaining_quantity) || p.remaining_quantity < 0 || !Array.isArray(p.locations)) throw Error('Invalid pickup');
      const locations = p.locations.slice(0, 10).map(l => {
        if (!uuid.test(l.id)) throw Error('Invalid location');
        return { id: l.id, name: names(l.name ?? { en: l.name_en, th: l.name_th, zh: l.name_zh }) };
      });
      const order_cutoff_local = new Date(p.order_cutoff_at).toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
      return { pickup_date: p.pickup_date, remaining_quantity: p.remaining_quantity, order_cutoff_at: p.order_cutoff_at, order_cutoff_local, locations };
    });
    return { id: product.id, name: names(product.name), price: product.price, currency: 'THB', product_url: url.href, pickups, available_to_order: pickups.some(p => p.remaining_quantity > 0 && p.locations.length > 0) };
  });
  return { checked_at: raw.checked_at, timezone: 'Asia/Bangkok', scope: 'regular_preorders', truncated: Boolean(raw.truncated) || raw.results.some(p => p.pickups.length > 20 || p.pickups.some(s => s.locations.length > 10)), results };
}
export function createInventory(endpoint) {
  const url = new URL(endpoint);
  if (!((url.protocol === 'https:' && url.hostname === 'joko.today') || (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) || url.pathname !== '/mcp' || url.username || url.password || url.search || url.hash) throw Error('Invalid fixed MCP endpoint');
  return async (name, args) => {
    const input = validateArguments(name, args);
    const client = new Client({ name: 'joko-website-assistant', version: '0.1.0' });
    const transport = new StreamableHTTPClientTransport(url, { requestInit: { signal: AbortSignal.timeout(12000), redirect: 'error' } });
    try {
      await client.connect(transport);
      const result = await client.callTool({ name, arguments: input }, undefined, { timeout: 12000 });
      if (result.isError || !result.structuredContent) throw Error('Inventory unavailable');
      return projectSnapshot(result.structuredContent);
    } finally { await client.close(); }
  };
}
const nullable = schema => ({ anyOf: [schema, { type: 'null' }] });
export const functionTools = toolNames.map(name => {
  const properties = { pickup_date: nullable({ type: 'string', description: 'Concrete YYYY-MM-DD date in Asia/Bangkok, or null to list dates' }), location_id: nullable({ type: 'string', description: 'Location UUID from inventory, never guess' }) };
  if (name === toolNames[0]) { properties.query = { type: 'string', description: 'Product keyword in EN/TH/ZH; empty to discover products and locations' }; properties.limit = { type: 'integer', minimum: 1, maximum: 10 }; }
  else properties.product_id = { type: 'string', description: 'Product UUID returned by search' };
  return { type: 'function', name, strict: true, description: name === toolNames[0] ? 'Search live public JOKO regular preorders. Stock is shared across locations per date; never add it twice.' : 'Recheck live public product availability; no reservation or payment.', parameters: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false } };
});
