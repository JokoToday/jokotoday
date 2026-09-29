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
  branding: {
    logoScale: 120,
    typography: {
      displayFont: 'noto-sans',
      bodyFont: 'inter',
      thaiFont: 'noto-sans-thai-looped',
      chineseFont: 'noto-sans-sc',
      heroSize: 65,
      sectionHeadingSize: 36,
      bodySize: 16,
      navSize: 16,
      buttonSize: 16,
      labelSize: 11,
    },
    colors: {
      text: '#303532',
      accent: '#C76624',
      turquoise: '#DAEBE8',
    },
  },
  sections: [
    {
      id: 'home-hero',
      type: 'home.hero.v1',
      version: 1,
      visible: true,
      props: {
        logoUrl: '/assets/brand/joko-today-logo-v0.4.webp',
        title: {
          en: 'Good bread\nfor a brighter\ntomorrow.',
          th: 'ขนมปังดี ๆ\nเพื่อวันพรุ่งนี้\nที่สดใสกว่า',
          zh: '好面包\n为了一个更明亮的\n明天。',
        },
        subtitle: {
          en: 'Thoughtfully baked in small batches. Pre-order online and pick up fresh at our JOKO locations.',
          th: 'อบอย่างตั้งใจเป็นล็อตเล็ก ๆ สั่งล่วงหน้าออนไลน์ แล้วมารับของสดใหม่ได้ที่จุดรับของ JOKO',
          zh: '小批量用心烘焙。线上预订，到 JOKO 取货点领取新鲜出炉的面包。',
        },
        primaryActionLabel: {
          en: 'Explore the Bakery',
          th: 'สำรวจเบเกอรี่',
          zh: '探索烘焙坊',
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
          en: 'What’s Baking This Week at JOKO',
          th: 'สัปดาห์นี้ JOKO อบอะไรบ้าง',
          zh: 'JOKO 本周在烤什么',
        },
        subtitle: {
          en: 'Freshly baked. Limited quantities. Pre-order to reserve.',
          th: 'อบสด จำนวนจำกัด สั่งล่วงหน้าเพื่อจองไว้',
          zh: '新鲜烘焙，数量有限。提前预订即可保留。',
        },
        browseLabel: {
          en: 'See all bakery products',
          th: 'ดูผลิตภัณฑ์เบเกอรี่ทั้งหมด',
          zh: '查看全部烘焙产品',
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
      visible: false,
      props: {
        title: {
          en: 'Bakery Categories',
          th: 'หมวดหมู่เบเกอรี่',
          zh: '烘焙分类',
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
          en: 'Good bread. A kinder day.',
          th: 'ขนมปังดี ๆ วันที่อ่อนโยนกว่า',
          zh: '好面包，更温柔的一天。',
        },
        body: {
          en: 'Small-batch baking, thoughtful pickup and a bakery made for everyday rituals.',
          th: 'เบเกอรี่ล็อตเล็ก การรับของที่เรียบง่าย และขนมสำหรับช่วงเวลาดี ๆ ในทุกวัน',
          zh: '小批量烘焙、贴心取货，把面包变成日常里温柔的小仪式。',
        },
        actionLabel: {
          en: 'Explore the Bakery',
          th: 'สำรวจเบเกอรี่',
          zh: '探索烘焙坊',
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
