import { ArrowLeft, ArrowRight, Heart, MapPin } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useJokoFounderPortrait } from '../app/joko-today/home/useJokoFounderPortrait';
import { Container } from '../platform/design-system';

interface MeetFoundersPageProps {
  onNavigate: (page: string) => void;
}

const copy = {
  en: {
    eyebrow: 'The people behind JOKO',
    title: 'Meet Joe & Phuttan',
    intro: 'Two people, one bakery, and a rather unexpected route from handmade chocolates to croissants.',
    caption: 'Joe & Phuttan — the people behind JOKO TODAY.',
    sections: [
      {
        title: 'It started with chocolate',
        text: 'Before JOKO was a bakery, Joe and Phuttan were making chocolate pralines because they enjoyed it. Friends asked for more. Then more people asked. A hobby quietly became a business.',
      },
      {
        title: 'Then someone mentioned croissants',
        text: 'A hotel asked whether they could make croissants. The answer was an enthusiastic yes, although neither had made one before. A second-hand dough sheeter and many test batches later, they had their first hotel order.',
      },
      {
        title: 'JOKO today',
        text: 'After wholesale orders and busy weekends at Jing Jai Market, Joe and Phuttan built the bakery in their garden in Mae Rim. They still bake in small batches, with preorder pickups designed to make sure customers get what they came for.',
      },
    ],
    note: 'We are better at making things than drawing up grand master plans. That has been the story of JOKO so far.',
    story: 'Read our whole story',
    bakery: 'Explore the baked goodies',
    back: 'Back to JOKO',
  },
  th: {
    eyebrow: 'ผู้อยู่เบื้องหลัง JOKO',
    title: 'รู้จัก Joe และ Phuttan',
    intro: 'คนสองคน เบเกอรี่หนึ่งแห่ง และเส้นทางที่ไม่คาดคิดจากช็อกโกแลตทำมือมาสู่ครัวซองต์',
    caption: 'Joe และ Phuttan — ผู้อยู่เบื้องหลัง JOKO TODAY',
    sections: [
      { title: 'เริ่มจากช็อกโกแลต', text: 'ก่อน JOKO จะเป็นเบเกอรี่ Joe และ Phuttan ทำช็อกโกแลตพราลีนเพราะชอบทำ เพื่อน ๆ อยากได้เพิ่ม แล้วก็มีคนสั่งเพิ่มเรื่อย ๆ งานอดิเรกจึงค่อย ๆ กลายเป็นธุรกิจ' },
      { title: 'แล้วก็มีคนถามถึงครัวซองต์', text: 'โรงแรมแห่งหนึ่งถามว่าทำครัวซองต์ได้ไหม ทั้งสองตอบว่าได้ ทั้งที่ยังไม่เคยทำมาก่อนเลย เครื่องรีดแป้งมือสองและการทดลองหลายต่อหลายครั้งต่อมา ก็นำมาสู่ออเดอร์แรกจากโรงแรม' },
      { title: 'JOKO ในวันนี้', text: 'หลังจากทำส่งลูกค้าขายส่งและออกตลาดจริงใจ Joe และ Phuttan สร้างเบเกอรี่ในสวนที่แม่ริม ทุกวันนี้ยังอบเป็นล็อตเล็ก ๆ และมีระบบสั่งล่วงหน้าเพื่อให้ลูกค้าได้สินค้าที่ตั้งใจมารับ' },
    ],
    note: 'เราถนัดทำของอร่อยมากกว่าวางแผนใหญ่โต และนี่ก็เป็นเส้นทางของ JOKO จนถึงวันนี้',
    story: 'อ่านเรื่องราวฉบับเต็ม',
    bakery: 'เลือกดูขนมอบ',
    back: 'กลับไป JOKO',
  },
  zh: {
    eyebrow: 'JOKO 背后的人',
    title: '认识 Joe 和 Phuttan',
    intro: '两个人、一间烘焙坊，以及从手工巧克力意外走向可颂的故事。',
    caption: 'Joe 和 Phuttan — JOKO TODAY 的创办人',
    sections: [
      { title: '先从巧克力开始', text: '在 JOKO 成为烘焙坊之前，Joe 和 Phuttan 因为喜欢而制作巧克力果仁糖。朋友们想要更多，订单渐渐增加，爱好就这样成为了生意。' },
      { title: '然后有人问起可颂', text: '一家酒店问他们会不会做可颂。他们爽快地回答会，尽管之前从未做过。靠着一台二手压面机和许多次尝试，最终拿到了酒店的第一笔订单。' },
      { title: '今天的 JOKO', text: '经历了批发订单和真心市集的周末摊位之后，两人在湄林的花园里建起了烘焙坊。现在依然坚持小批量烘焙，并提供预订取货，让顾客不再白跑一趟。' },
    ],
    note: '比起制定宏大的计划，我们更擅长动手做东西。JOKO 一直就是这样走到今天的。',
    story: '阅读完整故事',
    bakery: '浏览烘焙好物',
    back: '返回 JOKO',
  },
} as const;

