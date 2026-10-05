import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Lightweight post-build guard for the high-risk v3 -> v4 semantic CSS migration.
// This cannot replace browser screenshots or authenticated workspace QA.
const cssDir = path.resolve('dist/assets');
const output = readdirSync(cssDir).filter((file) => /^index-.*\.css$/.test(file));
assert.equal(output.length, 1, 'Expected one built main stylesheet. Run npm run build first.');
const css = readFileSync(path.join(cssDir, output[0]), 'utf8');

const required = new Map([
  ['JOKO primary button palette', '.bg-primary-600'],
  ['JOKO text palette', '.text-primary-900'],
  ['original primary color source', 'var(--joko-color-brand-600)'],
  ['local notebook background', 'var(--joko-surface-canvas)'],
  ['accent theme', 'var(--joko-accent)'],
  ['original gray-200 border tone', '--color-gray-200:#e5e7eb'],
  ['original small radius', '--radius-sm:.125rem'],
  ['original v3 shadows', '.shadow-sm'],
  ['homepage drawing treatment', '.joko-mineral-field'],
  ['legacy gradients', '.bg-gradient-to-br'],
  ['equivalent modal scrim', '.bg-black\\/50'],
  ['equivalent transparent icon background', '.bg-white\\/20'],
]);
for (const [label, fragment] of required) {
  assert(css.includes(fragment), `Tailwind migration missing ${label}: ${fragment}`);
}
const forbidden = new Map([
  ['unintended hero button fill', '.bg-\\[\\#F4EFE5\\]\\/72'],
  ['unintended arbitrary text tint', '.text-\\[\\#303532\\]\\/66'],
  ['removed legacy opacity utility', '.bg-opacity-50'],
]);
for (const [label, fragment] of forbidden) {
  assert(!css.includes(fragment), `Unexpected Tailwind v4-only effect (${label}): ${fragment}`);
}
console.log(`Tailwind v4 CSS compatibility guard passed (${required.size} required, ${forbidden.size} forbidden).`);
