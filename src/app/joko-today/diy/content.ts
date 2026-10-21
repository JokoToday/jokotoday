import { diyCopy } from './copy';
export type DiyLanguage = 'en' | 'th' | 'zh';
export type DiyText = { [Key in keyof typeof diyCopy.en]: string };
export const diyContentFields = [
  { key: 'eyebrow', label: 'Small heading', rows: 2 },
  { key: 'headline', label: 'Main heading — first line', rows: 2 },
  { key: 'homemade', label: 'Main heading — orange italic line', rows: 2 },
  { key: 'community', label: 'People-for-people statement', rows: 2 },
  { key: 'intro', label: 'Introduction', rows: 4 },
  { key: 'curated', label: 'Small discovery note', rows: 2 },
  { key: 'featured', label: 'Notebook heading', rows: 2 },
  { key: 'original', label: 'Original-video button', rows: 2 },
  { key: 'browse', label: 'Catalog heading', rows: 2 },
  { key: 'search', label: 'Search placeholder', rows: 2 },
  { key: 'store', label: 'Store invitation', rows: 3 },
  { key: 'storeLink', label: 'Store button', rows: 2 },
] as const;
export type DiyContentField = typeof diyContentFields[number]['key'];
export type DiyPageContent = Record<DiyLanguage, Record<DiyContentField, string>>;
export interface DiyLabelRow { key: string; text_en: string; text_th: string; text_zh?: string | null }
export const diyLabelKey = (field: DiyContentField) => `diy_page_${field}`;
export const diyLabelKeys = diyContentFields.map(field => diyLabelKey(field.key));
export function resolveDiyPageContent(rows: DiyLabelRow[]): DiyPageContent {
  const content = {} as DiyPageContent;
  for (const language of ['en', 'th', 'zh'] as const) {
    content[language] = {} as Record<DiyContentField, string>;
    for (const { key } of diyContentFields) {
      const row = rows.find(item => item.key === diyLabelKey(key));
      const value = row?.[`text_${language}`];
      content[language][key] = value?.trim() ? value : diyCopy[language][key];
    }
  }
  return content;
}
export function diyContentRows(content: DiyPageContent): DiyLabelRow[] {
  return diyContentFields.map(({ key }) => ({ key: diyLabelKey(key), text_en: content.en[key].trim(), text_th: content.th[key].trim(), text_zh: content.zh[key].trim() }));
}
export function validateDiyContent(content: DiyPageContent): string | null {
  for (const language of ['en', 'th', 'zh'] as const) {
    for (const field of diyContentFields) {
      const value = content[language][field.key].trim();
      if (!value) return `${field.label} is required (${language.toUpperCase()}).`;
      if (value.length > 2000) return `${field.label} must be 2,000 characters or fewer (${language.toUpperCase()}).`;
    }
  }
  return null;
}