export default function MeetFoundersPage({ onNavigate }: MeetFoundersPageProps) {
  const { language } = useLanguage();
  const text = copy[language === 'th' || language === 'zh' ? language : 'en'];
  const imageUrl = useJokoFounderPortrait();

  return (
    <div className="joko-paper-band min-h-[75vh] py-10 sm:py-16">
      <Container width="wide">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-[#3F665E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55766F]"
        >
          <ArrowLeft className="h-4 w-4" />{text.back}
        </button>
        <div className="mt-8 grid items-center gap-8 rounded-[2rem] border border-[#8B765E]/15 bg-[#FFF9EE]/80 p-6 shadow-[0_15px_40px_rgba(55,53,45,.05)] sm:p-10 lg:grid-cols-[1.15fr_.85fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#55766F]">{text.eyebrow}</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-.035em] text-[#303532] sm:text-5xl" style={{fontFamily:'var(--joko-font-display)'}}>{text.title}</h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-[#303532]/75">{text.intro}</p>
          </div>
          <figure className="flex min-h-48 flex-col items-center justify-center rounded-[1.75rem] border border-[#8B765E]/10 bg-[#F5EBD9]/60 p-5">
            {imageUrl ? (
              <img src={imageUrl} alt={text.caption} className="max-h-64 w-full object-contain" loading="lazy" />
            ) : (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Heart className="h-9 w-9 text-[#B65B28]" strokeWidth={1.2} />
                <span className="text-2xl font-semibold text-[#303532]" style={{fontFamily:'var(--joko-font-display)'}}>Joe &amp; Phuttan</span>
              </div>
            )}
            <figcaption className="mt-3 text-center text-xs text-[#303532]/65">{text.caption}</figcaption>
          </figure>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {text.sections.map((section, index) => (
            <article key={section.title} className="rounded-3xl border border-[#8B765E]/14 bg-[#FFFDF7]/75 p-6">
              <span className="text-xs font-semibold tracking-[.18em] text-[#B65B28]">0{index + 1}</span>
              <h2 className="mt-3 text-xl font-semibold text-[#303532]" style={{fontFamily:'var(--joko-font-display)'}}>{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[#303532]/75">{section.text}</p>
            </article>
          ))}
        </div>

        <div className="mt-7 rounded-3xl border border-[#55766F]/15 bg-[#D6E8E1]/65 px-6 py-6 sm:px-8">
          <p className="text-base italic leading-7 text-[#304B45]">{text.note}</p>
          <div className="mt-5 flex flex-wrap gap-5">
            <button type="button" onClick={() => onNavigate('our-story')} className="inline-flex items-center gap-2 text-sm font-semibold text-[#9D4B1E] hover:underline">{text.story}<ArrowRight className="h-4 w-4" /></button>
            <button type="button" onClick={() => onNavigate('products-bakery')} className="inline-flex items-center gap-2 text-sm font-semibold text-[#3F665E] hover:underline">{text.bakery}<MapPin className="h-4 w-4" /></button>
          </div>
        </div>
      </Container>
    </div>
  );
}
