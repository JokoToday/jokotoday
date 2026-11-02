import type { Language } from '../translations';

export const EP001_ENGLISH_MEDIA = 'https://media.joko.today/smile/ep001/v2.1/JOKO_SMILE_Ep001_Complete_v2.1.mp4';
export const EP001_WEB_MEDIA = 'https://media.joko.today/smile/ep001/web-v1/Ep001_Web_Shared_v1.mp4';
export const SMILE_CARD_ASSETS = '/assets/smile/ep001-i18n/';
export function localizedSmileMedia(mediaUrl: string, language: Language) {
  // Opt in only this approved pilot. Other episodes/providers stay unchanged.
  return mediaUrl === EP001_ENGLISH_MEDIA ? {
    src: EP001_WEB_MEDIA,
    poster: SMILE_CARD_ASSETS + `poster-${language}.png`,
  } : null;
}
export const smilePilotCopy = {
  en: { title: 'Ep. 001 — How the Cookies Roll', caption: 'A cookie with somewhere else to be.', slogan: ['A little moment.', 'A little smile.'] },
  th: { title: 'ตอน 001 — คุกกี้กลิ้งไป… กลิ้งมา', caption: 'คุกกี้ที่ไม่ยอมอยู่กับที่', slogan: ['ช่วงเวลาเล็ก ๆ', 'รอยยิ้มเล็ก ๆ'] },
  zh: { title: '第001集 — 饼干滚呀滚', caption: '一块总想滚去别处的饼干。', slogan: ['片刻小憩。', '一点微笑。'] },
};
