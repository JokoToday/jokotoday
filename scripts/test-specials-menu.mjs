import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile('src/platform/builder/topMenu.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { resolveTopMenu, getTopMenuLabel } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'),
);
const defaults = resolveTopMenu(undefined);
assert.deepEqual(defaults.map(item => item.key), ['home', 'products', 'other-products', 'specials', 'how-it-works', 'pickup', 'about']);

// Existing published menus must gain Specials without losing labels, order or visibility.
const legacy = defaults.filter(item => item.key !== 'specials').map(item => ({
  ...item,
  visible: item.key !== 'pickup',
  labels: { ...item.labels, en: item.key === 'other-products' ? 'Our Finds' : item.labels.en },
}));
const upgraded = resolveTopMenu(legacy);
assert.deepEqual(upgraded.filter(item => item.key !== 'specials'), legacy);
assert.equal(upgraded.findIndex(item => item.key === 'specials'), upgraded.findIndex(item => item.key === 'other-products') + 1);

// Explicit Admin placement, hiding and localization must survive subsequent normalization.
const custom = [{ ...defaults.find(item => item.key === 'specials'), visible: false, labels: { en: 'Today Only', th: 'วันนี้เท่านั้น', zh: '仅限今日' } }, ...legacy];
assert.deepEqual(resolveTopMenu(custom), custom);
assert.equal(getTopMenuLabel(custom[0], 'en'), 'Today Only');
assert.equal(getTopMenuLabel(custom[0], 'th'), 'วันนี้เท่านั้น');
assert.equal(getTopMenuLabel(custom[0], 'zh'), '仅限今日');
assert.equal(resolveTopMenu([...custom, custom[0], { key: 'untrusted-route' }]).length, 7);
const moduleUrls = {};
for (const name of ['contracts', 'registry', 'validation']) {
  let output = ts.transpileModule(await readFile(`src/platform/builder/${name}.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  for (const [dependency, url] of Object.entries(moduleUrls)) {
    output = output.replaceAll(`'./${dependency}'`, `'${url}'`);
  }
  moduleUrls[name] = 'data:text/javascript;base64,' + Buffer.from(output).toString('base64');
}
const { validateBuilderDocument } = await import(moduleUrls.validation);
const menuIssues = topMenu => {
  const result = validateBuilderDocument({ schemaVersion: 1, registryVersion: 1, pageKey: 'home', branding: { topMenu }, sections: [] });
  return result.ok ? [] : result.issues.filter(issue => issue.path.startsWith('branding.topMenu'));
};
assert.deepEqual(menuIssues(legacy), []);
assert.deepEqual(menuIssues(custom), []);
assert.ok(menuIssues(custom.filter(item => item.key !== 'home')).length > 0);
console.log('11 Specials menu compatibility assertions passed.');
