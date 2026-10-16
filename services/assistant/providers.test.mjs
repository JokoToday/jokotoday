import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { providerConfig, createProvider, chatRequest, normalizeChat } from './providers.mjs';
import { createEngine } from './engine.mjs';
import { Budget } from './budget.mjs';

const config = (provider, extra = {}) => providerConfig({ JOKO_ASSISTANT_PROVIDER: provider, JOKO_ASSISTANT_MODEL: provider === 'openrouter' ? 'openai/gpt-5.4-mini' : 'glm-5.3', JOKO_ASSISTANT_ALLOWED_MODELS: provider === 'openrouter' ? 'openai/gpt-5.4-mini' : 'glm-5.3', JOKO_ASSISTANT_INPUT_USD_PER_MILLION: '2', JOKO_ASSISTANT_OUTPUT_USD_PER_MILLION: '10', OPENROUTER_API_KEY: 'router-test-only', OLLAMA_API_KEY: 'ollama-test-only', JOKO_ASSISTANT_OPENROUTER_PROVIDERS: 'openai', ...extra });
const request = { model: 'ignored', instructions: 'JOKO rules', input: [{ role: 'user', content: 'Croissants?' }], tool_choice: 'required', max_output_tokens: 1200, tools: [{ type: 'function', name: 'search_joko_products', description: 'Live products', parameters: { type: 'object', properties: {} } }] };
function raw(profile, call = false) {
  return { model: profile.model, choices: [{ finish_reason: call ? 'tool_calls' : 'stop', message: { role: 'assistant', content: call ? null : 'Choose a pickup date.', ...(call ? { tool_calls: [{ id: 'call-one', type: 'function', function: { name: 'search_joko_products', arguments: JSON.stringify({ query: '', limit: 1 }) } }], reasoning_details: [{ type: 'reasoning.text', text: 'Fixture only' }] } : {}) } }], usage: { prompt_tokens: 200, completion_tokens: 50, cost: 0.002 } };
}
test('OpenAI default is retained; explicit models need keys, allowlists and pricing', () => {
  const base = providerConfig({ OPENAI_API_KEY: 'test-only' });
  assert.equal(base.provider, 'openai'); assert.equal(base.model, 'gpt-5.4-mini'); assert.equal(base.reserveMicros, 100000);
  assert.throws(() => providerConfig({ OPENAI_API_KEY: 'test-only', JOKO_ASSISTANT_MODEL: 'other-model' }), /allowlist/);
  assert.throws(() => config('openrouter', { JOKO_ASSISTANT_INPUT_USD_PER_MILLION: undefined }), /price/);
  assert.throws(() => config('ollama-cloud', { OLLAMA_API_KEY: '' }), /OLLAMA_API_KEY/);
  assert.throws(() => config('ollama-cloud', { JOKO_ASSISTANT_ALLOWED_MODELS: 'different' }), /allowlist/);
  assert.throws(() => config('openrouter', { JOKO_ASSISTANT_OPENROUTER_PROVIDERS: '' }), /provider allowlist/);
  assert.throws(() => config('openrouter', { JOKO_ASSISTANT_MODEL: 'openrouter/auto', JOKO_ASSISTANT_ALLOWED_MODELS: 'openrouter/auto' }), /explicit/);
  assert.throws(() => config('ollama-cloud', { JOKO_ASSISTANT_MODEL: 'glm-5.3:cloud' }), /API model/);
  assert.throws(() => config('ollama-cloud', { JOKO_ASSISTANT_MAX_CONCURRENT: '10' }), /concurrency/);
});
test('more expensive model increases reservation; Ollama limits concurrency', () => {
  const profile = config('ollama-cloud');
  assert.equal(profile.reserveMicros, 187200);
  assert.equal(profile.maxConcurrent, 1);
});
test('OpenRouter request pins model/provider/cost and requires supported tools', () => {
  const profile = config('openrouter'); const body = chatRequest(request, profile);
  assert.equal(body.model, profile.model);
  assert.deepEqual(body.provider.only, ['openai']); assert.equal(body.provider.allow_fallbacks, false);
  assert.equal(body.provider.require_parameters, true); assert.equal(body.provider.data_collection, 'deny');
  assert.deepEqual(body.provider.max_price, { prompt: 2, completion: 10, request: 0 });
  assert.equal(body.tool_choice.function.name, 'search_joko_products'); assert.equal(body.max_tokens, 1200);
  assert.equal(body.tools[0].function.name, 'search_joko_products');
});
test('Ollama translation avoids unsupported fields and preserves tool replay', () => {
  const profile = config('ollama-cloud'); const first = normalizeChat(raw(profile, true), profile);
  const body = chatRequest({ ...request, tool_choice: 'auto', input: [...request.input, ...first.output, { type: 'function_call_output', call_id: 'call-one', output: '{"results":[]}' }] }, profile);
  assert.equal(body.provider, undefined); assert.equal(body.parallel_tool_calls, undefined); assert.equal(body.store, undefined); assert.equal(body.reasoning, undefined);
  assert.equal(body.messages[2].tool_calls[0].id, 'call-one');
  assert.equal(body.messages[2].reasoning_details, undefined);
  assert.equal(body.messages[3].role, 'tool'); assert.equal(body.messages[3].tool_call_id, 'call-one');
});
test('OpenRouter reported cost is used; Ollama usage uses configured peak ceilings', () => {
  const router = config('openrouter'); const ollama = config('ollama-cloud');
  assert.equal(normalizeChat(raw(router), router).usage.cost_micros, 2000);
  assert.equal(normalizeChat(raw(ollama), ollama).usage.cost_micros, undefined);
  assert.throws(() => normalizeChat({ ...raw(router), model: 'unexpected' }, router), /routed model/);
  const incomplete = raw(router); incomplete.choices[0].finish_reason = 'length';
  assert.equal(normalizeChat(incomplete, router).status, 'incomplete');
  assert.equal(normalizeChat(incomplete, router).usage.cost_micros, 2000);
});
test('OpenRouter reasoning details survive normalized tool replay', () => {
  const profile = config('openrouter');
  const normalized = normalizeChat(raw(profile, true), profile);
  const body = chatRequest({ ...request, input: [...request.input, ...normalized.output, { type: 'function_call_output', call_id: 'call-one', output: '{}' }] }, profile);
  assert.equal(body.messages[2].reasoning_details[0].text, 'Fixture only');
});
for (const provider of ['openrouter', 'ollama-cloud']) {
  test(`${provider} runs engine tool loop through fixed endpoint without retries`, async t => {
    const profile = config(provider);
    const path = mkdtempSync(join(tmpdir(), 'joko-provider-'));
    const budget = new Budget(path, 1000000);
    t.after(() => { budget.close(); rmSync(path, { recursive: true, force: true }); });
    let calls = 0;
    const adapter = createProvider(profile, async (url, options) => {
      assert.equal(url, provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://ollama.com/v1/chat/completions');
      assert.equal(options.headers.Authorization, `Bearer ${profile.apiKey}`); assert.equal(options.redirect, 'error');
      const body = JSON.parse(options.body);
      assert.equal(body.model, profile.model);
      if (calls) assert.equal(body.messages.at(-1).role, 'tool');
      return { ok: true, json: async () => raw(profile, calls++ === 0) };
    });
    const engine = createEngine({ profile, provider: adapter, budget, inventory: async () => ({ checked_at: new Date().toISOString(), scope: 'regular_preorders', timezone: 'Asia/Bangkok', results: [] }) });
    const answer = await engine({ message: 'Croissants?', language: 'th' });
    assert.equal(answer.answer, 'Choose a pickup date.'); assert.equal(calls, 2);
    assert.equal(budget.state.charged, provider === 'openrouter' ? 4000 : 1800);
  });
}
test('excessive reported cost quarantines provider and records the overrun durably', async t => {
  const profile = config('openrouter');
  const path = mkdtempSync(join(tmpdir(), 'joko-provider-'));
  const budget = new Budget(path, 1000000);
  t.after(() => { budget.close(); rmSync(path, { recursive: true, force: true }); });
  let calls = 0;
  const engine = createEngine({ profile, budget, inventory: async () => {}, provider: async () => { calls++; return { status: 'completed', output: [], usage: { input_tokens: 100, output_tokens: 10, cost_micros: profile.reserveMicros + 1 } }; } });
  await assert.rejects(engine({ message: 'Hello' }), /exceeds reserve/);
  await assert.rejects(engine({ message: 'Again' }), /needs review/);
  assert.equal(calls, 1); assert.equal(budget.state.charged, profile.reserveMicros + 1);
});
test('unavailable cloud provider is called once and cannot receive customer URLs', async () => {
  const profile = config('ollama-cloud'); let calls = 0;
  const adapter = createProvider(profile, async url => { calls++; assert.equal(url, 'https://ollama.com/v1/chat/completions'); return { ok: false }; });
  await assert.rejects(adapter({ ...request, base_url: 'https://evil.test' })); assert.equal(calls, 1);
});
test('missing usage quarantines the model with its full reservation retained', async t => {
  const profile = config('ollama-cloud');
  const path = mkdtempSync(join(tmpdir(), 'joko-provider-'));
  const budget = new Budget(path, 1000000);
  t.after(() => { budget.close(); rmSync(path, { recursive: true, force: true }); });
  let calls = 0;
  const engine = createEngine({ profile, budget, inventory: async () => {}, provider: async () => { calls++; return { status: 'completed', output: [] }; } });
  await assert.rejects(engine({ message: 'Hello' }), /Invalid usage/);
  await assert.rejects(engine({ message: 'Again' }), /needs review/);
  assert.equal(calls, 1); assert.equal(budget.state.charged, profile.reserveMicros);
});
