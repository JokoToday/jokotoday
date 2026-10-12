import { useLanguage } from "../context/LanguageContext";
import type { MakerIdentity } from "../lib/makersService";

export function MakerAttribution({ maker }: { maker?: MakerIdentity | null }) {
  const { language } = useLanguage();
  if (!maker) return null;
  const name = maker[`name_${language}`] || maker.name_en;
  return (
    <a
      className="mt-1 block text-sm text-[#55766F] underline underline-offset-4"
      href={`/makers/${encodeURIComponent(maker.slug)}`}
      onClick={(event) => event.stopPropagation()}
    >
      {name}
    </a>
  );
}

export function SourcingDisclosure({
  previewLanguage,
}: { previewLanguage?: "en" | "th" | "zh" } = {}) {
  const { language: currentLanguage } = useLanguage();
  const language = previewLanguage || currentLanguage;
  const text = {
    en: "For Makers items only: JOKO purchases the products from independent makers or retail shops, sets its own selling prices and prepares your pickup. Your order is confirmed after payment is verified. If an item cannot be sourced, we will contact you and refund the affected item. Substitutions require your agreement.",
    th: "สำหรับสินค้า Makers เท่านั้น: JOKO จัดซื้อสินค้าจากผู้ผลิตหรือร้านค้าปลีก กำหนดราคาขายของเราเอง และเตรียมสินค้าให้คุณรับ คำสั่งซื้อจะยืนยันเมื่อชำระเงินได้รับการตรวจสอบแล้ว หากจัดหาสินค้าไม่ได้ เราจะติดต่อคุณและคืนเงินสำหรับสินค้านั้น การเปลี่ยนสินค้าอื่นต้องได้รับความยินยอมจากคุณ",
    zh: "仅适用于 Makers 商品：JOKO 从独立制作人或零售店采购商品，自行定价并准备取货。付款验证后订单即确认。如无法采购某件商品，我们会联系您并退还该商品的款项。替换商品须征得您的同意。",
  };
  return (
    <p className="my-4 rounded-2xl border border-[#55766F]/20 bg-[#FFF9EE] p-4 text-sm leading-6 text-[#304B45]">
      {text[language]}
    </p>
  );
}
