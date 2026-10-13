// Isolated real Chromium widget tests. All external services and chat responses are intercepted.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const { chromium } = await import(process.env.JOKO_TEST_PLAYWRIGHT_MODULE || 'playwright-core');
const server = await createServer({
  server: { host: '127.0.0.1', port: 5198, strictPort: true },
  plugins: [{ name: 'assistant-test-harness',
    resolveId(id) { if (id === 'virtual:assistant-harness') return id; },
    load(id) { if (id === 'virtual:assistant-harness') return `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {LanguageProvider} from '/src/context/LanguageContext.tsx';
      import AssistantWidget from '/src/app/joko-today/assistant/AssistantWidget.tsx';
      import '/src/index.css';
      createRoot(document.getElementById('root')).render(React.createElement(LanguageProvider,null,React.createElement('main',null,React.createElement('h1',null,'JOKO widget fixture preview'),React.createElement('div',{id:'joko-contact'},'Contact JOKO'),React.createElement(AssistantWidget,{onNavigate:page=>window.__navigation=page}))));
    `; },
    configureServer(vite) {
    vite.middlewares.use(async (req, res, next) => {
      if (req.url !== '/__assistant_test') return next();
      const html = await vite.transformIndexHtml('/__assistant_test', `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@id/virtual:assistant-harness"></script></body></html>`);
      res.setHeader('Content-Type', 'text/html'); res.end(html);
    });
  } }],
});
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.JOKO_TEST_CHROMIUM, args: ['--no-sandbox', '--disable-dev-shm-usage'], headless: true });
const base = 'http://127.0.0.1:5198';
const id = '00000000-0000-4000-8000-000000000001';
let mode = 'success';
let messages = 0;
let sessions = 0;
const external = [];
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== base) { external.push(url.origin); return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); }
    if (!url.pathname.startsWith('/api/assistant/')) return route.continue();
    if (route.request().method() === 'DELETE') return route.fulfill({ json: { cleared: true } });
    if (url.pathname.endsWith('/session')) return route.fulfill({ status: 201, json: { sessionId: `fixture-session-${++sessions}` } });
    messages++;
    const body = route.request().postDataJSON();
    assert.ok(body.clientRequestId);
    assert.match(body.sessionId, /^fixture-session-\d+$/);
    if (mode === 'failure') return route.fulfill({ status: 503, json: { error: 'availability_unavailable' } });
    if (mode === 'budget') return route.fulfill({ status: 503, json: { error: 'budget_exhausted' } });
    return route.fulfill({ json: { answer: body.language === 'th' ? 'ตัวอย่างการทดสอบ: ครัวซองต์' : 'Fixture preview: <img src=x onerror=alert(1)>', checked_at: new Date().toISOString(), products: [
      { id, name: { en: 'Fixture Croissant', th: 'ครัวซองต์ตัวอย่าง' }, price: 40, product_url: 'https://joko.today/products/croissant', available_to_order: true, pickups: [{ pickup_date: '2030-10-19', remaining_quantity: 8, locations: [{ id, name: { en: 'Mae Rim', th: 'แม่ริม' } }] }] },
      { id: 'unsafe', name: { en: 'Unsafe', th: '' }, price: 0, product_url: 'javascript:alert(1)', pickups: [] },
    ] } });
  });
  await page.goto(`${base}/__assistant_test`);
  await page.getByRole('button', { name: 'Ask JOKO', exact: true }).click();
  const input = page.getByRole('textbox');
  await input.fill('Croissants this Saturday?');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByText('Fixture Croissant', { exact: true }).waitFor();
  assert.equal(await page.locator('.joko-assistant-log img').count(), 0);
  assert.equal(await page.getByText('Unsafe', { exact: true }).count(), 0);
  assert.equal(await page.getByRole('link', { name: 'View product' }).getAttribute('href'), '/products/croissant');
  assert.match(await page.locator('.joko-assistant-product').innerText(), /2030-10-19.*8 remaining.*Mae Rim/);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.activeElement?.textContent === 'Ask JOKO');
  assert.equal(await page.getByRole('dialog').count(), 0);
  await page.getByRole('button', { name: 'Ask JOKO', exact: true }).click();
  await page.getByRole('combobox').selectOption('th');
  assert.equal(await page.getByText('Fixture Croissant', { exact: true }).count(), 0);
  assert.equal(await page.getByText('Croissants this Saturday?', { exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'มีครัวซองต์อะไรให้สั่งจองบ้าง?', exact: true }).count(), 1);
  assert.equal(sessions, 1, 'Language switching does not make an AI or session request');
  await page.getByRole('combobox').selectOption('en');
  assert.equal(await page.getByText('Fixture Croissant', { exact: true }).count(), 1);
  await page.getByRole('button', { name: 'Clear chat' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.joko-assistant-product').length === 0);
  assert.equal(await page.locator('.joko-assistant-product').count(), 0);
  await page.getByRole('combobox').selectOption('th');
  await input.fill('มีครัวซองต์ไหม');
  await page.getByRole('button', { name: 'ส่ง', exact: true }).click();
  await page.getByText('ครัวซองต์ตัวอย่าง', { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 700 });
  const panel = await page.getByRole('dialog').boundingBox();
  assert.ok(panel.x >= 0 && panel.x + panel.width <= 390 && panel.y >= 0 && panel.y + panel.height <= 700);
  await page.screenshot({ path: '/tmp/joko-assistant-mobile-preview.png' });
  await page.getByRole('combobox').selectOption('en');
  assert.equal(await page.getByText('ครัวซองต์ตัวอย่าง', { exact: true }).count(), 0);
  await page.getByRole('combobox').selectOption('th');
  assert.equal(await page.getByText('ครัวซองต์ตัวอย่าง', { exact: true }).count(), 1);
  await page.getByRole('combobox').selectOption('en');
  mode = 'failure';
  await input.fill('Check again'); await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByText('I couldn’t check availability. Please browse products or contact JOKO.', { exact: true }).waitFor();
  mode = 'budget';
  await input.fill('One more'); await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByText('The assistant is taking a break. You can still browse and order normally.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Browse products', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__navigation), 'products');
  assert.equal(await page.evaluate(() => Object.keys(localStorage).some(key => /assistant|chat|session/i.test(key))), false);
  assert.equal(errors.length, 0, errors.join('\n'));
  assert.equal(messages, 4);
  assert.equal(sessions, 3, 'English and Thai use separate backend sessions; clearing starts a new one');
  console.log(JSON.stringify({ status: 'PASS', checks: ['EN/TH', 'verified cards', 'unsafe links', 'inert AI text', 'clear', 'Escape/focus', 'mobile bounds', 'failure/budget fallback', 'catalogue navigation', 'no local transcript'], externalRequestsIntercepted: external.length }));
} finally { await browser.close(); await server.close(); }
