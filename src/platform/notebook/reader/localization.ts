import type { NotebookLocalizedText } from '../contracts';

export function getNotebookLocalizedText(
  value: NotebookLocalizedText | undefined,
  locale: string,
  defaultLocale: string,
): string {
  if (!value) return '';

  const exact = value[locale]?.trim();
  if (exact) return exact;

  const fallback = value[defaultLocale]?.trim();
  if (fallback) return fallback;

  return Object.values(value).find((candidate) => candidate?.trim())?.trim() ?? '';
}
