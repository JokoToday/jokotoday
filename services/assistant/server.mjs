import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { Budget } from './budget.mjs';
import { createInventory } from './inventory.mjs';
import { createEngine } from './engine.mjs';
import { createProvider, providerConfig } from './providers.mjs';

const fail = (code, status = 503) => Object.assign(Error(code), { code, status });
async function readJSON(req) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw fail('invalid_request', 415);
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 16000) throw fail('invalid_request', 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw fail('invalid_request', 400); }
}
export function createAssistantServer({ engine, enabled = false, origins = ['http://localhost:5173'], hosts = ['localhost', '127.0.0.1'], maxConcurrent = 4, now = Date.now, log = () => {} }) {
  const sessions = new Map();
  const rates = new Map();
  let active = 0;
  function sweep() {
    for (const [token, session] of sessions) if (!session.busy && now() - session.last > 86400000) sessions.delete(token);
    for (const [ip, rate] of rates) if (now() - rate.start >= 60000) rates.delete(ip);
  }
  return createServer(async (req, res) => {
    const requestId = randomUUID();
    const send = (status, result) => { if (!res.destroyed) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(result)); } };
    try {
      const url = new URL(req.url, 'http://localhost');
      const hostname = new URL(`http://${req.headers.host}`).hostname;
      if (!hosts.includes(hostname)) throw fail('forbidden', 403);
      if (url.pathname === '/api/assistant/health' && req.method === 'GET') return send(200, { status: enabled ? 'ready' : 'disabled', scope: 'public-read-only' });
      if (!enabled) throw fail('assistant_disabled');
      if (!origins.includes(req.headers.origin)) throw fail('forbidden', 403);
      if (!['POST', 'DELETE'].includes(req.method)) throw fail('invalid_request', 405);
      sweep();
      // Nginx MUST overwrite X-Real-IP; service binds loopback and is never exposed directly.
      const ip = String(req.headers['x-real-ip'] || req.socket.remoteAddress).slice(0, 100);
      if (!rates.has(ip) && rates.size >= 2000) throw fail('rate_limited', 429);
      const rate = rates.get(ip) ?? { start: now(), count: 0 };
      rates.set(ip, rate);
      if (++rate.count > 20) throw fail('rate_limited', 429);
      if (url.pathname === '/api/assistant/session' && req.method === 'POST') {
        await readJSON(req);
        if (sessions.size >= 200) throw fail('busy', 429);
        const token = randomBytes(32).toString('base64url');
        sessions.set(token, { history: [], last: now(), turns: 0, busy: false, replies: new Map() });
        return send(201, { sessionId: token });
      }
      const body = await readJSON(req);
      const session = sessions.get(body?.sessionId);
      if (!session) throw fail('session_expired', 401);
      if (session.busy) throw fail('busy', 409);
      if (url.pathname === '/api/assistant/session' && req.method === 'DELETE') { sessions.delete(body.sessionId); return send(200, { cleared: true }); }
      if (url.pathname !== '/api/assistant/messages' || req.method !== 'POST') throw fail('not_found', 404);
      if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 1000 || !['en', 'th', 'zh'].includes(body.language) || typeof body.clientRequestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.clientRequestId)) throw fail('invalid_request', 400);
      const previous = session.replies.get(body.clientRequestId);
      if (previous) {
        if (previous.message !== body.message || previous.language !== body.language) throw fail('invalid_request', 400);
        return send(previous.status, previous.result);
      }
      if (session.turns >= 12) throw fail('session_limit', 429);
      if (active >= maxConcurrent) throw fail('busy', 429);
      session.last = now(); session.busy = true; session.turns++; active++;
      try {
        const result = await engine({ message: body.message, language: body.language, history: session.history, requestId });
        session.history.push({ role: 'user', content: body.message }, { role: 'assistant', content: result.answer });
        session.history = session.history.slice(-6);
        session.replies.set(body.clientRequestId, { message: body.message, language: body.language, status: 200, result });
        return send(200, result);
      } catch (error) {
        const code = ['budget_exhausted', 'context_limit'].includes(error.code) ? error.code : 'availability_unavailable';
        const result = { error: code, requestId };
        // Failed outcomes are also idempotent; retrying the same message never incurs another charge.
        session.replies.set(body.clientRequestId, { message: body.message, language: body.language, status: 503, result });
        log({ requestId, event: 'request_failed', code });
        return send(503, result);
      } finally { session.busy = false; session.last = now(); active--; }
    } catch (error) { send(error.status ?? 503, { error: error.code ?? 'unavailable', requestId }); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const enabled = process.env.JOKO_ASSISTANT_ENABLED === 'true';
  const origins = (process.env.JOKO_ASSISTANT_ORIGINS || 'https://joko.today').split(',');
  const hosts = (process.env.JOKO_ASSISTANT_HOSTS || 'joko.today,localhost,127.0.0.1').split(',');
  let budget;
  let engine;
  let profile;
  const log = item => console.log(JSON.stringify(item));
  if (enabled) {
    profile = providerConfig();
    const allowance = Number(process.env.JOKO_ASSISTANT_MONTHLY_USD || '10');
    if (!Number.isFinite(allowance) || allowance < 0 || allowance > 100) throw Error('Invalid allowance');
    budget = new Budget(process.env.JOKO_ASSISTANT_STATE_DIR || './state', Math.round(allowance * 1000000));
    engine = createEngine({ provider: createProvider(profile), profile, inventory: createInventory(process.env.JOKO_ASSISTANT_MCP_URL || 'http://127.0.0.1:3100/mcp'), budget, log });
  }
  const server = createAssistantServer({ engine, enabled, origins, hosts, maxConcurrent: profile?.maxConcurrent ?? 4, log });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.listen(Number(process.env.PORT || '3101'), '127.0.0.1', () => log({ event: 'assistant_started', enabled }));
  let shuttingDown = false;
  const stop = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close(() => { budget?.close(); process.exit(0); });
  };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}
