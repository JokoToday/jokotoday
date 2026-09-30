import type {
  BuilderRichText,
  BuilderRichTextMarks,
  BuilderRichTextRun,
  LocalizedRichText,
} from './contracts';

function sameMarks(a: BuilderRichTextMarks | undefined, b: BuilderRichTextMarks | undefined): boolean {
  return Boolean(a?.bold) === Boolean(b?.bold)
    && Boolean(a?.italic) === Boolean(b?.italic)
    && (a?.color ?? 'text') === (b?.color ?? 'text');
}

export function normalizeBuilderRichText(value: BuilderRichText): BuilderRichText {
  const next: BuilderRichTextRun[] = [];

  for (const run of value) {
    if (!run || typeof run.text !== 'string' || run.text.length === 0) continue;

    const marks: BuilderRichTextMarks = {};
    if (run.marks?.bold) marks.bold = true;
    if (run.marks?.italic) marks.italic = true;
    if (run.marks?.color && run.marks.color !== 'text') marks.color = run.marks.color;

    const previous = next[next.length - 1];
    if (previous && sameMarks(previous.marks, marks)) {
      next[next.length - 1] = { ...previous, text: previous.text + run.text };
    } else {
      next.push(Object.keys(marks).length > 0 ? { text: run.text, marks } : { text: run.text });
    }
  }

  return next;
}

export function plainTextToRichText(value: string): BuilderRichText {
  return value.length > 0 ? [{ text: value }] : [];
}

export function richTextToPlainText(value: BuilderRichText): string {
  return value.map((run) => run.text).join('');
}

export function localizeRichText(
  value: LocalizedRichText | undefined,
  locale: string,
  fallbackLocale: string,
  plainFallback: string,
): BuilderRichText {
  const localized = value?.[locale];
  if (localized && localized.length > 0) return normalizeBuilderRichText(localized);

  // Rich-text formatting is locale-specific. When a locale has not been
  // formatted yet, prefer that locale's plain-title fallback rather than
  // borrowing rich text from another language.
  if (plainFallback.length > 0) return plainTextToRichText(plainFallback);

  const fallback = value?.[fallbackLocale] ?? (value ? Object.values(value)[0] : undefined);
  return fallback && fallback.length > 0 ? normalizeBuilderRichText(fallback) : [];
}
