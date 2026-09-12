import { getProductBySlug, getSetting, type CMSProduct } from './cmsService';
import { getPublicImageUrl } from './storage';
import { supabase } from './supabase';
import {
  assertValidNotebookFixtureBundle,
  type NotebookFixtureBundle,
  type NotebookLocalizedText,
} from '../platform/notebook';

export const NOTEBOOK_CONTENT_CONFIG_KEY = 'notebook_homepage_content_v1';

export type NotebookContentLocale = 'en' | 'th' | 'zh';
export type NotebookContentText = Record<NotebookContentLocale, string>;

export interface NotebookContentHistoryItem {
  date: string;
  todayDocumentId: string;
  title: NotebookContentText;
  excerpt: NotebookContentText;
}

export interface NotebookContentConfigV1 {
  version: 1;
  date: string;
  intro: {
    eyebrow: NotebookContentText;
    statement: NotebookContentText;
    note: NotebookContentText;
  };
  today: {
    eyebrow: NotebookContentText;
    title: NotebookContentText;
    subtitle: NotebookContentText;
  };
  person: {
    name: string;
    summary: NotebookContentText;
  };
  featuredProductSlug: string;
  featuredProductImageUrl: string;
  question: {
    title: NotebookContentText;
    summary: NotebookContentText;
    question: NotebookContentText;
    answerTeaser: NotebookContentText;
  };
  scene: {
    imageUrl: string;
    alt: NotebookContentText;
  };
  history: NotebookContentHistoryItem[];
}

export interface ResolvedNotebookContent {
  config: NotebookContentConfigV1;
  bundle: NotebookFixtureBundle;
  assetUrls: Readonly<Record<string, string>>;
  featuredProductImageUrl: string;
  commerceProduct: CMSProduct | null;
}

export const DEFAULT_NOTEBOOK_CONTENT_CONFIG: NotebookContentConfigV1 = {
  version: 1,
  date: '2026-09-06',
  intro: {
    eyebrow: {
      en: 'Today in the notebook',
      th: 'วันนี้ในสมุดบันทึก',
      zh: '今天的笔记',
    },
    statement: {
      en: 'A bakery. Curious people. One notebook that keeps growing.',
      th: 'ร้านเบเกอรี่ ผู้คนช่างสงสัย และสมุดเล่มหนึ่งที่ค่อย ๆ เติบโตขึ้นทุกวัน',
      zh: '一家烘焙坊。一群好奇的人。一本不断长大的笔记本。',
    },
    note: {
      en: 'Today starts with Emma at Sunday Walking Street — one small observation leading to another.',
      th: 'วันนี้เริ่มจาก Emma ที่ถนนคนเดินวันอาทิตย์ — การสังเกตเล็ก ๆ ที่พาไปสู่อีกเรื่องหนึ่ง',
      zh: '今天从星期日步行街的 Emma 开始——一个小小的发现，又带出下一个发现。',
    },
  },
  today: {
    eyebrow: {
      en: 'TODAY’S PAGE',
      th: 'หน้าวันนี้',
      zh: '今日一页',
    },
    title: {
      en: 'Emma’s note',
      th: 'บันทึกของ Emma',
      zh: 'Emma 的笔记',
    },
    subtitle: {
      en: 'Sunday, Walking Street',
      th: 'วันอาทิตย์ · ถนนคนเดิน',
      zh: '星期日 · 步行街',
    },
  },
  person: {
    name: 'Emma',
    summary: {
      en: 'A curious walker who notices small things and has a soft spot for almond croissants.',
      th: 'นักเดินผู้ช่างสังเกตที่ชอบมองเห็นเรื่องเล็ก ๆ และชื่นชอบอัลมอนด์ครัวซองต์เป็นพิเศษ',
      zh: '一位喜欢留意细小事物的好奇漫步者，也格外喜欢杏仁可颂。',
    },
  },
  featuredProductSlug: 'almond-croissant',
  featuredProductImageUrl: '/assets/home-experience/almond-croissant-v1.webp',
  question: {
    title: {
      en: 'A small baking curiosity',
      th: 'ความสงสัยเล็ก ๆ เรื่องการอบ',
      zh: '一个小小的烘焙好奇',
    },
    summary: {
      en: 'A question worth carrying into the bakery.',
      th: 'คำถามเล็ก ๆ ที่น่าพกติดตัวเข้าไปในเบเกอรี่',
      zh: '一个值得带进烘焙坊的小问题。',
    },
    question: {
      en: 'Why do some croissants feel crisp outside and airy inside?',
      th: 'ทำไมครัวซองต์บางชิ้นถึงกรอบด้านนอกแต่เบาโปร่งด้านใน?',
      zh: '为什么有些可颂外层酥脆，里面却轻盈蓬松？',
    },
    answerTeaser: {
      en: 'The answer starts with layers, temperature and patience.',
      th: 'คำตอบเริ่มต้นจากชั้นแป้ง อุณหภูมิ และความอดทน',
      zh: '答案从层次、温度和耐心开始。',
    },
  },
  scene: {
    imageUrl: '/assets/home-experience/emma-sunday-walking-street-v1.webp',
    alt: {
      en: 'Emma noticing a small yellow flower at Sunday Walking Street in Chiang Mai.',
      th: 'Emma กำลังสังเกตดอกไม้สีเหลืองเล็ก ๆ ที่ถนนคนเดินวันอาทิตย์ในเชียงใหม่',
      zh: 'Emma 在清迈星期日步行街留意一朵小黄花。',
    },
  },
  history: [],
};

