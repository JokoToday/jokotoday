import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const JSON_MODE = process.argv.includes('--json');
const BREAKPOINTS = new Set(['sm', 'md', 'lg', 'xl', '2xl']);
const STATE_VARIANTS = new Set([
  'hover',
  'focus',
  'focus-visible',
  'active',
  'disabled',
  'group-hover',
  'group-focus',
  'peer-checked',
  'peer-focus',
]);

function listTsxFiles(directory) {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return listTsxFiles(fullPath);
      return entry.isFile() && entry.name.endsWith('.tsx') ? [fullPath] : [];
    });
}

function relative(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

const renderFiles = [
  path.join(ROOT, 'src', 'App.tsx'),
  ...listTsxFiles(path.join(ROOT, 'src', 'components')),
  ...listTsxFiles(path.join(ROOT, 'src', 'pages')),
].filter((filePath) => fs.existsSync(filePath)).sort();

const designInputs = [
  ...renderFiles,
  path.join(ROOT, 'src', 'index.css'),
  path.join(ROOT, 'tailwind.config.js'),
].filter((filePath) => fs.existsSync(filePath));

function classifyFile(filePath) {
  const rel = relative(filePath);
  const base = path.basename(filePath, '.tsx');

  if (rel === 'src/App.tsx' || base === 'Header' || base === 'Footer') return 'shared-shell';

  if (
    rel.startsWith('src/pages/Admin') ||
    base.startsWith('Admin') ||
    base.endsWith('Management') ||
    base.endsWith('Form') ||
    base === 'QuickAddProduct'
  ) return 'admin';

  if (
    rel.startsWith('src/components/staff/') ||
    base === 'PickupDeskPage' ||
    base === 'WalkInDeskPage' ||
    base.startsWith('Staff') ||
    base === 'QRScanner'
  ) return 'operations';

  if (
    ['HomePage', 'AboutPage', 'HowItWorksPage', 'TopLikedSection', 'AlsoLikedSection'].includes(base)
  ) return 'public-editorial';

  if (
    base.startsWith('My') ||
    base.startsWith('Auth') ||
    base.startsWith('Profile') ||
    base.startsWith('UserAvatar') ||
    base.startsWith('QRCode') ||
    base.startsWith('QRResolver') ||
    base === 'PostSignupCelebration' ||
    base === 'LineCallback'
  ) return 'account';

  if (
    base.startsWith('Product') ||
    base.startsWith('Products') ||
    base.startsWith('Cart') ||
    base.startsWith('Checkout') ||
    base.startsWith('Pickup') ||
    base.startsWith('FitsYourPickup') ||
    base.startsWith('Cutoff') ||
    base.startsWith('Like') ||
    base.startsWith('Countdown') ||
    base.startsWith('Order') ||
    base === 'CustomerAccountPage'
  ) return 'commerce';

  return 'public-other';
}

function lineFor(sourceFile, node) {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return position.line + 1;
}

function collectStaticConstants(sourceFile) {
  const constants = new Map();

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))
    ) {
      constants.set(node.name.text, node.initializer.text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return constants;
}

function safeTemplateFragment(text, trimLeftToken, trimRightToken) {
  let value = text;

  if (trimLeftToken && value && !/^\s/.test(value)) {
    value = value.replace(/^\S+/, '');
  }

  if (trimRightToken && value && !/\s$/.test(value)) {
    value = value.replace(/\S+$/, '');
  }

  return value;
}

function extractClassStrings(expression, sourceFile, constants) {
  if (!expression) return { fragments: [], unresolved: false };

  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return { fragments: [expression.text], unresolved: false };
  }

  if (ts.isIdentifier(expression)) {
    const value = constants.get(expression.text);
    return value === undefined
      ? { fragments: [], unresolved: true }
      : { fragments: [value], unresolved: false };
  }

  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    return extractClassStrings(expression.expression, sourceFile, constants);
  }

  if (ts.isConditionalExpression(expression)) {
    const whenTrue = extractClassStrings(expression.whenTrue, sourceFile, constants);
    const whenFalse = extractClassStrings(expression.whenFalse, sourceFile, constants);
    return {
      fragments: [...whenTrue.fragments, ...whenFalse.fragments],
      unresolved: whenTrue.unresolved || whenFalse.unresolved,
    };
  }

  if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = extractClassStrings(expression.left, sourceFile, constants);
    const right = extractClassStrings(expression.right, sourceFile, constants);
    return {
      fragments: [...left.fragments, ...right.fragments],
      unresolved: left.unresolved || right.unresolved,
    };
  }

  if (ts.isTemplateExpression(expression)) {
    const fragments = [];
    const spans = expression.templateSpans;

    const head = safeTemplateFragment(expression.head.text, false, spans.length > 0);
    if (head.trim()) fragments.push(head);

    let unresolved = false;
    spans.forEach((span, index) => {
      const nested = extractClassStrings(span.expression, sourceFile, constants);
      fragments.push(...nested.fragments);
      unresolved ||= nested.unresolved;

      const tail = safeTemplateFragment(
        span.literal.text,
        true,
        index < spans.length - 1,
      );
      if (tail.trim()) fragments.push(tail);
    });

    return { fragments, unresolved };
  }

  if (ts.isArrayLiteralExpression(expression)) {
    const parts = expression.elements.map((element) => extractClassStrings(element, sourceFile, constants));
    return {
      fragments: parts.flatMap((part) => part.fragments),
      unresolved: parts.some((part) => part.unresolved),
    };
  }

  return { fragments: [], unresolved: true };
}

