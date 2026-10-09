import type { LocalizedText, TopMenuItem, TopMenuKey } from './contracts';

export const TOP_MENU_KEYS: readonly TopMenuKey[] = [
  'home', 'products', 'other-products', 'makers', 'how-it-works', 'pickup', 'about',
];

export const TOP_MENU_DEFAULT_LABELS: Readonly<Record<TopMenuKey, LocalizedText>> = {
  home: { en: 'Home', th: 'หน้าแรก', zh: '首页' },
  products: { en: 'Baked', th: 'ขนมอบ', zh: '烘焙好物' },
  'other-products': { en: 'Beyond', th: 'ของดีอื่น ๆ', zh: '其他好物' },
  makers: { en: 'Makers', th: 'ผู้ผลิต', zh: '制作人' },
  'how-it-works': { en: 'How It Works', th: 'วิธีสั่งซื้อ', zh: '如何订购' },
  pickup: { en: 'Pick Up', th: 'จุดรับสินค้า', zh: '取货' },
  about: { en: 'About', th: 'เกี่ยวกับเรา', zh: '关于' },
};

export function resolveTopMenu(value: unknown): TopMenuItem[] {
  const input = Array.isArray(value) ? value : [];
  const used = new Set<TopMenuKey>();
  const result: TopMenuItem[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    if (typeof record.key !== 'string' || !TOP_MENU_KEYS.includes(record.key as TopMenuKey)) continue;
    const key = record.key as TopMenuKey;
    if (used.has(key)) continue;
    used.add(key);
    const labels = TOP_MENU_DEFAULT_LABELS[key];
    const custom = record.labels && typeof record.labels === 'object' && !Array.isArray(record.labels)
      ? record.labels as Record<string, unknown> : {};
    result.push({
      key,
      visible: record.visible !== false,
      labels: Object.fromEntries(['en', 'th', 'zh'].map((locale) => [locale,
        typeof custom[locale] === 'string' && custom[locale].trim() ? custom[locale] : labels[locale],
      ])),
    });
  }
  for (const key of TOP_MENU_KEYS) {
    if (!used.has(key)) result.push({ key, visible: true, labels: { ...TOP_MENU_DEFAULT_LABELS[key] } });
  }
  return result;
}

export function getTopMenuLabel(item: TopMenuItem, locale: string): string {
  return item.labels?.[locale]?.trim() || item.labels?.en?.trim() || TOP_MENU_DEFAULT_LABELS[item.key][locale] || TOP_MENU_DEFAULT_LABELS[item.key].en;
}
