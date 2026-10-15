import { uploadGalleryImage, PRODUCT_IMAGE_ACCEPTED_TYPES, PRODUCT_IMAGE_MAX_BYTES } from '../../lib/mediaService';
import { useEffect, useState, type FormEvent } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { defaultSpecialsPageContent, loadSpecialsPageContent, saveSpecialsPageContent, specialsContentFields, defaultSpecialsIllustration, validSpecialsIllustrationUrl } from './pageContent';

const labels = {
  en: { title: 'Specials page content', eyebrow: 'Small header', heading: 'Headline — first line', accent: 'Headline — highlighted line', intro: 'Introduction', save: 'Save page content', saved: 'Page content saved.', loading: 'Loading page text…', saving: 'Saving…', retry: 'Retry', failed: 'Could not load or save page text. Please try again.', hint: 'Edit each language below. This text appears even when no Specials are available.' },
  th: { title: 'เนื้อหาหน้าราคาพิเศษ', eyebrow: 'หัวข้อเล็ก', heading: 'พาดหัว — บรรทัดแรก', accent: 'พาดหัว — บรรทัดเน้น', intro: 'ข้อความแนะนำ', save: 'บันทึกเนื้อหาหน้า', saved: 'บันทึกเนื้อหาหน้าแล้ว', loading: 'กำลังโหลดข้อความ…', saving: 'กำลังบันทึก…', retry: 'ลองอีกครั้ง', failed: 'ไม่สามารถโหลดหรือบันทึกข้อความได้ กรุณาลองอีกครั้ง', hint: 'แก้ไขข้อความแต่ละภาษาด้านล่าง ข้อความนี้จะแสดงแม้ไม่มีสินค้าราคาพิเศษ' },
  zh: { title: '特惠页面内容', eyebrow: '小标题', heading: '主标题 — 第一行', accent: '主标题 — 高亮行', intro: '介绍文字', save: '保存页面内容', saved: '页面内容已保存。', loading: '正在加载文字…', saving: '正在保存…', retry: '重试', failed: '无法加载或保存文字，请重试。', hint: '在下方编辑各语言文字。暂无特惠商品时也会显示这些文字。' },
};
const illustrationLabels = {
  en: { title: 'Page illustration', show: 'Show illustration', upload: 'Choose & upload image', url: 'JOKO Media image URL', hint: 'One image is shared across all languages. Choose PNG or WebP for a transparent background (JPG also supported), up to 8 MB. Uploading prepares the image; save page content to publish it.', remove: 'Remove image', restore: 'Restore croissant illustration', uploading: 'Uploading image…', uploaded: 'Image uploaded. Save page content to publish it.', failed: 'Could not upload this image. Use JPG, PNG or WebP up to 8 MB and try again.', invalid: 'Use a complete HTTPS image URL from media.joko.today.', previewFailed: 'Image preview could not load. Check the image URL.' },
  th: { title: 'ภาพประกอบหน้า', show: 'แสดงภาพประกอบ', upload: 'เลือกและอัปโหลดภาพ', url: 'URL ภาพจาก JOKO Media', hint: 'ใช้ภาพเดียวกันทุกภาษา เลือก PNG หรือ WebP เพื่อใช้พื้นหลังโปร่งใส (รองรับ JPG ด้วย) ขนาดไม่เกิน 8 MB หลังอัปโหลดต้องบันทึกเนื้อหาหน้าเพื่อเผยแพร่ภาพ', remove: 'นำภาพออก', restore: 'คืนค่าภาพครัวซองต์', uploading: 'กำลังอัปโหลดภาพ…', uploaded: 'อัปโหลดภาพแล้ว กรุณาบันทึกเนื้อหาหน้าเพื่อเผยแพร่', failed: 'อัปโหลดภาพไม่ได้ กรุณาใช้ JPG, PNG หรือ WebP ไม่เกิน 8 MB แล้วลองอีกครั้ง', invalid: 'กรุณาใช้ URL ภาพ HTTPS แบบเต็มจาก media.joko.today', previewFailed: 'โหลดตัวอย่างภาพไม่ได้ กรุณาตรวจสอบ URL ภาพ' },
  zh: { title: '页面插图', show: '显示插图', upload: '选择并上传图片', url: 'JOKO Media 图片链接', hint: '所有语言共用一张图片。透明背景请使用 PNG 或 WebP（也支持 JPG），最大 8 MB。上传后需保存页面内容才能发布图片。', remove: '移除图片', restore: '恢复羊角面包插图', uploading: '正在上传图片…', uploaded: '图片已上传。请保存页面内容以发布。', failed: '图片上传失败。请使用不超过 8 MB 的 JPG、PNG 或 WebP 后重试。', invalid: '请输入 media.joko.today 的完整 HTTPS 图片链接。', previewFailed: '无法加载图片预览，请检查链接。' },
};
export function SpecialsPageContentEditor() {
  const { language } = useLanguage();
  const copy = labels[language];
  const imageCopy = illustrationLabels[language];
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
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
  function updateIllustration(patch: Partial<typeof content.illustration>) {
    setSaved(false); setUploaded(false); setPreviewFailed(false);
    setContent(previous => ({ ...previous, illustration: { ...previous.illustration, ...patch } }));
  }
  async function upload(file?: File) {
    if (!file || busy || uploading) return;
    setUploadError(false); setUploaded(false); setSaved(false);
    if (!PRODUCT_IMAGE_ACCEPTED_TYPES.includes(file.type as typeof PRODUCT_IMAGE_ACCEPTED_TYPES[number]) || file.size <= 0 || file.size > PRODUCT_IMAGE_MAX_BYTES) { setUploadError(true); return; }
    setUploading(true);
    try {
      const result = await uploadGalleryImage({ file, gallerySlot: 'specials-illustration' });
      updateIllustration({ url: result.publicUrl, visible: true }); setUploaded(true);
    } catch { setUploadError(true); }
    finally { setUploading(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || uploading || !loaded || !validSpecialsIllustrationUrl(content.illustration.url.trim())) return;
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
      <fieldset disabled={busy || uploading} className="space-y-3 rounded-xl border border-[#55766F]/25 p-4">
        <legend className="px-2 font-semibold">{imageCopy.title}</legend>
        <p className="text-sm">{imageCopy.hint}</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={content.illustration.visible} onChange={event => updateIllustration({ visible: event.target.checked })} />{imageCopy.show}</label>
        <label className="block text-sm">{imageCopy.upload}<input type="file" accept={PRODUCT_IMAGE_ACCEPTED_TYPES.join(',')} className="mt-2 block max-w-full text-sm" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void upload(file); }} /></label>
        <label className="block text-sm">{imageCopy.url}<input type="text" value={content.illustration.url} onChange={event => updateIllustration({ url: event.target.value })} aria-invalid={!validSpecialsIllustrationUrl(content.illustration.url.trim())} className="joko-admin-field mt-1 w-full max-w-xl" /></label>
        {!validSpecialsIllustrationUrl(content.illustration.url.trim()) && <p role="alert" className="text-sm text-red-800">{imageCopy.invalid}</p>}
        {content.illustration.url && validSpecialsIllustrationUrl(content.illustration.url.trim()) && <img key={content.illustration.url} src={content.illustration.url} alt="" onError={() => setPreviewFailed(true)} className="max-h-56 max-w-full rounded-xl bg-[#D9ECE9] object-contain p-3" />}
        {previewFailed && <p role="alert" className="text-sm text-red-800">{imageCopy.previewFailed}</p>}
        {uploading && <p role="status" className="text-sm">{imageCopy.uploading}</p>}
        {uploaded && <p role="status" className="text-sm text-[#55766F]">{imageCopy.uploaded}</p>}
        {uploadError && <p role="alert" className="text-sm text-red-800">{imageCopy.failed}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="button" className="joko-admin-secondary-button px-3 py-2" onClick={() => updateIllustration({ url: '', visible: false })}>{imageCopy.remove}</button>
          <button type="button" className="joko-admin-secondary-button px-3 py-2" onClick={() => updateIllustration({ url: defaultSpecialsIllustration, visible: true })}>{imageCopy.restore}</button>
        </div>
      </fieldset>
      <div className="grid gap-5 lg:grid-cols-3">{(['en', 'th', 'zh'] as const).map(lang => <fieldset key={lang} disabled={busy || uploading} className="min-w-0 space-y-3">
        <legend className="mb-2 font-semibold">{{ en: 'English', th: 'ไทย', zh: '简体中文' }[lang]}</legend>
        {specialsContentFields.map(field => <label key={field} className="block text-sm">{copy[field]}
          <textarea required maxLength={field === 'intro' ? 1200 : 200} rows={field === 'intro' ? 4 : 2} lang={lang} value={content[lang][field]} onChange={event => {
            setSaved(false); setContent(previous => ({ ...previous, [lang]: { ...previous[lang], [field]: event.target.value } }));
          }} className="mt-1 w-full rounded-xl border border-[#55766F]/25 bg-[#FFF9EE] p-3" />
        </label>)}
      </fieldset>)}</div>
      <button disabled={busy || uploading || !validSpecialsIllustrationUrl(content.illustration.url.trim())} className="joko-admin-primary-button px-4 py-3">{busy ? copy.saving : copy.save}</button>
    </form>}
  </details>;
}
