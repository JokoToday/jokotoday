import { useEffect, useState, type FormEvent } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { defaultSpecialsPageContent, loadSpecialsPageContent, saveSpecialsPageContent, specialsContentFields } from './pageContent';

const labels = {
  en: { title: 'Specials page text', eyebrow: 'Small header', heading: 'Headline — first line', accent: 'Headline — highlighted line', intro: 'Introduction', save: 'Save page text', saved: 'Page text saved.', loading: 'Loading page text…', saving: 'Saving…', retry: 'Retry', failed: 'Could not load or save page text. Please try again.', hint: 'Edit each language below. This text appears even when no Specials are available.' },
  th: { title: 'ข้อความหน้าราคาพิเศษ', eyebrow: 'หัวข้อเล็ก', heading: 'พาดหัว — บรรทัดแรก', accent: 'พาดหัว — บรรทัดเน้น', intro: 'ข้อความแนะนำ', save: 'บันทึกข้อความ', saved: 'บันทึกข้อความแล้ว', loading: 'กำลังโหลดข้อความ…', saving: 'กำลังบันทึก…', retry: 'ลองอีกครั้ง', failed: 'ไม่สามารถโหลดหรือบันทึกข้อความได้ กรุณาลองอีกครั้ง', hint: 'แก้ไขข้อความแต่ละภาษาด้านล่าง ข้อความนี้จะแสดงแม้ไม่มีสินค้าราคาพิเศษ' },
  zh: { title: '特惠页面文字', eyebrow: '小标题', heading: '主标题 — 第一行', accent: '主标题 — 高亮行', intro: '介绍文字', save: '保存页面文字', saved: '页面文字已保存。', loading: '正在加载文字…', saving: '正在保存…', retry: '重试', failed: '无法加载或保存文字，请重试。', hint: '在下方编辑各语言文字。暂无特惠商品时也会显示这些文字。' },
};
export function SpecialsPageContentEditor() {
  const { language } = useLanguage();
  const copy = labels[language];
  const [content, setContent] = useState(defaultSpecialsPageContent);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  async function load() {
    setError(false);
    try { setContent(await loadSpecialsPageContent()); setLoaded(true); }
    catch { setError(true); }
  }
  useEffect(() => { void load(); }, []);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || !loaded) return;
    setBusy(true); setError(false); setSaved(false);
    try { await saveSpecialsPageContent(content); setSaved(true); }
    catch { setError(true); }
    finally { setBusy(false); }
  }
  return <details className="joko-admin-paper-card p-5 sm:p-6">
    <summary className="joko-admin-title cursor-pointer text-xl">{copy.title}</summary>
    <p className="mt-3 text-sm">{copy.hint}</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-800">{copy.failed} {!loaded && <button type="button" className="underline" onClick={() => void load()}>{copy.retry}</button>}</p>}
    {saved && <p role="status" className="mt-3 text-sm text-[#55766F]">{copy.saved}</p>}
    {!loaded ? <p className="mt-3 text-sm">{copy.loading}</p> : <form onSubmit={event => void save(event)} className="mt-4 space-y-4">
      <div className="grid gap-5 lg:grid-cols-3">{(['en', 'th', 'zh'] as const).map(lang => <fieldset key={lang} disabled={busy} className="min-w-0 space-y-3">
        <legend className="mb-2 font-semibold">{{ en: 'English', th: 'ไทย', zh: '简体中文' }[lang]}</legend>
        {specialsContentFields.map(field => <label key={field} className="block text-sm">{copy[field]}
          <textarea required maxLength={field === 'intro' ? 1200 : 200} rows={field === 'intro' ? 4 : 2} lang={lang} value={content[lang][field]} onChange={event => {
            setSaved(false); setContent(previous => ({ ...previous, [lang]: { ...previous[lang], [field]: event.target.value } }));
          }} className="mt-1 w-full rounded-xl border border-[#55766F]/25 bg-[#FFF9EE] p-3" />
        </label>)}
      </fieldset>)}</div>
      <button disabled={busy} className="joko-admin-primary-button px-4 py-3">{busy ? copy.saving : copy.save}</button>
    </form>}
  </details>;
}
