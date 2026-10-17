import { useState } from 'react';
import { ChevronDown, Croissant, PlayCircle, ShoppingBasket, Store, Tag, Users } from 'lucide-react';
import { Container } from '../../../platform/design-system';

type Language = 'en' | 'th' | 'zh';
type ServiceKey = 'bakery' | 'store' | 'makers' | 'specials';
type Localized = Record<Language, string>;

const heading: Localized = { en: 'What You Can Do Here', th: 'ที่ JOKO ทำอะไรได้บ้าง', zh: '在 JOKO 可以做什么' };
const introduction: Localized = { en: 'Four ways to discover something good.', th: 'สี่วิธีค้นพบสิ่งดี ๆ', zh: '四种发现好东西的方式。' };
const howLabel: Localized = { en: 'How It Works', th: 'วิธีใช้งาน', zh: '如何使用' };
const services: { key: ServiceKey; name: Localized; description: Localized; explore: Localized; page: string; steps: Record<Language, readonly string[]> }[] = [
  { key: 'bakery', name: { en: 'JOKO Bakery', th: 'JOKO Bakery', zh: 'JOKO 烘焙坊' }, description: { en: 'Freshly made favourites, ready for your chosen pickup day.', th: 'ขนมอบสดใหม่ที่คุณเลือกวันรับได้', zh: '新鲜烘焙，按您选择的日期取货。' }, explore: { en: 'Explore Bakery', th: 'ดูเบเกอรี่', zh: '探索烘焙坊' }, page: 'products-bakery', steps: { en: ['Choose from our bakery menu.', 'Select an available pickup date, location and approximate time.', 'Order and pay, then collect on your chosen day.'], th: ['เลือกขนมจากเมนูเบเกอรี่', 'เลือกวัน สถานที่ และช่วงเวลารับสินค้า', 'สั่งซื้อ ชำระเงิน และมารับตามวันที่เลือก'], zh: ['从烘焙菜单选择商品。', '选择可用的取货日期、地点和大致时间。', '下单付款后，在选定日期取货。'] } },
  { key: 'store', name: { en: 'JOKO Store', th: 'JOKO Store', zh: 'JOKO 商店' }, description: { en: 'Ingredients, useful finds, and good things for the kitchen and beyond.', th: 'วัตถุดิบและของดี ๆ สำหรับครัวและชีวิตประจำวัน', zh: '烘焙食材、实用好物及更多精选。' }, explore: { en: 'Explore Store', th: 'ดูสินค้า', zh: '探索商店' }, page: 'products-non-bakery', steps: { en: ['Browse ingredients and curated goods.', 'Check each item’s available fulfillment options.', 'Choose the offered date or delivery/pickup option at checkout.'], th: ['เลือกวัตถุดิบและสินค้าที่คัดสรร', 'ตรวจสอบรูปแบบการรับสินค้าของแต่ละรายการ', 'เลือกวันรับหรือวิธีจัดส่งที่มีให้ในขั้นตอนชำระเงิน'], zh: ['浏览食材与精选商品。', '查看各商品可用的配送或取货方式。', '结账时选择可用日期和履约方式。'] } },
  { key: 'makers', name: { en: 'JOKO Makers', th: 'JOKO Makers', zh: 'JOKO 创作者' }, description: { en: 'Meet fellow makers and discover products we believe are worth sharing.', th: 'พบผู้ผลิตที่เราชื่นชอบและสินค้าที่อยากแบ่งปัน', zh: '认识我们欣赏的创作者，发现值得分享的商品。' }, explore: { en: 'Meet the Makers', th: 'พบผู้ผลิต', zh: '认识创作者' }, page: 'makers', steps: { en: ['Discover products from fellow makers.', 'Choose available items and review their pickup arrangements.', 'Order through JOKO and collect as confirmed.'], th: ['เลือกชมสินค้าจากผู้ผลิตที่ร่วมงานกับเรา', 'ตรวจสอบสินค้าและเงื่อนไขการรับ', 'สั่งผ่าน JOKO และรับสินค้าตามที่ยืนยัน'], zh: ['发现合作创作者的商品。', '查看可售商品与取货安排。', '通过 JOKO 下单并按确认安排取货。'] } },
  { key: 'specials', name: { en: 'JOKO Specials', th: 'JOKO Specials', zh: 'JOKO 特惠' }, description: { en: 'Good things at special prices, often available for pickup today.', th: 'ของดีราคาพิเศษ มักรับได้ภายในวันนี้', zh: '特别价格的好东西，通常可当天取货。' }, explore: { en: "See Specials", th: 'ดูสินค้าพิเศษ', zh: '查看特惠' }, page: 'specials', steps: { en: ['See what’s available today while stocks last.', 'Select a pickup option and pay immediately.', 'Collect during the specified same-day pickup window.'], th: ['ตรวจสอบข้อเสนอวันนี้ก่อนสินค้าหมด', 'เลือกการรับสินค้าและชำระทันที', 'รับสินค้าภายในช่วงเวลาที่กำหนดในวันเดียวกัน'], zh: ['查看当天限量特惠。', '选择取货选项并立即付款。', '在指定的当天取货时段领取。'] } },
];
const icons = { bakery: Croissant, store: Store, makers: Users, specials: Tag };