const LOCALES: NotebookContentLocale[] = ['en', 'th', 'zh'];
const MAX_HISTORY_ITEMS = 365;

function normalizeText(value: unknown, fallback: NotebookContentText): NotebookContentText {
  const candidate = value && typeof value === 'object' ? value as Partial<NotebookContentText> : {};
  return LOCALES.reduce((result, locale) => {
    const text = candidate[locale];
    result[locale] = typeof text === 'string' && text.trim() ? text.trim() : fallback[locale];
    return result;
  }, {} as NotebookContentText);
}

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeOptionalString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeHistory(value: unknown): NotebookContentHistoryItem[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  return value
    .flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const candidate = item as Partial<NotebookContentHistoryItem>;
      const date = typeof candidate.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(candidate.date)
        ? candidate.date
        : '';
      if (!date) return [];

      const todayDocumentId = normalizeString(candidate.todayDocumentId, `today-${date}`);
      const key = `${date}:${todayDocumentId}`;
      if (seen.has(key)) return [];
      seen.add(key);

      return [{
        date,
        todayDocumentId,
        title: normalizeText(candidate.title, DEFAULT_NOTEBOOK_CONTENT_CONFIG.today.title),
        excerpt: normalizeText(candidate.excerpt, DEFAULT_NOTEBOOK_CONTENT_CONFIG.intro.note),
      }];
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_HISTORY_ITEMS);
}

export function parseNotebookContentConfig(value: string | null | undefined): NotebookContentConfigV1 {
  if (!value) return structuredClone(DEFAULT_NOTEBOOK_CONTENT_CONFIG);

  try {
    const parsed = JSON.parse(value) as Partial<NotebookContentConfigV1>;
    const fallback = DEFAULT_NOTEBOOK_CONTENT_CONFIG;
    return {
      version: 1,
      date: /^\d{4}-\d{2}-\d{2}$/.test(parsed.date || '') ? parsed.date! : fallback.date,
      intro: {
        eyebrow: normalizeText(parsed.intro?.eyebrow, fallback.intro.eyebrow),
        statement: normalizeText(parsed.intro?.statement, fallback.intro.statement),
        note: normalizeText(parsed.intro?.note, fallback.intro.note),
      },
      today: {
        eyebrow: normalizeText(parsed.today?.eyebrow, fallback.today.eyebrow),
        title: normalizeText(parsed.today?.title, fallback.today.title),
        subtitle: normalizeText(parsed.today?.subtitle, fallback.today.subtitle),
      },
      person: {
        name: normalizeString(parsed.person?.name, fallback.person.name),
        summary: normalizeText(parsed.person?.summary, fallback.person.summary),
      },
      featuredProductSlug: normalizeString(parsed.featuredProductSlug, fallback.featuredProductSlug),
      featuredProductImageUrl: normalizeOptionalString(parsed.featuredProductImageUrl, fallback.featuredProductImageUrl),
      question: {
        title: normalizeText(parsed.question?.title, fallback.question.title),
        summary: normalizeText(parsed.question?.summary, fallback.question.summary),
        question: normalizeText(parsed.question?.question, fallback.question.question),
        answerTeaser: normalizeText(parsed.question?.answerTeaser, fallback.question.answerTeaser),
      },
      scene: {
        imageUrl: normalizeString(parsed.scene?.imageUrl, fallback.scene.imageUrl),
        alt: normalizeText(parsed.scene?.alt, fallback.scene.alt),
      },
      history: normalizeHistory(parsed.history),
    };
  } catch {
    return structuredClone(DEFAULT_NOTEBOOK_CONTENT_CONFIG);
  }
}

