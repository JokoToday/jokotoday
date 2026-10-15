import { supabase } from '../../lib/supabase';
import { specialsCustomerCopy } from './customerCopy';

export const specialsContentFields = ['eyebrow', 'heading', 'accent', 'intro'] as const;
export type SpecialsContentField = (typeof specialsContentFields)[number];
export type SpecialsPageContent = Record<'en' | 'th' | 'zh', Record<SpecialsContentField, string>> & { illustration: { url: string; visible: boolean } };
export const defaultSpecialsIllustration = '/images/specials/croissant-tiny-bag.webp';
export function validSpecialsIllustrationUrl(value: string): boolean {
  if (!value) return true;
  if (/^\/images\/[a-zA-Z0-9_./-]+$/.test(value) && !value.includes('..')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'media.joko.today' && !url.username && !url.password && url.pathname !== '/' && !url.pathname.endsWith('/');
  } catch { return false; }
}
export function defaultSpecialsPageContent(): SpecialsPageContent {
  const content = Object.fromEntries(Object.entries(specialsCustomerCopy).map(([language, copy]) =>
    [language, Object.fromEntries(specialsContentFields.map(field => [field, copy[field]]))],
  )) as Record<'en' | 'th' | 'zh', Record<SpecialsContentField, string>>;
  return { ...content, illustration: { url: defaultSpecialsIllustration, visible: true } };
}
export async function loadSpecialsPageContent(): Promise<SpecialsPageContent> {
  const { data, error } = await supabase.from('cms_labels')
    .select('key,text_en,text_th,text_zh')
    .in('key', [...specialsContentFields.map(field => `specials_page_${field}`), 'specials_page_illustration_url', 'specials_page_illustration_visible']);
  if (error) throw error;
  const content = defaultSpecialsPageContent();
  for (const row of data || []) {
    if (row.key === 'specials_page_illustration_url' && typeof row.text_en === 'string' && validSpecialsIllustrationUrl(row.text_en.trim())) content.illustration.url = row.text_en.trim();
    if (row.key === 'specials_page_illustration_visible') content.illustration.visible = row.text_en !== 'false';
    for (const field of specialsContentFields) {
      if (row.key !== `specials_page_${field}`) continue;
      for (const language of ['en', 'th', 'zh'] as const) {
        const value = row[`text_${language}`];
        if (typeof value === 'string' && value.trim()) content[language][field] = value;
      }
    }
  }
  return content;
}
export async function saveSpecialsPageContent(content: SpecialsPageContent) {
  if (!validSpecialsIllustrationUrl(content.illustration.url.trim())) throw new Error('Use a JOKO Media image URL.');
  const rows = specialsContentFields.map(field => ({
    key: `specials_page_${field}`,
    text_en: content.en[field].trim(),
    text_th: content.th[field].trim(),
    text_zh: content.zh[field].trim(),
  }));
  for (const [field, value] of [['url', content.illustration.url.trim()], ['visible', String(content.illustration.visible)]]) rows.push({ key: `specials_page_illustration_${field}`, text_en: value, text_th: value, text_zh: value });
  const { data, error } = await supabase.from('cms_labels').upsert(rows, { onConflict: 'key' }).select('key');
  if (error) throw error;
  if (data?.length !== rows.length) throw new Error('Page text was not saved. Check your Admin permissions.');
}
