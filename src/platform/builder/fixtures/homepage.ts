import type { BuilderDocument, BuilderSiteIdentity } from '../contracts';

export const jokoTodayFixtureSite: BuilderSiteIdentity = {
  siteId: 'fixture-joko-today',
  siteKey: 'joko-today',
  name: 'JOKO TODAY',
  supportedLocales: ['en', 'th', 'zh'],
  defaultLocale: 'en',
};

export const jokoTodayHomepageFixture: BuilderDocument = {
  schemaVersion: 1,
  registryVersion: 1,
  pageKey: 'home',
  sections: [
    {
      id: 'home-hero',
      type: 'home.hero.v1',
      version: 1,
      visible: true,
      props: {
        title: {
          en: 'Artisan Bakery in Chiang Mai',
          th: 'เบเกอรี่ช่างฝีมือในเชียงใหม่',
          zh: '清迈手工烘焙坊',
        },
        subtitle: {
          en: 'Freshly baked goods, made with love. Pre-order for weekend pickup.',
          th: 'ขนมปังและเบเกอรี่สดใหม่ ทำด้วยใจรัก สั่งจองล่วงหน้าสำหรับรับของสุดสัปดาห์',
          zh: '新鲜烘焙，用心制作。预订周末取货。',
        },
        primaryActionLabel: {
          en: 'Order Now',
          th: 'สั่งซื้อเลย',
          zh: '立即订购',
        },
        primaryAction: { type: 'commerce.openProducts' },
        secondaryActionLabel: {
          en: 'How It Works',
          th: 'วิธีการสั่งซื้อ',
          zh: '订购指南',
        },
        secondaryAction: { type: 'site.openHowItWorks' },
        mediaAlt: {
          en: 'JOKO Bakery',
          th: 'JOKO Bakery',
          zh: 'JOKO Bakery',
        },
      },
      design: {
        width: 'wide',
        spacing: 'none',
        layout: 'split-media-right',
      },
    },
    {
      id: 'home-top-liked',
      type: 'home.top-liked.v1',
      version: 1,
      visible: true,
      props: {
        title: {
          en: 'Most Loved Right Now',
          th: 'สินค้ายอดนิยมตอนนี้',
          zh: '当前最受喜爱',
        },
        subtitle: {
          en: 'Customer favorites from our community',
          th: 'เมนูโปรดของลูกค้าจากชุมชนของเรา',
          zh: '来自我们社区的顾客最爱',
        },
        browseLabel: {
          en: 'Browse All Products',
          th: 'ดูสินค้าทั้งหมด',
          zh: '浏览全部产品',
        },
        browseAction: { type: 'commerce.openProducts' },
      },
      design: {
        width: 'wide',
        spacing: 'spacious',
        variant: 'cards',
      },
    },
    {
      id: 'home-category-grid',
      type: 'home.category-grid.v1',
      version: 1,
      visible: true,
      props: {
        title: {
          en: 'What We Bake',
          th: 'สิ่งที่เราอบ',
          zh: '我们的烘焙',
        },
      },
      design: {
        width: 'wide',
        spacing: 'spacious',
        layout: 'responsive-catalogue',
      },
    },
    {
      id: 'home-cta',
      type: 'home.cta.v1',
      version: 1,
      visible: true,
      props: {
        title: {
          en: 'Ready to Pre-Order?',
          th: 'พร้อมสั่งพรีออเดอร์แล้วหรือยัง?',
          zh: '准备好预订了吗？',
        },
        body: {
          en: 'Fresh, handcrafted baked goods made with the finest ingredients.\nOrder today, pick up on your chosen day!',
          th: 'เบเกอรี่โฮมเมด อบสดใหม่เป็นรอบเล็ก ๆ ด้วยวัตถุดิบคุณภาพ\nสั่งวันนี้ รับในวันที่คุณเลือก',
          zh: '优质原料，小批量新鲜烘焙。\n今日下单，指定日期取货！',
        },
        actionLabel: {
          en: 'Browse Products',
          th: 'ดูสินค้า',
          zh: '浏览产品',
        },
        action: { type: 'commerce.openProducts' },
      },
      design: {
        width: 'wide',
        spacing: 'spacious',
        variant: 'brand-panel',
        alignment: 'center',
      },
    },
  ],
};
