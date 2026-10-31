// Provider adapters normalize API messages, tool calls and usage into the engine contract.
// Fixed destinations prevent customer-controlled URLs from receiving server credentials.
export const DEFAULT_PROFILE = Object.freeze({ provider: 'openai', model: 'gpt-5.4-mini', inputRate: 0.75, outputRate: 4.5, reserveMicros: 100000, maxConcurrent: 4 });
const destinations = { openai: 'https://api.openai.com/v1/responses', openrouter: 'https://openrouter.ai/api/v1/chat/completions', 'ollama-cloud': 'https://ollama.com/v1/chat/completions' };
const keys = { openai: 'OPENAI_API_KEY', openrouter: 'OPENROUTER_API_KEY', 'ollama-cloud': 'OLLAMA_API_KEY' };
function rate(value, ceiling) {
  const number = Number(value);
  if (value === undefined || value === '' || !Number.isFinite(number) || number <= 0 || number > ceiling) throw Error('Explicit positive model price ceilings required');
  return number;
}
export function providerConfig(env = process.env) {
  const provider = env.JOKO_ASSISTANT_PROVIDER || 'openai';
  if (!Object.hasOwn(destinations, provider)) throw Error('Unsupported provider');
  const model = env.JOKO_ASSISTANT_MODEL || (provider === 'openai' ? DEFAULT_PROFILE.model : '');
  if (!/^[A-Za-z0-9][A-Za-z0-9_./:-]{0,127}$/.test(model) || model.startsWith('openrouter/') || model.endsWith(':cloud')) throw Error('Choose an explicit API model ID');
  const allowlist = (env.JOKO_ASSISTANT_ALLOWED_MODELS || (provider === 'openai' ? DEFAULT_PROFILE.model : '')).split(',').map(v => v.trim());
  if (!allowlist.includes(model)) throw Error('Model is not approved in server allowlist');
  const knownDefault = provider === 'openai' && model === DEFAULT_PROFILE.model;
  const inputRate = rate(env.JOKO_ASSISTANT_INPUT_USD_PER_MILLION ?? (knownDefault ? '0.75' : undefined), 100);
  const outputRate = rate(env.JOKO_ASSISTANT_OUTPUT_USD_PER_MILLION ?? (knownDefault ? '4.5' : undefined), 500);
  const maxConcurrent = Number(env.JOKO_ASSISTANT_MAX_CONCURRENT || (provider === 'ollama-cloud' ? '1' : '4'));
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 4) throw Error('Invalid concurrency');
  const apiKey = env[keys[provider]];
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw Error(`Server-side ${keys[provider]} required`);
  const providers = (env.JOKO_ASSISTANT_OPENROUTER_PROVIDERS || '').split(',').map(v => v.trim()).filter(Boolean);
  if (provider === 'openrouter' && (!providers.length || providers.length > 5 || providers.some(v => !/^[A-Za-z0-9][A-Za-z0-9_./ -]{0,99}$/.test(v)))) throw Error('Explicit OpenRouter provider allowlist required');
  // $/million tokens equals microdollars/token. 20% headroom; no caching discount.
  const reserveMicros = Math.max(100000, Math.ceil(3 * (20000 * inputRate + 1200 * outputRate) * 1.2));
  return Object.freeze({ provider, model, inputRate, outputRate, reserveMicros, maxConcurrent, apiKey, providers });
}

function chatMessages(body) {
  const messages = [{ role: 'system', content: body.instructions }];
  for (const item of body.input) {
    if (item.role === 'user' || item.role === 'assistant') messages.push({ role: item.role, content: item.content });
    else if (item.type === 'function_call') {
      messages.push({ role: 'assistant', content: null, tool_calls: [{ id: item.call_id, type: 'function', function: { name: item.name, arguments: item.arguments } }], ...(item.replay ?? {}) });
    } else if (item.type === 'function_call_output') messages.push({ role: 'tool', tool_call_id: item.call_id, content: item.output });
    else throw Error('Unsupported replay item');
  }
  return messages;
}
export function chatRequest(body, profile) {
  const toolChoice = body.tool_choice === 'required' ? { type: 'function', function: { name: 'search_joko_products' } } : body.tool_choice;
  const request = { model: profile.model, messages: chatMessages(body), stream: false, tools: body.tools.map(tool => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.parameters } })), tool_choice: toolChoice, max_tokens: body.max_output_tokens };
  if (profile.provider === 'openrouter') {
    // Not every tool-capable endpoint advertises parallel_tool_calls. The engine
    // rejects multiple calls itself; sending this flag with require_parameters
    // can exclude otherwise compatible endpoints (including GPT-5.4 Mini).
    request.provider = { only: profile.providers, allow_fallbacks: false, require_parameters: true, data_collection: 'deny', max_price: { prompt: profile.inputRate, completion: profile.outputRate, request: 0 } };
  }
  return request;
}
export function normalizeChat(raw, profile) {
  if (!Array.isArray(raw?.choices) || raw.choices.length !== 1) throw Error('Invalid provider response');
  if (profile.provider === 'openrouter' && raw.model !== profile.model) throw Error('Unexpected routed model');
  const choice = raw.choices[0];
  const usage = { input_tokens: raw.usage?.prompt_tokens, output_tokens: raw.usage?.completion_tokens };
  if (profile.provider === 'openrouter' && raw.usage?.cost !== undefined) {
    if (typeof raw.usage.cost !== 'number' || !Number.isFinite(raw.usage.cost) || raw.usage.cost < 0) throw Error('Invalid provider cost');
    usage.cost_micros = Math.ceil(raw.usage.cost * 1000000);
  }
  // Even a truncated/refused response can be billable. Return known usage before failing the answer.
  if (!['stop', 'tool_calls'].includes(choice.finish_reason)) return { status: 'incomplete', output: [], usage };
  if (!choice.message || choice.message.role !== 'assistant') throw Error('Invalid provider message');
  const output = [];
  const calls = choice.message.tool_calls ?? [];
  if (!Array.isArray(calls) || calls.length > 1) throw Error('Invalid tool count');
  for (const call of calls) {
    if (call.type !== 'function' || typeof call.id !== 'string' || typeof call.function?.name !== 'string' || typeof call.function?.arguments !== 'string') throw Error('Invalid tool response');
    // Preserve provider reasoning for tool replay without exposing it in UI or logs.
    const replay = {};
    if (profile.provider === 'openrouter' && Array.isArray(choice.message.reasoning_details)) replay.reasoning_details = choice.message.reasoning_details;
    output.push({ type: 'function_call', call_id: call.id, name: call.function.name, arguments: call.function.arguments, replay });
  }
  if (!calls.length) {
    if (typeof choice.message.content !== 'string') throw Error('No final answer');
    output.push({ type: 'message', content: [{ type: 'output_text', text: choice.message.content }] });
  }
  return { status: 'completed', output, usage };
}
export function createProvider(profile, fetcher = fetch) {
  if (!Object.hasOwn(destinations, profile.provider)) throw Error('Unsupported provider');
  return async body => {
    const request = profile.provider === 'openai' ? { ...body, model: profile.model } : chatRequest(body, profile);
    // Recheck translated body because replay and schema conversion add bytes.
    if (Buffer.byteLength(JSON.stringify(request)) > 18000) throw Object.assign(Error('Provider context too large'), { code: 'context_limit' });
    const response = await fetcher(destinations[profile.provider], {
      method: 'POST', redirect: 'error', headers: { Authorization: `Bearer ${profile.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(request), signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw Error('AI provider unavailable');
    const result = await response.json();
    return profile.provider === 'openai' ? result : normalizeChat(result, profile);
  };
}
