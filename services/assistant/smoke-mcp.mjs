import { createInventory } from './inventory.mjs';
const query = createInventory(process.env.JOKO_ASSISTANT_MCP_URL || 'https://joko.today/mcp');
const result = await query('search_joko_products', { query: '', limit: 3 });
console.log(JSON.stringify({ scope: result.scope, products: result.results.length, checked_at: result.checked_at }));
