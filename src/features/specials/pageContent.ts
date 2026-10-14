import { supabase } from '../../lib/supabase';
import { specialsCustomerCopy } from './customerCopy';

export const specialsContentFields = ['eyebrow', 'heading', 'accent', 'intro'] as const;
export type SpecialsContentField = (typeof specialsContentFields)[number];
export type SpecialsPageContent = Record<'en' | 'th' | 'zh', Record<SpecialsContentField, string>>;
export function defaultSpecialsPageContent(): SpecialsPageContent {
  return Object.fromEntries(Object.entries(specialsCustomerCopy).map(([language, copy]) =>
    [language, Object.fromEntries(specialsContentFields.map(field => [field, copy[field]]))],
  )) as SpecialsPageContent;
}
export async function loadSpecialsPageContent(): Promise<SpecialsPageContent> {
  const { data, error } = await supabase.from('cms_labels')
    .select('key,text_en,text_th,text_zh')
    .in('key', specialsContentFields.map(field => `specials_page_${field}`));
  if (error) throw error;
  const content = defaultSpecialsPageContent();
  for (const row of data || []) {
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
  const rows = specialsContentFields.map(field => ({
    key: `specials_page_${field}`,
    text_en: content.en[field].trim(),
    text_th: content.th[field].trim(),
    text_zh: content.zh[field].trim(),
  }));
  const { data, error } = await supabase.from('cms_labels').upsert(rows, { onConflict: 'key' }).select('key');
  if (error) throw error;
  if (data?.length !== rows.length) throw new Error('Page text was not saved. Check your Admin permissions.');
}
