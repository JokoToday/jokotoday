import type { CMSPage } from '../../../lib/cmsService';

export type LegalPageKind = 'terms' | 'privacy';
export type LegalLocale = 'en' | 'th' | 'zh';

type LegalCopy = { title: string; placeholder: string; back: string };
type LegalPageConfig = {
  pageKey: string;
  href: string;
  copy: Record<LegalLocale, LegalCopy>;
};

export const LEGAL_PAGES: Record<LegalPageKind, LegalPageConfig> = {
  terms: {
    pageKey: 'terms_of_use',
    href: '/terms',
    copy: {
      en: { title: 'Terms of Use', placeholder: 'Our Terms of Use are being prepared. Please check back soon.', back: 'Back to homepage' },
      th: { title: 'ข้อกำหนดการใช้งาน', placeholder: 'เรากำลังจัดเตรียมข้อกำหนดการใช้งาน โปรดกลับมาตรวจสอบอีกครั้ง', back: 'กลับหน้าหลัก' },
      zh: { title: '使用条款', placeholder: '我们正在准备使用条款，请稍后再查看。', back: '返回首页' },
    },
  },
  privacy: {
    pageKey: 'privacy_policy',
    href: '/privacy',
    copy: {
      en: { title: 'Privacy Policy', placeholder: 'Our Privacy Policy is being prepared. Please check back soon.', back: 'Back to homepage' },
      th: { title: 'นโยบายความเป็นส่วนตัว', placeholder: 'เรากำลังจัดเตรียมนโยบายความเป็นส่วนตัว โปรดกลับมาตรวจสอบอีกครั้ง', back: 'กลับหน้าหลัก' },
      zh: { title: '隐私政策', placeholder: '我们正在准备隐私政策，请稍后再查看。', back: '返回首页' },
    },
  },
};

export function legalPagePreset(kind: LegalPageKind) {
  const config = LEGAL_PAGES[kind];
  return {
    page_key: config.pageKey,
    title_en: config.copy.en.title,
    title_th: config.copy.th.title,
    title_zh: config.copy.zh.title,
    body_en: config.copy.en.placeholder,
    body_th: config.copy.th.placeholder,
    body_zh: config.copy.zh.placeholder,
  };
}

export function localizedLegalContent(page: CMSPage | null, kind: LegalPageKind, locale: LegalLocale) {
  const config = LEGAL_PAGES[kind];
  const fallback = config.copy[locale];
  if (!page) return { title: fallback.title, body: fallback.placeholder, isPlaceholder: true };

  const title = locale === 'en'
    ? page.title_en
    : locale === 'th'
      ? page.title_th || page.title_en
      : page.title_zh || page.title_en;
  const body = locale === 'en'
    ? page.body_en
    : locale === 'th'
      ? page.body_th || page.body_en
      : page.body_zh || page.body_en;

  return {
    title: title?.trim() || fallback.title,
    body: body?.trim() || fallback.placeholder,
    isPlaceholder: !body?.trim() || body.trim() === config.copy[locale].placeholder
      || body.trim() === config.copy.en.placeholder,
  };
}
