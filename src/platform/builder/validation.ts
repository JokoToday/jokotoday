import {
  BUILDER_REGISTRY_VERSION,
  BUILDER_SCHEMA_VERSION,
  type BuilderAction,
  type BuilderDocument,
  type BuilderSection,
  type BuilderSectionType,
  type LocalizedText,
  type LocalizedRichText,
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

function validateOptionalLocalizedText(
  value: unknown,
  path: string,
  issues: BuilderValidationIssue[],
  supportedLocales?: readonly string[],
): value is LocalizedText {
  if (!isRecord(value)) {
    pushIssue(issues, path, 'Expected localized text object.');
    return false;
  }

  let valid = true;
  for (const [locale, text] of Object.entries(value)) {
    if (!isNonEmptyString(locale) || typeof text !== 'string') {
      pushIssue(issues, `${path}.${locale || '<empty>'}`, 'Expected localized text string.');
      valid = false;
      continue;
    }
    if (supportedLocales && !supportedLocales.includes(locale)) {
      pushIssue(issues, `${path}.${locale}`, 'Unsupported Site locale.');
      valid = false;
    }
  }

  return valid;
}

function validateLocalizedRichText(
  value: unknown,
  path: string,
  issues: BuilderValidationIssue[],
  supportedLocales?: readonly string[],
): value is LocalizedRichText {
  if (!isRecord(value)) {
    pushIssue(issues, path, 'Expected localized rich text object.');
    return false;
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    pushIssue(issues, path, 'Localized rich text must contain at least one locale.');
    return false;
  }

  let valid = true;
  for (const [locale, runs] of entries) {
    if (supportedLocales && !supportedLocales.includes(locale)) {
      pushIssue(issues, `${path}.${locale}`, 'Unsupported Site locale.');
      valid = false;
      continue;
    }
    if (!Array.isArray(runs) || runs.length === 0) {
      pushIssue(issues, `${path}.${locale}`, 'Rich text must contain at least one text run.');
      valid = false;
      continue;
    }
    let plain = '';
    runs.forEach((run, index) => {
      if (!isRecord(run) || typeof run.text !== 'string') {
        pushIssue(issues, `${path}.${locale}[${index}]`, 'Rich text run must contain text.');
        valid = false;
        return;
      }
      plain += run.text;
      if (run.marks !== undefined) {
        if (!isRecord(run.marks)) {
          pushIssue(issues, `${path}.${locale}[${index}].marks`, 'Rich text marks must be an object.');
          valid = false;
        } else {
          const marks = run.marks;
          if (marks.color !== undefined && !['text', 'accent', 'turquoise'].includes(String(marks.color))) {
            pushIssue(issues, `${path}.${locale}[${index}].marks.color`, 'Unsupported rich text color.');
            valid = false;
          }
          if (marks.font !== undefined && !['inherit', 'display', 'body', 'handwritten'].includes(String(marks.font))) {
            pushIssue(issues, `${path}.${locale}[${index}].marks.font`, 'Unsupported text font.');
          }
          if (marks.size !== undefined && (typeof marks.size !== 'number' || !Number.isInteger(marks.size) || marks.size < 12 || marks.size > 108)) {
            pushIssue(issues, `${path}.${locale}[${index}].marks.size`, 'Word font size must be 12–108px.');
          }
        }
      }
    });
    if (!plain.trim()) {
      pushIssue(issues, `${path}.${locale}`, 'Rich text must contain visible text.');
      valid = false;
    }
  }
  return valid;
}

function validateBranding(value: unknown, issues: BuilderValidationIssue[]) {
  if (value === undefined) return;
  if (!isRecord(value)) {
    pushIssue(issues, 'branding', 'Branding must be an object.');
    return;
  }

  if (typeof value.logoScale !== 'number' || value.logoScale < 70 || value.logoScale > 150) {
    pushIssue(issues, 'branding.logoScale', 'Logo scale must be between 70 and 150.');
  }

  if (!isRecord(value.typography)) {
    pushIssue(issues, 'branding.typography', 'Typography must be an object.');
  } else {
    const typography = value.typography;
    if (!['noto-sans', 'inter', 'playfair-display'].includes(String(typography.displayFont))) {
      pushIssue(issues, 'branding.typography.displayFont', 'Unsupported display font.');
    }
    if (!['inter', 'noto-sans'].includes(String(typography.bodyFont))) {
      pushIssue(issues, 'branding.typography.bodyFont', 'Unsupported body font.');
    }
    for (const field of ['displayWeight', 'bodyWeight'] as const) {
      const value = typography[field];
      if (value !== undefined && ![300, 400, 500, 600, 700, 800, 900].includes(Number(value))) {
        pushIssue(issues, `branding.typography.${field}`, 'Unsupported font weight.');
      }
    }
    const optionalFontChecks: Array<[string, unknown, readonly string[]]> = [
      ['thaiDisplayFont', typography.thaiDisplayFont, ['noto-sans-thai-looped', 'noto-sans-thai', 'sarabun', 'bai-jamjuree', 'maitree']],
      ['thaiBodyFont', typography.thaiBodyFont, ['noto-sans-thai-looped', 'noto-sans-thai', 'sarabun', 'bai-jamjuree']],
      ['chineseDisplayFont', typography.chineseDisplayFont, ['noto-sans-sc', 'noto-serif-sc']],
      ['chineseBodyFont', typography.chineseBodyFont, ['noto-sans-sc', 'noto-serif-sc']],
    ];
    for (const [field, fieldValue, allowed] of optionalFontChecks) {
      if (fieldValue !== undefined && !allowed.includes(String(fieldValue))) {
        pushIssue(issues, `branding.typography.${field}`, `Unsupported ${field}.`);
      }
    }

    const ranges: Array<[string, unknown, number, number]> = [
      ['heroSize', typography.heroSize, 42, 88],
      ['sectionHeadingSize', typography.sectionHeadingSize, 24, 56],
      ['bodySize', typography.bodySize, 14, 20],
      ['navSize', typography.navSize, 12, 20],
      ['buttonSize', typography.buttonSize, 13, 20],
      ['labelSize', typography.labelSize, 9, 15],
    ];
    for (const [field, fieldValue, min, max] of ranges) {
      if (typeof fieldValue !== 'number' || fieldValue < min || fieldValue > max) {
        pushIssue(issues, `branding.typography.${field}`, `${field} must be between ${min} and ${max}.`);
      }
    }
  }

  if (value.aboutCards !== undefined) {
    if (!isRecord(value.aboutCards)) {
      pushIssue(issues, 'branding.aboutCards', 'About images must be an object.');
    } else {
      for (const [key, card] of Object.entries(value.aboutCards)) {
        if (!['bakery', 'people', 'story'].includes(key)) {
          pushIssue(issues, `branding.aboutCards.${key}`, 'Unsupported About card.');
        } else if (!isRecord(card)) {
          pushIssue(issues, `branding.aboutCards.${key}`, 'About card image must be an object.');
        } else {
          if (card.imageUrl !== undefined && (
            !isNonEmptyString(card.imageUrl)
            || !(card.imageUrl.startsWith('/') && !card.imageUrl.startsWith('//') || /^https:\/\//i.test(card.imageUrl))
          )) {
            pushIssue(issues, `branding.aboutCards.${key}.imageUrl`, 'Image must be a bundled path or HTTPS URL.');
          }
          if (card.imageAlt !== undefined) {
            validateOptionalLocalizedText(card.imageAlt, `branding.aboutCards.${key}.imageAlt`, issues, ['en', 'th', 'zh']);
          }
        }
      }
    }
  }

  if (value.topMenu !== undefined) {
    if (!Array.isArray(value.topMenu) || value.topMenu.length !== 6) {
      pushIssue(issues, 'branding.topMenu', 'Top menu must have all six fixed destinations.');
    } else {
      const allowed = ['home', 'products', 'other-products', 'how-it-works', 'pickup', 'about'];
      const keys = new Set<string>();
      value.topMenu.forEach((item: unknown, index: number) => {
        const path = `branding.topMenu[${index}]`;
        if (!isRecord(item) || !allowed.includes(String(item.key)) || keys.has(String(item.key))) {
          pushIssue(issues, path, 'Unknown or duplicate menu destination.');
          return;
        }
        keys.add(String(item.key));
        if (typeof item.visible !== 'boolean') pushIssue(issues, `${path}.visible`, 'Visibility must be a boolean.');
        if (item.labels !== undefined) {
          validateOptionalLocalizedText(item.labels, `${path}.labels`, issues, ['en', 'th', 'zh']);
          if (isRecord(item.labels) && Object.values(item.labels).some((label) => typeof label !== 'string' || !label.trim() || label.length > 50)) {
            pushIssue(issues, `${path}.labels`, 'Menu labels must be 1–50 characters.');
          }
        }
      });
    }
  }

  if (!isRecord(value.colors)) {
    pushIssue(issues, 'branding.colors', 'Brand colors must be an object.');
  } else {
    for (const key of ['text', 'accent', 'turquoise'] as const) {
      const color = value.colors[key];
      if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) {
        pushIssue(issues, `branding.colors.${key}`, 'Expected a 6-digit hex color.');
      }
    }
  }
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

function validateHeroTextStyle(value: unknown, path: string, issues: BuilderValidationIssue[]) {
  if (!isRecord(value)) { pushIssue(issues, path, 'Expected typography settings.'); return; }
  if (value.font !== undefined && !['inherit', 'display', 'body', 'handwritten'].includes(String(value.font))) {
    pushIssue(issues, `${path}.font`, 'Unsupported font.');
  }
  const min = path.endsWith('.eyebrowStyle') ? 9 : 12;
  const max = path.endsWith('.eyebrowStyle') || path.endsWith('.subtitleStyle') ? 42 : 108;
  if (value.size !== undefined && (typeof value.size !== 'number' || !Number.isInteger(value.size) || value.size < min || value.size > max)) {
    pushIssue(issues, `${path}.size`, `Font size must be ${min}–108px.`);
  }
  if (value.align !== undefined && !['left', 'center', 'right'].includes(String(value.align))) {
    pushIssue(issues, `${path}.align`, 'Unsupported alignment.');
  }
  for (const mark of ['bold', 'italic']) {
    if (value[mark] !== undefined && typeof value[mark] !== 'boolean') pushIssue(issues, `${path}.${mark}`, 'Expected boolean.');
  }
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
      if (value.props.logoUrl !== undefined) {
        if (
          !isNonEmptyString(value.props.logoUrl) ||
          (!value.props.logoUrl.startsWith('/') && !/^https:\/\//i.test(value.props.logoUrl))
        ) {
          pushIssue(issues, `${path}.props.logoUrl`, 'Logo must be a bundled path or HTTPS URL.');
        }
      }
      if (value.props.notebookNote !== undefined) {
        if (!isRecord(value.props.notebookNote)) {
          pushIssue(issues, `${path}.props.notebookNote`, 'Hero notebook note must be an object.');
        } else {
          const note = value.props.notebookNote;
          if (typeof note.enabled !== 'boolean') {
            pushIssue(issues, `${path}.props.notebookNote.enabled`, 'Hero notebook visibility must be boolean.');
          }
          if (note.title !== undefined) {
            validateOptionalLocalizedText(note.title, `${path}.props.notebookNote.title`, issues, locales);
          }
          if (note.body !== undefined) {
            validateOptionalLocalizedText(note.body, `${path}.props.notebookNote.body`, issues, locales);
          }
          if (note.imageAlt !== undefined) {
            validateOptionalLocalizedText(note.imageAlt, `${path}.props.notebookNote.imageAlt`, issues, locales);
          }
          if (
            note.fontPreset !== undefined
            && !['handwritten', 'display', 'body'].includes(String(note.fontPreset))
          ) {
            pushIssue(issues, `${path}.props.notebookNote.fontPreset`, 'Unsupported hero notebook font preset.');
          }
          if (
            note.headingSize !== undefined
            && (
              typeof note.headingSize !== 'number'
              || note.headingSize < 16
              || note.headingSize > 32
            )
          ) {
            pushIssue(issues, `${path}.props.notebookNote.headingSize`, 'Hero notebook heading size must be between 16 and 32.');
          }
          if (
            note.bodySize !== undefined
            && (
              typeof note.bodySize !== 'number'
              || note.bodySize < 11
              || note.bodySize > 20
            )
          ) {
            pushIssue(issues, `${path}.props.notebookNote.bodySize`, 'Hero notebook body size must be between 11 and 20.');
          }
          if (
            note.imageUrl !== undefined
            && (
              !isNonEmptyString(note.imageUrl)
              || (!note.imageUrl.startsWith('/') && !/^https:\/\//i.test(note.imageUrl))
            )
          ) {
            pushIssue(issues, `${path}.props.notebookNote.imageUrl`, 'Hero notebook image must be a bundled path or HTTPS URL.');
          }
          if (
            note.linkUrl !== undefined
            && (
              !isNonEmptyString(note.linkUrl)
              || (!note.linkUrl.startsWith('/') && !note.linkUrl.startsWith('#') && !/^https:\/\//i.test(note.linkUrl))
            )
          ) {
            pushIssue(issues, `${path}.props.notebookNote.linkUrl`, 'Hero notebook link must be an internal path, hash, or HTTPS URL.');
          }
        }
      }
      if (value.props.eyebrow !== undefined) validateOptionalLocalizedText(value.props.eyebrow, `${path}.props.eyebrow`, issues, locales);
      for (const field of ['eyebrowStyle', 'titleStyle', 'subtitleStyle']) {
        if (value.props[field] !== undefined) validateHeroTextStyle(value.props[field], `${path}.props.${field}`, issues);
      }
      if (value.props.titleLineStyles !== undefined) {
        if (!isRecord(value.props.titleLineStyles)) {
          pushIssue(issues, `${path}.props.titleLineStyles`, 'Expected localized line styles.');
        } else for (const [locale, styles] of Object.entries(value.props.titleLineStyles)) {
          if ((locales && !locales.includes(locale)) || !Array.isArray(styles) || styles.length > 12) {
            pushIssue(issues, `${path}.props.titleLineStyles.${locale}`, 'Expected up to twelve localized line styles.');
          } else styles.forEach((style: unknown, line: number) => validateHeroTextStyle(style, `${path}.props.titleLineStyles.${locale}[${line}]`, issues));
        }
      }
      if (value.props.subtitleRichText !== undefined) {
        validateLocalizedRichText(value.props.subtitleRichText, `${path}.props.subtitleRichText`, issues, locales);
      }
      validateLocalizedText(value.props.title, `${path}.props.title`, issues, locales);
      if (value.props.titleRichText !== undefined) {
        validateLocalizedRichText(value.props.titleRichText, `${path}.props.titleRichText`, issues, locales);
      }
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
      if (value.props.titleRichText !== undefined) {
        validateLocalizedRichText(value.props.titleRichText, `${path}.props.titleRichText`, issues, locales);
      }
      validateLocalizedText(value.props.subtitle, `${path}.props.subtitle`, issues, locales);
      if (value.props.subtitleRichText !== undefined) {
        validateLocalizedRichText(value.props.subtitleRichText, `${path}.props.subtitleRichText`, issues, locales);
      }
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

  validateBranding(input.branding, issues);

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
