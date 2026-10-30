import type { SmileEpisode } from './smileCatalog';

// Design samples only: never inserted in the CMS, never treated as finished films.
const samples = [
  ["That's How the Cookie Rolls", 'คุกกี้กลิ้งกลับมา', '饼干滚回来了', 'A cookie with somewhere else to be.', '2026-10-28', 128, 'cookie'],
  ['A Cup of Surprise', 'ถ้วยแห่งความประหลาดใจ', '杯中惊喜', 'A small pause. An unexpected splash.', '2026-10-21', 86, 'cup'],
  ['Up, Up… Oops!', 'ลอยขึ้นไป… อุ๊ย!', '飞呀飞……哎呀！', 'Some things are harder to hold on to.', '2026-10-14', 214, 'balloon'],
  ['The Hat Trick', 'หมวกวิเศษ', '帽子戏法', 'One hat. More possibilities than expected.', '2026-09-30', 57, 'hat'],
  ['A Little Rain Check', 'ฝนตกนิดหน่อย', '等雨停一停', 'A very small cloud with a very big idea.', '2026-09-23', 172, 'cloud'],
  ['The Last Crumb', 'เศษคุกกี้ชิ้นสุดท้าย', '最后一粒饼干屑', 'Good things come in the smallest pieces.', '2026-09-16', 93, 'crumb'],
] as const;
export const smileSamples: SmileEpisode[] = samples.map(([en, th, zh, caption, date, , art], index) => ({
  id: 'sample-' + art, site_key: 'joko-today', category: 'joko-smile', media_type: 'video',
  media_url: '', thumbnail_url: '/assets/smile/sample-' + art + '.svg',
  title_en: en, title_th: th, title_zh: zh, caption_en: caption, caption_th: null, caption_zh: null,
  alt_en: en + ' — sample illustration', alt_th: null, alt_zh: null, sort_order: index,
  show_on_homepage: false, is_published: false, created_at: date + 'T12:00:00Z', updated_at: date + 'T12:00:00Z',
}));
export const sampleLikeCounts = Object.fromEntries(samples.map(([, , , , , count, art]) => ['sample-' + art, count]));