function productImageUrl(product: CMSProduct | null, override: string): string {
  if (override) return override;
  if (!product?.image) return DEFAULT_NOTEBOOK_CONTENT_CONFIG.featuredProductImageUrl;
  return product.image.startsWith('http') ? product.image : getPublicImageUrl(`products/${product.image}`);
}

function productTitle(product: CMSProduct | null): NotebookLocalizedText {
  if (!product) {
    return {
      en: 'Almond Croissant',
      th: 'อัลมอนด์ครัวซองต์',
      zh: '杏仁可颂',
    };
  }
  return {
    en: product.name_en,
    th: product.name_th || product.name_en,
    zh: product.name_zh || product.name_en,
  };
}

function productSummary(product: CMSProduct | null): NotebookLocalizedText {
  if (!product) {
    return {
      en: 'A flaky croissant filled and finished with almond — one of Emma’s favourites.',
      th: 'ครัวซองต์ชั้นบางกรอบพร้อมอัลมอนด์ ทั้งไส้และด้านบน — หนึ่งในเมนูโปรดของ Emma',
      zh: '层层酥脆、内外都有杏仁风味的可颂——也是 Emma 最喜欢的点心之一。',
    };
  }
  return {
    en: product.desc_en || product.name_en,
    th: product.desc_th || product.desc_en || product.name_th || product.name_en,
    zh: product.desc_zh || product.desc_en || product.name_zh || product.name_en,
  };
}

function favouriteBody(personName: string, title: NotebookLocalizedText): NotebookLocalizedText {
  return {
    en: `${personName}’s favourite is ${title.en}.`,
    th: `เมนูโปรดของ ${personName} คือ${title.th}`,
    zh: `${personName} 最喜欢的是${title.zh}。`,
  };
}

function archiveCurrentPage(config: NotebookContentConfigV1): NotebookContentHistoryItem {
  return {
    date: config.date,
    todayDocumentId: `today-${config.date}`,
    title: structuredClone(config.today.title),
    excerpt: structuredClone(config.intro.note),
  };
}

function historyForSave(
  previous: NotebookContentConfigV1,
  next: NotebookContentConfigV1,
): NotebookContentHistoryItem[] {
  const candidates = [...previous.history];
  if (previous.date !== next.date) {
    candidates.unshift(archiveCurrentPage(previous));
  }

  return normalizeHistory(candidates)
    .filter((item) => item.date !== next.date && item.todayDocumentId !== `today-${next.date}`)
    .slice(0, MAX_HISTORY_ITEMS);
}

