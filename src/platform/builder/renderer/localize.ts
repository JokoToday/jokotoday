import type { LocalizedText } from '../contracts';

export function localize(
  value: LocalizedText,
  locale: string,
  fallbackLocale: string,
): string {
  return value[locale] ?? value[fallbackLocale] ?? Object.values(value)[0] ?? '';
}
