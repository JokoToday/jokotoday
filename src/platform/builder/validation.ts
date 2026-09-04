import {
  BUILDER_REGISTRY_VERSION,
  BUILDER_SCHEMA_VERSION,
  type BuilderAction,
  type BuilderDocument,
  type BuilderSection,
  type BuilderSectionType,
  type LocalizedText,
} from './contracts';
import {
  getBuilderComponentDefinition,
  isBuilderSectionType,
  homepageComponentRegistry,
} from './registry';

export interface BuilderValidationIssue {
  path: string;
  message: string;
}

export type BuilderValidationResult =
  | { ok: true; value: BuilderDocument }
  | { ok: false; issues: BuilderValidationIssue[] };

export interface BuilderValidationOptions {
  supportedLocales?: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function pushIssue(issues: BuilderValidationIssue[], path: string, message: string) {
  issues.push({ path, message });
}

function validateLocalizedText(
  value: unknown,
  path: string,
  issues: BuilderValidationIssue[],
  supportedLocales?: readonly string[],
): value is LocalizedText {
  if (!isRecord(value)) {
    pushIssue(issues, path, 'Expected localized text object.');
    return false;
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    pushIssue(issues, path, 'Localized text must contain at least one locale.');
    return false;
  }

  let valid = true;
  for (const [locale, text] of entries) {
    if (!isNonEmptyString(locale) || !isNonEmptyString(text)) {
      pushIssue(issues, `${path}.${locale || '<empty>'}`, 'Expected non-empty localized text.');
      valid = false;
    }
  }

  for (const locale of supportedLocales ?? []) {
    if (!isNonEmptyString(value[locale])) {
      pushIssue(issues, `${path}.${locale}`, 'Missing required Site locale.');
      valid = false;
    }
  }

  return valid;
}

function validateAction(
  value: unknown,
  path: string,
  issues: BuilderValidationIssue[],
): value is BuilderAction {
  if (!isRecord(value) || !isNonEmptyString(value.type)) {
    pushIssue(issues, path, 'Expected typed Builder action.');
    return false;
  }

  if (value.type === 'commerce.openProducts' || value.type === 'site.openHowItWorks') {
    return true;
  }

  if (value.type === 'commerce.browseCategory') {
    if (!isNonEmptyString(value.categoryId)) {
      pushIssue(issues, `${path}.categoryId`, 'Category action requires categoryId.');
      return false;
    }
    return true;
  }

  pushIssue(issues, `${path}.type`, `Unsupported action type: ${value.type}`);
  return false;
}

function validateCommonSection(
  value: Record<string, unknown>,
  path: string,
  issues: BuilderValidationIssue[],
): BuilderSectionType | null {
  if (!isNonEmptyString(value.id)) {
    pushIssue(issues, `${path}.id`, 'Section id must be a non-empty string.');
  }

  if (!isBuilderSectionType(value.type)) {
    pushIssue(issues, `${path}.type`, 'Unknown Builder section type.');
    return null;
  }

  if (value.version !== 1) {
    pushIssue(issues, `${path}.version`, 'Unsupported section version.');
  }

  if (typeof value.visible !== 'boolean') {
    pushIssue(issues, `${path}.visible`, 'Section visibility must be boolean.');
  }

  if (!isRecord(value.design)) {
    pushIssue(issues, `${path}.design`, 'Section design must be an object.');
  } else {
    const definition = getBuilderComponentDefinition(value.type);
    if (!definition.capabilities.widths.includes(value.design.width as never)) {
      pushIssue(issues, `${path}.design.width`, 'Unsupported width for this component.');
    }
    if (!definition.capabilities.spacings.includes(value.design.spacing as never)) {
      pushIssue(issues, `${path}.design.spacing`, 'Unsupported spacing for this component.');
    }
  }

  if (!isRecord(value.props)) {
    pushIssue(issues, `${path}.props`, 'Section props must be an object.');
  }

  return value.type;
}

function validateSection(
  value: unknown,
  index: number,
  issues: BuilderValidationIssue[],
  options: BuilderValidationOptions,
): value is BuilderSection {
  const path = `sections[${index}]`;
  if (!isRecord(value)) {
    pushIssue(issues, path, 'Section must be an object.');
    return false;
  }

  const type = validateCommonSection(value, path, issues);
  if (!type || !isRecord(value.props) || !isRecord(value.design)) return false;

  const locales = options.supportedLocales;

  switch (type) {
    case 'home.hero.v1':
      validateLocalizedText(value.props.title, `${path}.props.title`, issues, locales);
      validateLocalizedText(value.props.subtitle, `${path}.props.subtitle`, issues, locales);
      validateLocalizedText(value.props.primaryActionLabel, `${path}.props.primaryActionLabel`, issues, locales);
      validateAction(value.props.primaryAction, `${path}.props.primaryAction`, issues);
      validateLocalizedText(value.props.secondaryActionLabel, `${path}.props.secondaryActionLabel`, issues, locales);
      validateAction(value.props.secondaryAction, `${path}.props.secondaryAction`, issues);
      validateLocalizedText(value.props.mediaAlt, `${path}.props.mediaAlt`, issues, locales);
      if (value.design.layout !== 'split-media-right') {
        pushIssue(issues, `${path}.design.layout`, 'Unsupported Hero layout.');
      }
      break;

    case 'home.top-liked.v1':
      validateLocalizedText(value.props.title, `${path}.props.title`, issues, locales);
      validateLocalizedText(value.props.subtitle, `${path}.props.subtitle`, issues, locales);
      validateLocalizedText(value.props.browseLabel, `${path}.props.browseLabel`, issues, locales);
      validateAction(value.props.browseAction, `${path}.props.browseAction`, issues);
      if (value.design.variant !== 'cards') {
        pushIssue(issues, `${path}.design.variant`, 'Unsupported Most Loved variant.');
      }
      break;

    case 'home.category-grid.v1':
      validateLocalizedText(value.props.title, `${path}.props.title`, issues, locales);
      if (value.design.layout !== 'responsive-catalogue') {
        pushIssue(issues, `${path}.design.layout`, 'Unsupported Category Grid layout.');
      }
      break;

    case 'home.cta.v1':
      validateLocalizedText(value.props.title, `${path}.props.title`, issues, locales);
      validateLocalizedText(value.props.body, `${path}.props.body`, issues, locales);
      validateLocalizedText(value.props.actionLabel, `${path}.props.actionLabel`, issues, locales);
      validateAction(value.props.action, `${path}.props.action`, issues);
      if (value.design.variant !== 'brand-panel') {
        pushIssue(issues, `${path}.design.variant`, 'Unsupported CTA variant.');
      }
      if (value.design.alignment !== 'center') {
        pushIssue(issues, `${path}.design.alignment`, 'Unsupported CTA alignment.');
      }
      break;
  }

  return true;
}

export function validateBuilderDocument(
  input: unknown,
  options: BuilderValidationOptions = {},
): BuilderValidationResult {
  const issues: BuilderValidationIssue[] = [];

  if (!isRecord(input)) {
    return { ok: false, issues: [{ path: '$', message: 'Builder document must be an object.' }] };
  }

  if (input.schemaVersion !== BUILDER_SCHEMA_VERSION) {
    pushIssue(issues, 'schemaVersion', 'Unsupported Builder schema version.');
  }

  if (input.registryVersion !== BUILDER_REGISTRY_VERSION) {
    pushIssue(issues, 'registryVersion', 'Unsupported Component Registry version.');
  }

  if (input.pageKey !== 'home') {
    pushIssue(issues, 'pageKey', 'Homepage Builder v1 only supports pageKey "home".');
  }

  if (!Array.isArray(input.sections)) {
    pushIssue(issues, 'sections', 'Builder document sections must be an array.');
    return { ok: false, issues };
  }

  const seenIds = new Set<string>();
  const counts = new Map<BuilderSectionType, number>();

  input.sections.forEach((section, index) => {
    const valid = validateSection(section, index, issues, options);
    if (!valid || !isRecord(section) || !isBuilderSectionType(section.type)) return;

    if (isNonEmptyString(section.id)) {
      if (seenIds.has(section.id)) {
        pushIssue(issues, `sections[${index}].id`, 'Section id must be unique.');
      }
      seenIds.add(section.id);
    }

    counts.set(section.type, (counts.get(section.type) ?? 0) + 1);
  });

  for (const [type, count] of counts) {
    const maxInstances = homepageComponentRegistry[type].maxInstances;
    if (count > maxInstances) {
      pushIssue(issues, 'sections', `${type} exceeds maxInstances=${maxInstances}.`);
    }
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: input as unknown as BuilderDocument };
}
