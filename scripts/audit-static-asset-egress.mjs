import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const roots = ['src', 'public'];
const standaloneFiles = ['index.html', 'supabase/seed.sql'];
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.html', '.css', '.sql']);

const forbiddenHardCodedStorage = /supabase\.co\/storage\/v1\/object\/public\/assets\//i;
const forbiddenStaticHelpers = /getPublicImageUrl\(\s*['\"](?:hero|logos)\//;

const canonicalAssetLimits = [
  { file: 'public/assets/home-experience/joko-bakery-full-v2.webp', maxBytes: 500 * 1024 },
  { file: 'public/assets/brand/joko-today-logo-v0.4.webp', maxBytes: 100 * 1024 },
];

const files = [];

function collect(current) {
  if (!fs.existsSync(current)) return;
  const stat = fs.statSync(current);
  if (stat.isFile()) {
    if (sourceExtensions.has(path.extname(current)) || path.basename(current) === 'index.html') files.push(current);
    return;
  }

  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    collect(path.join(current, entry.name));
  }
}

for (const item of roots) collect(path.join(root, item));
for (const item of standaloneFiles) collect(path.join(root, item));

const violations = [];

for (const asset of canonicalAssetLimits) {
  const absolute = path.join(root, asset.file);
  if (!fs.existsSync(absolute)) {
    violations.push(asset.file + ': canonical static asset is missing');
    continue;
  }

  const size = fs.statSync(absolute).size;
  if (size > asset.maxBytes) {
    violations.push(
      asset.file + ': ' + size + ' bytes exceeds ' + asset.maxBytes + '-byte static asset limit',
    );
  }
}

for (const file of files) {
  const relative = path.relative(root, file);
  const content = fs.readFileSync(file, 'utf8');

  if (forbiddenHardCodedStorage.test(content)) {
    violations.push(relative + ': hard-coded public Supabase Storage URL for site assets');
  }

  if (relative.startsWith('src' + path.sep) && forbiddenStaticHelpers.test(content)) {
    violations.push(relative + ': permanent hero/logo requested through getPublicImageUrl()');
  }
}

if (violations.length) {
  console.error('Static asset egress audit failed:');
  for (const violation of violations) console.error('- ' + violation);
  console.error('\nPermanent site UI assets must ship from /public and be served by joko.today.');
  process.exit(1);
}

console.log('Static asset egress audit passed.');
