import type { Language } from '../translations';
import { SMILE_ACTING_TIMING, SMILE_LOCKED_TIMING } from './smilePlayback';

export const EP001_ENGLISH_MEDIA = 'https://media.joko.today/smile/ep001/v2.1/JOKO_SMILE_Ep001_Complete_v2.1.mp4';
export const EP001_WEB_MEDIA = 'https://media.joko.today/smile/ep001/web-v1/Ep001_Web_Shared_v1.mp4';
export const EP001_ACTING_ENGLISH_MEDIA = '/assets/smile/ep001-acting-v02/JOKO_SMILE_Ep001_Acting_v0.2.mp4';
export const EP001_ACTING_WEB_MEDIA = '/assets/smile/ep001-acting-v02/Ep001_Web_Shared_Acting_v0.2.mp4';
export const SMILE_CARD_ASSETS = '/assets/smile/ep001-i18n/';
export function localizedSmileMedia(mediaUrl: string, language: Language) {
  // The existing catalog record opts into the approved acting edition without a DB write.
  // Explicit locked shared URLs retain their original timing; neither old file is replaced.
  const revised = [EP001_ENGLISH_MEDIA, EP001_ACTING_ENGLISH_MEDIA, EP001_ACTING_WEB_MEDIA].includes(mediaUrl);
  if (!revised && mediaUrl !== EP001_WEB_MEDIA) return null;
  return {
    src: revised ? EP001_ACTING_WEB_MEDIA : EP001_WEB_MEDIA,
    poster: SMILE_CARD_ASSETS + `poster-${language}.png`,
    timing: revised ? SMILE_ACTING_TIMING : SMILE_LOCKED_TIMING,
  };
}
export function standaloneSmileMedia(mediaUrl: string) {
  // Generic native/favorites players need complete English text, never a shared blank plate.
  if ([EP001_ENGLISH_MEDIA, EP001_ACTING_WEB_MEDIA].includes(mediaUrl)) return EP001_ACTING_ENGLISH_MEDIA;
  if (mediaUrl === EP001_WEB_MEDIA) return EP001_ENGLISH_MEDIA;
  return mediaUrl;
}
export const smilePilotCopy = {
  en: { title: 'Ep. 001 — How the Cookies Roll', caption: 'A cookie with somewhere else to be.', slogan: ['A little moment.', 'A little smile.'] },
  th: { title: 'ตอน 001 — คุกกี้กลิ้งไป… กลิ้งมา', caption: 'คุกกี้ที่ไม่ยอมอยู่กับที่', slogan: ['ช่วงเวลาเล็ก ๆ', 'รอยยิ้มเล็ก ๆ'] },
  zh: { title: '第001集 — 饼干滚呀滚', caption: '一块总想滚去别处的饼干。', slogan: ['片刻小憩。', '一点微笑。'] },
};