export function HomepageServices({ locale, onNavigate }: { locale: Language; onNavigate: (page: string) => void }) {
  const [expanded, setExpanded] = useState<ServiceKey | null>(null);
  return <section id="what-you-can-do" className="scroll-mt-24 border-y border-[#55766F]/12 bg-[#FCF8F1] py-14 sm:py-20" aria-labelledby="joko-services-title">
    <Container width="wide">
      <div className="mb-8 text-center sm:mb-10">
        <h2 id="joko-services-title" className="text-3xl font-semibold tracking-tight text-[#303532] sm:text-4xl" style={{ fontFamily: 'var(--joko-font-display)' }}>{heading[locale]}</h2>
        <p className="mt-2 text-[#4E5D55]">{introduction[locale]}</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {services.map((service) => {
          const Icon = icons[service.key];
          const isExpanded = expanded === service.key;
          return <article key={service.key} className="overflow-hidden rounded-2xl border border-[#7D796E]/20 bg-white/75 p-3 shadow-[0_8px_24px_rgba(48,53,50,.045)] sm:p-4">
            <div className="flex items-center gap-4 border-b border-[#7D796E]/15 pb-4">
              <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl border border-[#7D796E]/15 bg-[#EEE6DE] text-[#755E4B] sm:h-32 sm:w-32" aria-hidden="true"><Icon size={66} strokeWidth={1.05}/></div>
              <div className="min-w-0"><h3 className="text-lg font-semibold text-[#303532]">{service.name[locale]}</h3><p className="mt-1 text-sm leading-6 text-[#303532]/75">{service.description[locale]}</p></div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => onNavigate(service.page)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#E9E9E9] px-2 text-sm font-semibold text-[#262626] transition hover:bg-[#DADADA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55766F]"><ShoppingBasket className="h-4 w-4 shrink-0"/>{service.explore[locale]}</button>
              <button type="button" aria-expanded={isExpanded} aria-controls={`joko-service-guide-${service.key}`} onClick={() => setExpanded(isExpanded ? null : service.key)} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-lg border border-[#7D796E]/25 px-2 text-sm font-semibold text-[#262626] transition hover:bg-[#F1ECE4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55766F]"><PlayCircle className="h-4 w-4 shrink-0"/>{howLabel[locale]}<ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}/></button>
            </div>
            {isExpanded && <div id={`joko-service-guide-${service.key}`} className="mt-4 rounded-xl bg-[#F5F0E9] p-4"><ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-[#303532]">{service.steps[locale].map((step) => <li key={step}>{step}</li>)}</ol><p className="mt-3 text-xs text-[#56685E]">{locale === 'en' ? 'Short illustrated guide coming soon.' : locale === 'th' ? 'กำลังเตรียมคู่มือภาพประกอบสั้น ๆ' : '简短图解指南即将推出。'}</p></div>}
          </article>;
        })}
      </div>
    </Container>
  </section>;
}