export function buildNotebookBundle(
  config: NotebookContentConfigV1,
  product: CMSProduct | null = null,
): NotebookFixtureBundle {
  const productName = productTitle(product);
  const productDescription = productSummary(product);
  const productSlug = product?.slug || config.featuredProductSlug;
  const personTitle: NotebookLocalizedText = {
    en: config.person.name,
    th: config.person.name,
    zh: config.person.name,
  };
  const favourite = favouriteBody(config.person.name, productName);

  return assertValidNotebookFixtureBundle({
    schemaVersion: 1,
    site: {
      siteId: 'joko-today',
      siteKey: 'joko-today',
      supportedLocales: ['en', 'th', 'zh'],
      defaultLocale: 'en',
    },
    entries: [
      {
        id: 'person-featured',
        kind: 'person',
        slug: 'featured-person',
        status: 'published',
        title: personTitle,
        summary: config.person.summary,
        subjectRef: { domain: 'community-person', id: 'featured-person' },
        favoriteProductRef: { kind: 'product', id: 'product-featured' },
      },
      {
        id: 'product-featured',
        kind: 'product',
        slug: productSlug,
        status: 'published',
        title: productName,
        summary: productDescription,
        editorialProductRef: `joko-today:${productSlug}`,
        note: favourite,
      },
      {
        id: 'question-featured',
        kind: 'question',
        slug: 'today-question',
        status: 'published',
        title: config.question.title,
        summary: config.question.summary,
        question: config.question.question,
        answerTeaser: config.question.answerTeaser,
      },
    ],
    today: {
      schemaVersion: 1,
      id: `today-${config.date}`,
      siteId: 'joko-today',
      date: config.date,
      title: config.today.title,
      subtitle: config.today.subtitle,
      featuredEntryRefs: [
        { kind: 'person', id: 'person-featured' },
        { kind: 'product', id: 'product-featured' },
        { kind: 'question', id: 'question-featured' },
      ],
      surfaces: [
        {
          id: 'today-observation',
          blocks: [
            {
              id: 'today-heading',
              type: 'text',
              eyebrow: config.today.eyebrow,
              heading: config.today.title,
              body: config.today.subtitle,
            },
            {
              id: 'today-scene',
              type: 'asset',
              asset: { id: 'today-scene', intent: 'illustration' },
              alt: config.scene.alt,
            },
          ],
        },
        {
          id: 'today-discovery',
          blocks: [
            {
              id: 'today-favourite',
              type: 'callout',
              heading: {
                en: 'A small favourite',
                th: 'ของโปรดเล็ก ๆ',
                zh: '一个小小的最爱',
              },
              body: favourite,
              relatedEntryRef: { kind: 'product', id: 'product-featured' },
            },
            {
              id: 'today-question',
              type: 'entry-link',
              entryRef: { kind: 'question', id: 'question-featured' },
              label: {
                en: 'A curiosity to take with you',
                th: 'ความสงสัยเล็ก ๆ ที่อยากชวนคิดต่อ',
                zh: '带走一个小小的好奇',
              },
              note: config.question.question,
            },
          ],
        },
      ],
    },
    history: config.history,
  });
}

export function getDefaultResolvedNotebookContent(): ResolvedNotebookContent {
  const config = structuredClone(DEFAULT_NOTEBOOK_CONTENT_CONFIG);
  return {
    config,
    bundle: buildNotebookBundle(config),
    assetUrls: { 'today-scene': config.scene.imageUrl },
    featuredProductImageUrl: config.featuredProductImageUrl,
    commerceProduct: null,
  };
}

export async function getNotebookContent(): Promise<ResolvedNotebookContent> {
  let config = structuredClone(DEFAULT_NOTEBOOK_CONTENT_CONFIG);
  try {
    const setting = await getSetting(NOTEBOOK_CONTENT_CONFIG_KEY);
    config = parseNotebookContentConfig(setting?.value);
  } catch (error) {
    console.error('Could not load Notebook content configuration:', error);
  }

  let product: CMSProduct | null = null;
  try {
    product = await getProductBySlug(config.featuredProductSlug);
  } catch (error) {
    console.error('Could not resolve Notebook featured product:', error);
  }

  return {
    config,
    bundle: buildNotebookBundle(config, product),
    assetUrls: { 'today-scene': config.scene.imageUrl },
    featuredProductImageUrl: productImageUrl(product, config.featuredProductImageUrl),
    commerceProduct: product,
  };
}

export async function saveNotebookContentConfig(
  config: NotebookContentConfigV1,
): Promise<NotebookContentConfigV1> {
  const normalized = parseNotebookContentConfig(JSON.stringify(config));

  let previous = structuredClone(DEFAULT_NOTEBOOK_CONTENT_CONFIG);
  try {
    const currentSetting = await getSetting(NOTEBOOK_CONTENT_CONFIG_KEY);
    previous = parseNotebookContentConfig(currentSetting?.value);
  } catch (error) {
    console.error('Could not load prior Notebook content before save:', error);
    throw new Error('Could not safely preserve Notebook history. Refresh and try again.');
  }

  const next: NotebookContentConfigV1 = {
    ...normalized,
    history: historyForSave(previous, normalized),
  };
  buildNotebookBundle(next);

  const { error } = await supabase
    .from('cms_settings')
    .upsert(
      {
        setting_key: NOTEBOOK_CONTENT_CONFIG_KEY,
        value: JSON.stringify(next),
      },
      { onConflict: 'setting_key' },
    );

  if (error) throw error;
  return next;
}
