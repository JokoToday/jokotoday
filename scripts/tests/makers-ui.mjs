// Component rendering + legacy navigation compatibility; no network requests.
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
let language = 'en';
globalThis.localStorage = { getItem: () => language, setItem: () => {}, removeItem: () => {} };
const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: 'custom' });
try {
  const { LanguageProvider } = await server.ssrLoadModule('/src/context/LanguageContext.tsx');
  const { MakerAttribution, SourcingDisclosure } = await server.ssrLoadModule('/src/components/MakerAttribution.tsx');
  const { MakerSnapshotAttribution } = await server.ssrLoadModule('/src/components/MakerSnapshotAttribution.tsx');
  const { MakerCard } = await server.ssrLoadModule('/src/components/MakerCard.tsx');
  const { MakersManagement } = await server.ssrLoadModule('/src/components/MakersManagement.tsx');
  const { getCommonPickupDates } = await server.ssrLoadModule('/src/lib/pickupAvailabilityV2.ts');
  const { resolveTopMenu } = await server.ssrLoadModule('/src/platform/builder/topMenu.ts');
  const render = (Component, props) => renderToStaticMarkup(React.createElement(LanguageProvider, null, React.createElement(Component, props)));
  const maker = { id: 'maker-id', slug: 'selected-shop', name_en: '<Selected & Shop>', name_th: 'ร้านที่เลือก', name_zh: '', intro_en: 'Carefully selected', location: 'Bangkok' };
  for (language of ['en','th','zh']) {
    const attribution = render(MakerAttribution, { maker });
    assert.match(attribution, /href="\/makers\/selected-shop"/);
    assert.ok(attribution.includes(language === 'th' ? 'ร้านที่เลือก' : '&lt;Selected &amp; Shop&gt;'));
    const disclosure = render(SourcingDisclosure);
    assert.ok(disclosure.length > 100);
    const historic = render(MakerSnapshotAttribution, { item: { maker_name_en: 'Original maker', maker_name_th: 'ผู้ผลิตเดิม', maker_name_zh: '' } });
    assert.ok(historic.includes(language === 'th' ? 'ผู้ผลิตเดิม' : 'Original maker'));
    assert.equal(render(MakerSnapshotAttribution, { item: {} }), '');
    assert.match(render(MakerCard, { maker }), /selected-shop/);
  }
  language = 'en';
  const editor = render(MakersManagement);
  assert.match(editor, /Publish maker profile/);
  assert.match(editor, /Enable customer orders/);
  assert.doesNotMatch(editor, /checked=""/);
  const legacy = ['home','products','other-products','how-it-works','pickup','about'].map(key => ({ key, visible: key !== 'about', labels: {en:`Custom ${key}`} }));
  const resolved = resolveTopMenu(legacy);
  assert.equal(resolved.length, 7);
  assert.equal(resolved.filter(item => item.key === 'makers').length, 1);
  assert.equal(resolved.find(item => item.key === 'about').visible, false);
  assert.equal(resolved[0].labels.en, 'Custom home');
  assert.equal(resolveTopMenu(resolved).length, 7);
  const availability = ['baked','beyond','maker'].flatMap(product_id => [
    { product_id, pickup_date_id: 'shared', pickup_date: '2026-10-18', remaining_quantity: 3, locations: [{id:'pickup'}] },
    ...(product_id === 'maker' ? [] : [{ product_id, pickup_date_id: 'baked-only', pickup_date: '2026-10-11', remaining_quantity: 3, locations: [{id:'pickup'}] }]),
  ]);
  const requirements = ['baked','beyond','maker'].map(productId => ({productId,quantity:2}));
  assert.deepEqual(getCommonPickupDates(availability,requirements).map(date => date.pickupDateId), ['shared']);
  assert.equal(getCommonPickupDates(availability,[...requirements,{productId:'maker',quantity:2}]).length,0);
  console.log('PASS: EN/TH/ZH attribution, safe text escaping, links, historical fallback, Admin defaults and six-item navigation compatibility and three-world basket pickup intersection.');
} finally { await server.close(); }
