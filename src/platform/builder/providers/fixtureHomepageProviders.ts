import type {
  BuilderCategory,
  BuilderTopLikedProduct,
  HomepageBuilderProviders,
} from './types';

const fixtureCategories: BuilderCategory[] = [
  {
    id: 'croissants',
    slug: 'croissants',
    name: {
      en: 'Croissants & Pastries',
      th: 'ครัวซองและเพสทรี้',
      zh: '可颂与酥点',
    },
    description: {
      en: 'Buttery, flaky layers made with love and traditional techniques.',
      th: 'ชั้นเนยกรอบนอกนุ่มในทำด้วยใจรักและเทคนิคแบบดั้งเดิม',
      zh: '传统工艺，层层酥香，满满黄油香气。',
    },
    iconKey: 'croissants',
  },
  {
    id: 'breads',
    slug: 'breads',
    name: {
      en: 'Breads',
      th: 'ขนมปัง',
      zh: '面包',
    },
    description: {
      en: 'Artisan breads baked fresh with premium ingredients.',
      th: 'ขนมปังช่างฝีมืออบสดใหม่ด้วยวัตถุดิบคุณภาพเยี่ยม',
      zh: '优质原料，新鲜出炉的手工面包。',
    },
    iconKey: 'breads',
  },
  {
    id: 'cakes',
    slug: 'cakes',
    name: {
      en: 'Cakes & Cookies',
      th: 'เค้กและคุกกี้',
      zh: '蛋糕与饼干',
    },
    description: {
      en: 'Sweet treats perfect for celebrations or an afternoon delight.',
      th: 'ขนมหวานสำหรับช่วงเวลาแห่งการเฉลิมฉลองหรือของว่างยามบ่าย',
      zh: '庆祝时刻或午后茶点的甜蜜选择。',
    },
    iconKey: 'cakes',
  },
  {
    id: 'quiche',
    slug: 'quiche',
    name: {
      en: 'Quiche, Pizza & More',
      th: 'คีช พิซซ่า และอื่นๆ',
      zh: '法式咸派、披萨等',
    },
    description: {
      en: 'Savory options including buns, quiche, and artisan pizza.',
      th: 'เมนูคาว รวมถึงขนมปัง คีช และพิซซ่าช่างฝีมือ',
      zh: '包括各式面包、法式咸派和手工披萨。',
    },
    iconKey: 'quiche',
  },
];

const fixtureTopLikedProducts: BuilderTopLikedProduct[] = [
  {
    id: 'fixture-croissant',
    slug: 'fixture-croissant',
    name: {
      en: 'Fixture Croissant',
      th: 'ครัวซองตัวอย่าง',
      zh: '示例可颂',
    },
    imageSrc: '/JOKO.TODAY_logo.transparent.png',
    price: { amount: 95, currency: 'THB' },
    likeCount: 24,
  },
  {
    id: 'fixture-bread',
    slug: 'fixture-bread',
    name: {
      en: 'Fixture Bread',
      th: 'ขนมปังตัวอย่าง',
      zh: '示例面包',
    },
    imageSrc: '/JOKO.TODAY_logo.transparent.png',
    price: { amount: 120, currency: 'THB' },
    likeCount: 18,
  },
  {
    id: 'fixture-cookie',
    slug: 'fixture-cookie',
    name: {
      en: 'Fixture Cookie',
      th: 'คุกกี้ตัวอย่าง',
      zh: '示例饼干',
    },
    imageSrc: '/JOKO.TODAY_logo.transparent.png',
    price: { amount: 65, currency: 'THB' },
    likeCount: 11,
  },
];

export function createFixtureHomepageProviders(): HomepageBuilderProviders {
  return {
    heroMedia: {
      async getHeroMedia() {
        return { src: '/JOKO.TODAY_logo.transparent.png' };
      },
    },
    topLiked: {
      async getTopLikedProducts() {
        return fixtureTopLikedProducts;
      },
    },
    categories: {
      async getCategories() {
        return fixtureCategories;
      },
    },
  };
}
