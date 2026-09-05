import {
  NOTEBOOK_SCHEMA_VERSION,
  type NotebookBlock,
  type NotebookEntry,
  type NotebookEntryRef,
  type NotebookFixtureBundle,
  type NotebookLocalizedText,
  type NotebookRouteTarget,
} from './contracts';

export interface NotebookValidationResult {
  valid: boolean;
  errors: string[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateLocalizedText(
  value: NotebookLocalizedText,
  supportedLocales: readonly string[],
  field: string,
  errors: string[],
): void {
  for (const locale of supportedLocales) {
    if (!isNonEmptyString(value[locale])) {
      errors.push(`${field}.${locale} must be non-empty`);
    }
  }
}

function entryRefKey(ref: NotebookEntryRef): string {
  return `${ref.kind}:${ref.id}`;
}

function entryKey(entry: NotebookEntry): string {
  return `${entry.kind}:${entry.id}`;
}

function validateRouteTarget(
  target: NotebookRouteTarget,
  entries: readonly NotebookEntry[],
  field: string,
  errors: string[],
): void {
  if (target.type === 'notebook.today' || target.type === 'notebook.history') return;

  const kind = target.type === 'notebook.person'
    ? 'person'
    : target.type === 'notebook.product'
      ? 'product'
      : 'question';

  if (!entries.some((entry) => entry.kind === kind && entry.slug === target.slug)) {
    errors.push(`${field} points to missing ${kind} slug "${target.slug}"`);
  }
}

function validateBlock(
  block: NotebookBlock,
  supportedLocales: readonly string[],
  entries: readonly NotebookEntry[],
  field: string,
  errors: string[],
): void {
  if (!isNonEmptyString(block.id)) errors.push(`${field}.id must be non-empty`);

  switch (block.type) {
    case 'text':
      if (!block.eyebrow && !block.heading && !block.body) {
        errors.push(`${field} text block must contain eyebrow, heading, or body`);
      }
      if (block.eyebrow) validateLocalizedText(block.eyebrow, supportedLocales, `${field}.eyebrow`, errors);
      if (block.heading) validateLocalizedText(block.heading, supportedLocales, `${field}.heading`, errors);
      if (block.body) validateLocalizedText(block.body, supportedLocales, `${field}.body`, errors);
      break;
    case 'asset':
      if (!isNonEmptyString(block.asset.id)) errors.push(`${field}.asset.id must be non-empty`);
      validateLocalizedText(block.alt, supportedLocales, `${field}.alt`, errors);
      if (block.caption) validateLocalizedText(block.caption, supportedLocales, `${field}.caption`, errors);
      break;
    case 'callout':
      if (block.heading) validateLocalizedText(block.heading, supportedLocales, `${field}.heading`, errors);
      validateLocalizedText(block.body, supportedLocales, `${field}.body`, errors);
      if (block.relatedEntryRef && !entries.some((entry) => entryKey(entry) === entryRefKey(block.relatedEntryRef!))) {
        errors.push(`${field}.relatedEntryRef points to a missing entry`);
      }
      if (block.action) {
        validateLocalizedText(block.action.label, supportedLocales, `${field}.action.label`, errors);
        validateRouteTarget(block.action.target, entries, `${field}.action.target`, errors);
      }
      break;
    case 'entry-link':
      if (!entries.some((entry) => entryKey(entry) === entryRefKey(block.entryRef))) {
        errors.push(`${field}.entryRef points to a missing entry`);
      }
      validateLocalizedText(block.label, supportedLocales, `${field}.label`, errors);
      if (block.note) validateLocalizedText(block.note, supportedLocales, `${field}.note`, errors);
      break;
  }
}

export function validateNotebookFixtureBundle(bundle: NotebookFixtureBundle): NotebookValidationResult {
  const errors: string[] = [];

  if (bundle.schemaVersion !== NOTEBOOK_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${NOTEBOOK_SCHEMA_VERSION}`);
  }

  const locales = bundle.site.supportedLocales;
  if (locales.length === 0) errors.push('site.supportedLocales must not be empty');
  if (!locales.includes(bundle.site.defaultLocale)) {
    errors.push('site.defaultLocale must be included in site.supportedLocales');
  }

  const entryIds = new Set<string>();
  const entrySlugsByKind = new Set<string>();

  for (const [index, entry] of bundle.entries.entries()) {
    const field = `entries[${index}]`;
    if (!isNonEmptyString(entry.id)) errors.push(`${field}.id must be non-empty`);
    if (!isNonEmptyString(entry.slug)) errors.push(`${field}.slug must be non-empty`);
    if (entryIds.has(entry.id)) errors.push(`${field}.id must be unique`);
    entryIds.add(entry.id);

    const slugKey = `${entry.kind}:${entry.slug}`;
    if (entrySlugsByKind.has(slugKey)) errors.push(`${field}.slug must be unique within ${entry.kind}`);
    entrySlugsByKind.add(slugKey);

    validateLocalizedText(entry.title, locales, `${field}.title`, errors);
    validateLocalizedText(entry.summary, locales, `${field}.summary`, errors);

    if (entry.kind === 'person' && entry.favoriteProductRef) {
      if (!bundle.entries.some((candidate) => entryKey(candidate) === entryRefKey(entry.favoriteProductRef!))) {
        errors.push(`${field}.favoriteProductRef points to a missing product entry`);
      }
    }
    if (entry.kind === 'product' && entry.note) {
      validateLocalizedText(entry.note, locales, `${field}.note`, errors);
    }
    if (entry.kind === 'question') {
      validateLocalizedText(entry.question, locales, `${field}.question`, errors);
      if (entry.answerTeaser) {
        validateLocalizedText(entry.answerTeaser, locales, `${field}.answerTeaser`, errors);
      }
    }
  }

  if (bundle.today.schemaVersion !== NOTEBOOK_SCHEMA_VERSION) {
    errors.push(`today.schemaVersion must be ${NOTEBOOK_SCHEMA_VERSION}`);
  }
  if (bundle.today.siteId !== bundle.site.siteId) {
    errors.push('today.siteId must match site.siteId');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bundle.today.date)) {
    errors.push('today.date must use YYYY-MM-DD');
  }

  validateLocalizedText(bundle.today.title, locales, 'today.title', errors);
  if (bundle.today.subtitle) {
    validateLocalizedText(bundle.today.subtitle, locales, 'today.subtitle', errors);
  }

  const featuredRefKeys = new Set<string>();
  for (const [index, ref] of bundle.today.featuredEntryRefs.entries()) {
    const key = entryRefKey(ref);
    if (featuredRefKeys.has(key)) errors.push(`today.featuredEntryRefs[${index}] must be unique`);
    featuredRefKeys.add(key);
    if (!bundle.entries.some((entry) => entryKey(entry) === key)) {
      errors.push(`today.featuredEntryRefs[${index}] points to a missing entry`);
    }
  }

  if (bundle.today.surfaces.length === 0) errors.push('today.surfaces must not be empty');
  const surfaceIds = new Set<string>();
  const blockIds = new Set<string>();

  for (const [surfaceIndex, surface] of bundle.today.surfaces.entries()) {
    const surfaceField = `today.surfaces[${surfaceIndex}]`;
    if (!isNonEmptyString(surface.id)) errors.push(`${surfaceField}.id must be non-empty`);
    if (surfaceIds.has(surface.id)) errors.push(`${surfaceField}.id must be unique`);
    surfaceIds.add(surface.id);
    if (surface.blocks.length === 0) errors.push(`${surfaceField}.blocks must not be empty`);

    for (const [blockIndex, block] of surface.blocks.entries()) {
      const blockField = `${surfaceField}.blocks[${blockIndex}]`;
      if (blockIds.has(block.id)) errors.push(`${blockField}.id must be unique across the Today document`);
      blockIds.add(block.id);
      validateBlock(block, locales, bundle.entries, blockField, errors);
    }
  }

  for (const [index, item] of bundle.history.entries()) {
    const field = `history[${index}]`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date)) errors.push(`${field}.date must use YYYY-MM-DD`);
    if (!isNonEmptyString(item.todayDocumentId)) errors.push(`${field}.todayDocumentId must be non-empty`);
    validateLocalizedText(item.title, locales, `${field}.title`, errors);
    if (item.excerpt) validateLocalizedText(item.excerpt, locales, `${field}.excerpt`, errors);
  }

  return { valid: errors.length === 0, errors };
}

export function assertValidNotebookFixtureBundle(bundle: NotebookFixtureBundle): NotebookFixtureBundle {
  const result = validateNotebookFixtureBundle(bundle);
  if (!result.valid) {
    throw new Error(`Invalid Notebook fixture:\n${result.errors.join('\n')}`);
  }
  return bundle;
}