function normalizeTokens(fragment) {
  return fragment
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !token.endsWith('-'));
}

function increment(map, key, file) {
  if (!map.has(key)) {
    map.set(key, { occurrences: 0, files: new Set() });
  }
  const value = map.get(key);
  value.occurrences += 1;
  value.files.add(file);
}

function utilityBase(token) {
  return token.split(':').at(-1) ?? token;
}

function variants(token) {
  const parts = token.split(':');
  return parts.length > 1 ? parts.slice(0, -1) : [];
}

function isTextSize(base) {
  return /^text-(xs|sm|base|lg|xl|[2-9]xl)$/.test(base);
}

function isTextColor(base) {
  return /^text-/.test(base) &&
    !isTextSize(base) &&
    !/^text-(left|center|right|justify|start|end|ellipsis|clip|wrap|nowrap|balance|pretty)$/.test(base);
}

function isBorderColor(base) {
  return /^border-(primary|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black|background|accent)(-|$|\/)/.test(base);
}

function isSpacing(base) {
  return /^(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|space-x|space-y)-/.test(base);
}

function isFont(base) {
  return /^font-(header|body|thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/.test(base);
}

function isLayout(base) {
  return [
    'block', 'inline-block', 'inline', 'flex', 'inline-flex', 'grid', 'inline-grid',
    'hidden', 'relative', 'absolute', 'fixed', 'sticky', 'static', 'contents',
  ].includes(base) ||
    /^(items|justify|self|place|grid-cols|grid-rows|col-span|row-span|overflow|object|aspect|z)-/.test(base);
}

const tokenStats = new Map();
const domainStats = new Map();
const categoryStats = new Map();
const breakpointStats = new Map();
const stateStats = new Map();
const combinationStats = new Map();
const arbitraryValues = new Map();
const dynamicExpressions = [];

const categoryNames = [
  'textSize',
  'font',
  'background',
  'textColor',
  'borderColor',
  'maxWidth',
  'spacing',
  'radius',
  'shadow',
  'duration',
  'layout',
];
categoryNames.forEach((name) => categoryStats.set(name, new Map()));

for (const filePath of renderFiles) {
  const rel = relative(filePath);
  const domain = classifyFile(filePath);
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const constants = collectStaticConstants(sourceFile);

  if (!domainStats.has(domain)) domainStats.set(domain, new Map());

  function recordFragment(fragment) {
    const tokens = normalizeTokens(fragment);
    if (!tokens.length) return;

    if (tokens.length > 1) {
      increment(combinationStats, tokens.join(' '), rel);
    }

    for (const token of tokens) {
      const base = utilityBase(token);
      increment(tokenStats, token, rel);
      increment(domainStats.get(domain), token, rel);

      if (isTextSize(base)) increment(categoryStats.get('textSize'), token, rel);
      if (isFont(base)) increment(categoryStats.get('font'), token, rel);
      if (/^bg-/.test(base)) increment(categoryStats.get('background'), token, rel);
      if (isTextColor(base)) increment(categoryStats.get('textColor'), token, rel);
      if (isBorderColor(base)) increment(categoryStats.get('borderColor'), token, rel);
      if (/^max-w-/.test(base)) increment(categoryStats.get('maxWidth'), token, rel);
      if (isSpacing(base)) increment(categoryStats.get('spacing'), token, rel);
      if (/^rounded/.test(base)) increment(categoryStats.get('radius'), token, rel);
      if (/^shadow/.test(base)) increment(categoryStats.get('shadow'), token, rel);
      if (/^duration-/.test(base)) increment(categoryStats.get('duration'), token, rel);
      if (isLayout(base)) increment(categoryStats.get('layout'), token, rel);

      for (const variant of variants(token)) {
        if (BREAKPOINTS.has(variant)) increment(breakpointStats, variant, rel);
        if (STATE_VARIANTS.has(variant) || variant.startsWith('peer-')) increment(stateStats, variant, rel);
      }

      if (/\[[^\]]+\]/.test(token)) increment(arbitraryValues, token, rel);
    }
  }

  function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.text === 'className' && node.initializer) {
      if (ts.isStringLiteral(node.initializer)) {
        recordFragment(node.initializer.text);
      } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        const result = extractClassStrings(node.initializer.expression, sourceFile, constants);
        result.fragments.forEach(recordFragment);
        if (result.unresolved) {
          dynamicExpressions.push({
            file: rel,
            line: lineFor(sourceFile, node),
            expression: node.initializer.expression.getText(sourceFile),
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

function serializeMap(map) {
  return Object.fromEntries(
    [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, { occurrences: value.occurrences, files: value.files.size }]),
  );
}

function aggregateDomains(names) {
  const result = new Map();
  for (const name of names) {
    const stats = domainStats.get(name);
    if (!stats) continue;
    for (const [token, value] of stats.entries()) {
      if (!result.has(token)) result.set(token, { occurrences: 0, files: new Set() });
      const target = result.get(token);
      target.occurrences += value.occurrences;
      value.files.forEach((file) => target.files.add(file));
    }
  }
  return result;
}

const publicAndShell = aggregateDomains(['shared-shell', 'public-editorial', 'public-other', 'commerce', 'account']);
const adminAndOperations = aggregateDomains(['admin', 'operations']);

const report = {
  schemaVersion: 1,
  source: {
    commit: process.env.GITHUB_SHA ?? null,
    renderingFilesScanned: renderFiles.length,
    designInputsInspected: designInputs.length,
    renderingFiles: renderFiles.map(relative),
  },
  totals: {
    staticClassOccurrences: [...tokenStats.values()].reduce((sum, value) => sum + value.occurrences, 0),
    uniqueStaticTokens: tokenStats.size,
    unresolvedDynamicExpressions: dynamicExpressions.length,
    arbitraryValueTokens: arbitraryValues.size,
  },
  categories: Object.fromEntries(
    categoryNames.map((name) => [name, serializeMap(categoryStats.get(name))]),
  ),
  responsivePrefixes: serializeMap(breakpointStats),
  stateVariants: serializeMap(stateStats),
  domainViews: {
    all: serializeMap(tokenStats),
    publicAndSharedShell: serializeMap(publicAndShell),
    adminAndOperations: serializeMap(adminAndOperations),
    byDomain: Object.fromEntries([...domainStats.entries()].map(([name, stats]) => [name, serializeMap(stats)])),
  },
  repeatedCombinations: serializeMap(combinationStats),
  arbitraryValues: serializeMap(arbitraryValues),
  dynamicExpressions,
};

function sortedRows(map) {
  return [...map.entries()].sort((a, b) => {
    if (b[1].occurrences !== a[1].occurrences) return b[1].occurrences - a[1].occurrences;
    if (b[1].files.size !== a[1].files.size) return b[1].files.size - a[1].files.size;
    return a[0].localeCompare(b[0]);
  });
}

function printTable(title, map, limit = Infinity) {
  console.log(`\n${title}`);
  console.log('token'.padEnd(48), 'occurrences'.padStart(11), 'files'.padStart(7));
  console.log('-'.repeat(70));
  for (const [token, value] of sortedRows(map).slice(0, limit)) {
    console.log(token.padEnd(48), String(value.occurrences).padStart(11), String(value.files.size).padStart(7));
  }
}

if (JSON_MODE) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('JOKO Design System Source Audit');
  console.log(`Commit: ${report.source.commit ?? 'working tree'}`);
  console.log(`Rendering files scanned: ${report.source.renderingFilesScanned}`);
  console.log(`Design inputs inspected: ${report.source.designInputsInspected}`);
  console.log(`Static class occurrences: ${report.totals.staticClassOccurrences}`);
  console.log(`Unique static tokens: ${report.totals.uniqueStaticTokens}`);
  console.log(`Unresolved dynamic expressions: ${report.totals.unresolvedDynamicExpressions}`);
  console.log(`Arbitrary-value tokens: ${report.totals.arbitraryValueTokens}`);

  const labels = {
    textSize: 'TEXT SIZE',
    font: 'FONT FAMILY / WEIGHT',
    background: 'BACKGROUND',
    textColor: 'TEXT COLOUR',
    borderColor: 'BORDER COLOUR',
    maxWidth: 'MAX WIDTH',
    spacing: 'SPACING',
    radius: 'RADIUS',
    shadow: 'SHADOW',
    duration: 'DURATION',
    layout: 'LAYOUT',
  };

  for (const name of categoryNames) {
    printTable(labels[name], categoryStats.get(name));
  }

  printTable('RESPONSIVE PREFIX', breakpointStats);
  printTable('STATE / INTERACTION VARIANTS', stateStats);
  printTable('REPEATED CLASS COMBINATIONS (TOP 25)', combinationStats, 25);
  printTable('ARBITRARY VALUES', arbitraryValues);

  console.log('\nDOMAIN FILE COUNTS');
  const domainFileCounts = new Map();
  renderFiles.forEach((file) => increment(domainFileCounts, classifyFile(file), relative(file)));
  for (const [name, value] of sortedRows(domainFileCounts)) {
    console.log(name.padEnd(24), String(value.files.size).padStart(3));
  }

  console.log('\nUNRESOLVED DYNAMIC EXPRESSIONS');
  if (!dynamicExpressions.length) {
    console.log('none');
  } else {
    dynamicExpressions.forEach((entry) => {
      console.log(`${entry.file}:${entry.line}  ${entry.expression.replace(/\s+/g, ' ').slice(0, 180)}`);
    });
  }
}
