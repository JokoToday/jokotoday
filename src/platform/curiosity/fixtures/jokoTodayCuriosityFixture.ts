import type { CuriosityFixtureBundle } from '../contracts';
import { assertValidCuriosityFixtureBundle } from '../validation';

const fixture = {
  schemaVersion: 1,
  site: {
    siteId: 'joko-today',
    siteKey: 'joko-today',
    supportedLocales: ['en', 'th', 'zh'],
    defaultLocale: 'en',
  },
  episodes: [
    {
      schemaVersion: 1,
      id: 'curiosity-croissant-texture',
      slug: 'why-are-croissants-crisp-outside-and-airy-inside',
      status: 'published',
      scope: 'shared',
      question: {
        en: 'Why are good croissants crisp outside and airy inside?',
        th: 'ทำไมครัวซองต์ที่ดีจึงกรอบด้านนอกแต่โปร่งเบาด้านใน?',
        zh: '为什么好的可颂外层酥脆，里面却轻盈蓬松？',
      },
      summary: {
        en: 'Layers, steam and careful fermentation create two very different textures in one pastry.',
        th: 'ชั้นแป้ง ไอน้ำ และการหมักอย่างเหมาะสมทำให้ขนมชิ้นเดียวมีสองเนื้อสัมผัสที่ต่างกัน',
        zh: '层次、蒸汽和恰当发酵，让一只可颂同时拥有两种不同口感。',
      },
      shortAnswer: {
        en: 'Thin dough-and-butter layers separate in the oven while steam expands the interior. Fermentation and baking then set that open structure while drying and browning the outside.',
        th: 'ชั้นแป้งและเนยบาง ๆ แยกตัวในเตาอบ ขณะที่ไอน้ำดันด้านในให้ขยาย การหมักและการอบช่วยตรึงโครงสร้างโปร่งนั้นไว้ พร้อมทำให้ด้านนอกแห้งและเป็นสีน้ำตาลกรอบ',
        zh: '薄薄的面团与黄油层在烘烤时分开，蒸汽撑开内部；发酵和烘烤固定这种开放结构，同时让外层干燥上色并变得酥脆。',
      },
      answerStatus: 'answered',
      origin: { type: 'jokomi' },
      topics: ['baking', 'croissants', 'lamination'],
      heroMedia: {
        id: 'croissant-layer-sketch',
        kind: 'sketch',
        alt: {
          en: 'A hand-drawn cross-section of a layered croissant.',
          th: 'ภาพสเก็ตช์ตัดขวางของครัวซองต์เป็นชั้น ๆ',
          zh: '层层可颂横切面的手绘草图。',
        },
      },
      publishedAt: '2026-09-14T00:00:00Z',
    },
    {
      schemaVersion: 1,
      id: 'curiosity-butter-layers',
      slug: 'why-does-butter-need-to-stay-cool-in-laminated-dough',
      status: 'published',
      scope: 'shared',
      question: {
        en: 'Why does butter need to stay cool in laminated dough?',
        th: 'ทำไมเนยจึงต้องเย็นอยู่เสมอเวลารีดแป้งลามิเนต?',
        zh: '为什么制作层压面团时黄油要保持低温？',
      },
      summary: {
        en: 'Temperature helps preserve distinct layers until the oven can turn them into lift.',
        th: 'อุณหภูมิช่วยรักษาชั้นแป้งและเนยให้แยกกันจนถึงเวลาที่เตาอบเปลี่ยนชั้นเหล่านั้นให้เกิดการพองตัว',
        zh: '合适温度能让面团与黄油保持分层，直到进入烤箱后转化成膨松结构。',
      },
      shortAnswer: {
        en: 'If butter becomes too soft, it can smear into the dough instead of remaining as separate sheets. Distinct layers help steam and expanding gases create lift.',
        th: 'ถ้าเนยนิ่มเกินไป เนยจะผสมเข้าไปในแป้งแทนที่จะคงเป็นแผ่นแยกกัน ชั้นที่ชัดเจนช่วยให้ไอน้ำและก๊าซที่ขยายตัวดันแป้งให้พองขึ้น',
        zh: '如果黄油过软，就会抹进面团而不是保持独立薄层。清晰的分层能让蒸汽和膨胀气体把面团撑起来。',
      },
      answerStatus: 'answered',
      origin: { type: 'editorial' },
      topics: ['baking', 'lamination', 'temperature'],
      publishedAt: '2026-09-14T00:00:00Z',
      related: [{ curiosityId: 'curiosity-croissant-texture', relation: 'background' }],
    },
    {
      schemaVersion: 1,
      id: 'curiosity-joko-ordering',
      slug: 'how-does-ordering-at-joko-work',
      status: 'published',
      scope: 'local',
      siteId: 'joko-today',
      question: {
        en: 'How does ordering at JOKO TODAY work?',
        th: 'การสั่งซื้อที่ JOKO TODAY ทำงานอย่างไร?',
        zh: '在 JOKO TODAY 要怎样预订？',
      },
      summary: {
        en: 'Choose what you want, pre-order before the cutoff, then collect it at your selected pickup time and place.',
        th: 'เลือกสิ่งที่ต้องการ สั่งล่วงหน้าก่อนเวลาปิดรับ แล้วมารับตามวัน เวลา และสถานที่ที่เลือก',
        zh: '选好想要的商品，在截止时间前预订，然后按所选时间和地点取货。',
      },
      shortAnswer: {
        en: 'Browse the available menu, choose an eligible pickup date and location, place your pre-order before the cutoff, and collect your order as scheduled.',
        th: 'ดูเมนูที่เปิดขาย เลือกวันและจุดรับที่ใช้ได้ สั่งล่วงหน้าก่อนเวลาปิดรับ แล้วมารับออเดอร์ตามที่นัดไว้',
        zh: '浏览当前菜单，选择可用的取货日期和地点，在截止时间前完成预订，并按约定领取订单。',
      },
      answerStatus: 'answered',
      origin: { type: 'system', externalRef: 'joko-today:ordering-flow' },
      topics: ['joko-today', 'ordering', 'pickup'],
      hostRefs: [
        { domain: 'page', id: 'how-it-works' },
        { domain: 'site', id: 'joko-today' },
      ],
      publishedAt: '2026-09-14T00:00:00Z',
    },
    {
      schemaVersion: 1,
      id: 'curiosity-flour-protein',
      slug: 'why-do-bakers-care-about-flour-protein',
      status: 'researching',
      scope: 'shared',
      question: {
        en: 'Why do bakers care about the protein in flour?',
        th: 'ทำไมคนทำขนมปังจึงสนใจปริมาณโปรตีนในแป้ง?',
        zh: '为什么烘焙师会在意面粉的蛋白质含量？',
      },
      summary: {
        en: 'Protein is one clue to how a flour may behave, but it is not the whole story.',
        th: 'โปรตีนเป็นหนึ่งในเบาะแสว่าแป้งจะทำงานอย่างไร แต่ไม่ใช่คำตอบทั้งหมด',
        zh: '蛋白质含量能提示面粉可能怎样表现，但它并不是全部答案。',
      },
      answerStatus: 'partial',
      origin: { type: 'jokomi' },
      topics: ['baking', 'flour', 'ingredients'],
    },
  ],
} satisfies CuriosityFixtureBundle;

export const jokoTodayCuriosityFixture = assertValidCuriosityFixtureBundle(fixture);
