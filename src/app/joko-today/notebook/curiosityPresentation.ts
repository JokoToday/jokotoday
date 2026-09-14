export type CuriosityPresentationLanguage = 'en' | 'th' | 'zh';

const topicLabels: Record<string, Record<CuriosityPresentationLanguage, string>> = {
  baking: { en: 'Baking', th: 'การอบ', zh: '烘焙' },
  croissants: { en: 'Croissants', th: 'ครัวซองต์', zh: '可颂' },
  lamination: { en: 'Lamination', th: 'ลามิเนต', zh: '层压面团' },
  temperature: { en: 'Temperature', th: 'อุณหภูมิ', zh: '温度' },
  'joko-today': { en: 'JOKO TODAY', th: 'JOKO TODAY', zh: 'JOKO TODAY' },
  ordering: { en: 'Ordering', th: 'การสั่งซื้อ', zh: '预订' },
  pickup: { en: 'Pickup', th: 'การรับสินค้า', zh: '取货' },
  bread: { en: 'Bread', th: 'ขนมปัง', zh: '面包' },
  aroma: { en: 'Aroma', th: 'กลิ่น', zh: '香气' },
  'everyday-science': { en: 'Everyday science', th: 'วิทยาศาสตร์ใกล้ตัว', zh: '日常科学' },
  dough: { en: 'Dough', th: 'แป้งโด', zh: '面团' },
  resting: { en: 'Resting', th: 'การพักแป้ง', zh: '静置' },
  yeast: { en: 'Yeast', th: 'ยีสต์', zh: '酵母' },
  fermentation: { en: 'Fermentation', th: 'การหมัก', zh: '发酵' },
  flowers: { en: 'Flowers', th: 'ดอกไม้', zh: '花朵' },
  plants: { en: 'Plants', th: 'พืช', zh: '植物' },
  colour: { en: 'Colour', th: 'สี', zh: '颜色' },
  'pre-order': { en: 'Pre-order', th: 'พรีออเดอร์', zh: '预订' },
  planning: { en: 'Planning', th: 'การวางแผน', zh: '规划' },
  flour: { en: 'Flour', th: 'แป้ง', zh: '面粉' },
  ingredients: { en: 'Ingredients', th: 'วัตถุดิบ', zh: '原料' },
  texture: { en: 'Texture', th: 'เนื้อสัมผัส', zh: '口感' },
};

export function curiosityTopicLabel(topic: string, language: CuriosityPresentationLanguage): string {
  return topicLabels[topic]?.[language] ?? topic;
}
