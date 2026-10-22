import { supabase } from '../../../lib/supabase';
import { diyContentRows, diyLabelKeys, resolveDiyPageContent, validateDiyContent, type DiyLabelRow, type DiyPageContent } from './content';

export async function loadDiyPageContent(): Promise<DiyPageContent> {
  const { data, error } = await supabase.from('cms_labels').select('key,text_en,text_th,text_zh').in('key', diyLabelKeys);
  if (error) throw error;
  return resolveDiyPageContent((data ?? []) as DiyLabelRow[]);
}
/** Uses existing admin-only INSERT/UPDATE RLS. No privileged key or new policy. */
export async function saveDiyPageContent(content: DiyPageContent): Promise<DiyPageContent> {
  const problem = validateDiyContent(content);
  if (problem) throw new Error(problem);
  const rows = diyContentRows(content);
  // One statement saves all languages together; select verifies returned rows,
  // so an empty or partial response is never reported as a successful save.
  const { data, error } = await supabase.from('cms_labels').upsert(rows, { onConflict: 'key' }).select('key,text_en,text_th,text_zh');
  if (error) throw error;
  if (!data || data.length !== rows.length || rows.some(expected => !data.some(actual =>
    actual.key === expected.key && actual.text_en === expected.text_en && actual.text_th === expected.text_th && actual.text_zh === expected.text_zh))) {
    throw new Error('The save could not be verified. Reload the editor to check the current text.');
  }
  window.dispatchEvent(new Event('joko-diy-content-updated'));
  return resolveDiyPageContent(data as DiyLabelRow[]);
}
