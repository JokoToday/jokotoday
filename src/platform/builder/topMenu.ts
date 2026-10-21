import type { LocalizedText, TopMenuItem, TopMenuKey } from './contracts';

export const TOP_MENU_KEYS: readonly TopMenuKey[] = [
  'home', 'products', 'other-products', 'makers', 'specials', 'diy', 'how-it-works', 'about', 'pickup',
];

export const TOP_MENU_DEFAULT_LABELS: Readonly<Record<TopMenuKey, LocalizedText>> = {
  home: { en: 'Home', th: 'หน้าแรก', zh: '首页' },
  products: { en: 'JOKO Bakery', th: 'JOKO เบเกอรี่', zh: 'JOKO 烘焙' },
  'other-products': { en: 'JOKO Store', th: 'JOKO สโตร์', zh: 'JOKO 商店' },
  specials: { en: 'Specials', th: 'ราคาพิเศษ', zh: '今日特惠' },
  makers: { en: 'Creator Circle', th: 'Creator Circle', zh: '创作者圈' },
  'how-it-works': { en: 'How It Works', th: 'วิธีสั่งซื้อ', zh: '如何订购' },
  pickup: { en: 'Pick Up', th: 'จุดรับสินค้า', zh: '取货' },
  about: { en: 'About JOKO', th: 'เกี่ยวกับ JOKO', zh: '关于 JOKO' },
  diy: { en: 'JOKO DIY', th: 'JOKO DIY', zh: 'JOKO DIY' },
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
    // Upgrade only labels that match the old built-in menu, never overwrite
    // names explicitly customized by editors.
    const previousDefaults: Record<string, Record<string, string>> = {
      products: { en: 'Baked', th: 'ขนมอบ', zh: '烘焙好物' },
      'other-products': { en: 'Beyond', th: 'ของดีอื่น ๆ', zh: '其他好物' },
      makers: { en: 'Makers', th: 'ผู้ผลิต', zh: '制作人' },
      about: { en: 'About', th: 'เกี่ยวกับเรา', zh: '关于' },
    };
    const adjusted = Object.fromEntries(['en', 'th', 'zh'].map((locale) => [
      locale, (custom[locale] === previousDefaults[key]?.[locale] || (key === 'makers' && ({en: ['Fellow Makers', 'JOKO Circle'], th: ['เพื่อนผู้ผลิต', 'JOKO Circle'], zh: ['合作创作者', 'JOKO 创作者', 'JOKO Circle']}[locale] as string[]).includes(String(custom[locale])))) ? labels[locale] : custom[locale],
    ]));
    result.push({
      key,
      visible: record.visible !== false,
      descriptions: record.descriptions && typeof record.descriptions === 'object' && !Array.isArray(record.descriptions)
        ? Object.fromEntries(['en', 'th', 'zh'].map((locale) => [locale,
          typeof (record.descriptions as Record<string, unknown>)[locale] === 'string'
            ? (record.descriptions as Record<string, string>)[locale].slice(0, 120) : '',
        ])) : undefined,
      href: typeof record.href === 'string' && /^\/(?!\/)[a-zA-Z0-9/#?&=_-]*$/.test(record.href)
        ? record.href : undefined,
      labels: Object.fromEntries(['en', 'th', 'zh'].map((locale) => [locale,
        typeof adjusted[locale] === 'string' && adjusted[locale].trim() ? adjusted[locale] : labels[locale],
      ])),
    });
  }
  for (const key of TOP_MENU_KEYS) {
    if (!used.has(key)) {
      const item = { key, visible: true, labels: { ...TOP_MENU_DEFAULT_LABELS[key] } };
      if (key === 'specials') {
        const beyond = result.findIndex((entry) => entry.key === 'other-products');
        const how = result.findIndex((entry) => entry.key === 'how-it-works');
        result.splice(beyond >= 0 ? beyond + 1 : how >= 0 ? how : result.length, 0, item);
      } else result.push(item);
    }
  }
  return result;
}

export function getTopMenuLabel(item: TopMenuItem, locale: string): string {
  return item.labels?.[locale]?.trim() || item.labels?.en?.trim() || TOP_MENU_DEFAULT_LABELS[item.key][locale] || TOP_MENU_DEFAULT_LABELS[item.key].en;
}
