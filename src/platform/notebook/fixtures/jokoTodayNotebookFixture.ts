import type { NotebookFixtureBundle } from '../contracts';
import { assertValidNotebookFixtureBundle } from '../validation';

const fixture = {
  schemaVersion: 1,
  site: {
    siteId: 'joko-today',
    siteKey: 'joko-today',
    supportedLocales: ['en', 'th', 'zh'],
    defaultLocale: 'en',
  },
  entries: [
    {
      id: 'person-emma',
      kind: 'person',
      slug: 'emma',
      status: 'published',
      title: {
        en: 'Emma',
        th: 'Emma',
        zh: 'Emma',
      },
      summary: {
        en: 'A curious walker who notices small things and has a soft spot for almond croissants.',
        th: 'นักเดินผู้ช่างสังเกตที่ชอบมองเห็นเรื่องเล็ก ๆ และชื่นชอบอัลมอนด์ครัวซองต์เป็นพิเศษ',
        zh: '一位喜欢留意细小事物的好奇漫步者，也格外喜欢杏仁可颂。',
      },
      subjectRef: {
        domain: 'character',
        id: 'emma',
      },
      portraitAsset: {
        id: 'emma-portrait-sketch',
        intent: 'sketch',
      },
      favoriteProductRef: {
        kind: 'product',
        id: 'product-almond-croissant',
      },
    },
    {
      id: 'product-almond-croissant',
      kind: 'product',
      slug: 'almond-croissant',
      status: 'published',
      title: {
        en: 'Almond Croissant',
        th: 'อัลมอนด์ครัวซองต์',
        zh: '杏仁可颂',
      },
      summary: {
        en: 'A flaky croissant filled and finished with almond — one of Emma’s favourites.',
        th: 'ครัวซองต์ชั้นบางกรอบพร้อมอัลมอนด์ ทั้งไส้และด้านบน — หนึ่งในเมนูโปรดของ Emma',
        zh: '层层酥脆、内外都有杏仁风味的可颂——也是 Emma 最喜欢的点心之一。',
      },
      editorialProductRef: 'joko-today:almond-croissant',
      heroAsset: {
        id: 'almond-croissant-photo',
        intent: 'photo',
      },
      note: {
        en: 'Emma’s favourite is Almond Croissant.',
        th: 'เมนูโปรดของ Emma คืออัลมอนด์ครัวซองต์',
        zh: 'Emma 最喜欢的是杏仁可颂。',
      },
    },
    {
      id: 'question-curiosity-001',
      kind: 'question',
      slug: 'curiosity',
      status: 'published',
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
      heroAsset: {
        id: 'croissant-layer-sketch',
        intent: 'sketch',
      },
    },
  ],
  today: {
    schemaVersion: 1,
    id: 'today-2026-09-06',
    siteId: 'joko-today',
    date: '2026-09-06',
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
    featuredEntryRefs: [
      { kind: 'person', id: 'person-emma' },
      { kind: 'product', id: 'product-almond-croissant' },
      { kind: 'question', id: 'question-curiosity-001' },
    ],
    surfaces: [
      {
        id: 'today-emma-observation',
        blocks: [
          {
            id: 'today-emma-heading',
            type: 'text',
            eyebrow: {
              en: 'TODAY’S PAGE',
              th: 'หน้าวันนี้',
              zh: '今日一页',
            },
            heading: {
              en: 'Emma’s note',
              th: 'บันทึกของ Emma',
              zh: 'Emma 的笔记',
            },
            body: {
              en: 'Sunday, Walking Street',
              th: 'วันอาทิตย์ · ถนนคนเดิน',
              zh: '星期日 · 步行街',
            },
          },
          {
            id: 'today-emma-walking-street-sketch',
            type: 'asset',
            asset: {
              id: 'emma-walking-street-sketch',
              intent: 'sketch',
            },
            alt: {
              en: 'Emma noticing a small flower at Sunday Walking Street.',
              th: 'Emma กำลังสังเกตดอกไม้เล็ก ๆ ที่ถนนคนเดินวันอาทิตย์',
              zh: 'Emma 在星期日步行街留意一朵小花。',
            },
          },
        ],
      },
      {
        id: 'today-emma-discovery',
        blocks: [
          {
            id: 'today-emma-favorite',
            type: 'callout',
            heading: {
              en: 'A small favourite',
              th: 'ของโปรดเล็ก ๆ',
              zh: '一个小小的最爱',
            },
            body: {
              en: 'Emma’s favourite is Almond Croissant.',
              th: 'เมนูโปรดของ Emma คืออัลมอนด์ครัวซองต์',
              zh: 'Emma 最喜欢的是杏仁可颂。',
            },
            relatedEntryRef: {
              kind: 'product',
              id: 'product-almond-croissant',
            },
            action: {
              label: {
                en: 'Open the Almond Croissant note',
                th: 'เปิดบันทึกอัลมอนด์ครัวซองต์',
                zh: '打开杏仁可颂笔记',
              },
              target: {
                type: 'notebook.product',
                slug: 'almond-croissant',
              },
            },
          },
          {
            id: 'today-emma-curiosity',
            type: 'entry-link',
            entryRef: {
              kind: 'question',
              id: 'question-curiosity-001',
            },
            label: {
              en: 'A curiosity to take with you',
              th: 'ความสงสัยเล็ก ๆ ที่อยากชวนคิดต่อ',
              zh: '带走一个小小的好奇',
            },
            note: {
              en: 'Why do some croissants feel crisp outside and airy inside?',
              th: 'ทำไมครัวซองต์บางชิ้นถึงกรอบด้านนอกแต่เบาโปร่งด้านใน?',
              zh: '为什么有些可颂外层酥脆，里面却轻盈蓬松？',
            },
          },
        ],
      },
    ],
  },
  history: [
    {
      date: '2026-09-06',
      todayDocumentId: 'today-2026-09-06',
      title: {
        en: 'Emma’s note',
        th: 'บันทึกของ Emma',
        zh: 'Emma 的笔记',
      },
      excerpt: {
        en: 'Sunday, Walking Street — a flower, an almond croissant and a small question.',
        th: 'วันอาทิตย์ที่ถนนคนเดิน — ดอกไม้หนึ่งดอก อัลมอนด์ครัวซองต์ และคำถามเล็ก ๆ หนึ่งข้อ',
        zh: '星期日的步行街——一朵花、一个杏仁可颂，还有一个小问题。',
      },
    },
  ],
} satisfies NotebookFixtureBundle;

export const jokoTodayNotebookFixture = assertValidNotebookFixtureBundle(fixture);
