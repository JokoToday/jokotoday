import { useEffect, useState } from "react";
import { AuthModal } from "./AuthModal";
import { getPickupV2CustomerEnabled } from "../lib/pickupV2Rollout";
import ProductCard from "./ProductCard";
import { getCustomerPickupAvailabilityV2, type PickupAvailabilityRow } from "../lib/pickupAvailabilityV2";
import type { Maker } from "../lib/makersService";
import { makerText } from "../lib/makersService";
import type { CMSProduct } from "../lib/cmsService";
import { useLanguage } from "../context/LanguageContext";
import { AccountFavoriteHeart } from './AccountFavoriteHeart';
import { SourcingDisclosure } from "./MakerAttribution";

export function MakerProfile({
  maker,
  products,
  preview = false,
  previewLanguage,
}: {
  maker: Maker;
  products: CMSProduct[];
  preview?: boolean;
  previewLanguage?: "en" | "th" | "zh";
}) {
  const { language: currentLanguage } = useLanguage();
  const language = previewLanguage || currentLanguage;
  const labels = {
    en: {
      back: "Creator Circle",
      picked: "What we picked",
      note: "Why JOKO picked them",
      products: "Selected products are coming soon.",
    },
    th: {
      back: "ผู้ผลิตทั้งหมด",
      picked: "สิ่งที่เราเลือก",
      note: "เหตุผลที่ JOKO เลือก",
      products: "สินค้าที่คัดเลือกกำลังจะมา",
    },
    zh: {
      back: "所有制作人",
      picked: "我们的精选",
      note: "JOKO 为什么选择他们",
      products: "精选商品即将上线。",
    },
  }[language];
  const favoriteControl = !preview ? <AccountFavoriteHeart type="creator" id={maker.id}/> : null;
  const selected = products.filter(
    (product) =>
      product.maker_id === maker.id && product.product_origin === "maker",
  );
  const productIds = selected.map((product) => product.id).sort().join(",");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [retry, setRetry] = useState(0);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [orderingEnabled, setOrderingEnabled] = useState(false);
  const [availability, setAvailability] = useState<{ key: string; rows: PickupAvailabilityRow[] } | null>(null);
  useEffect(() => {
    let active = true;
    if (preview || !productIds) return;
    setAvailability(null);
    setAvailabilityError(false);
    setOrderingEnabled(false);
    Promise.all([getCustomerPickupAvailabilityV2(productIds.split(",")), getPickupV2CustomerEnabled()])
      .then(([rows, enabled]) => { if (active) { setAvailability({ key: productIds, rows }); setOrderingEnabled(enabled); } })
      .catch(() => { if (active) setAvailabilityError(true); });
    return () => { active = false; };
  }, [preview, productIds, retry]);
  return (
    <>
      {!preview && (
        <a href="/makers" className="text-sm text-[#55766F] underline">
          ← {labels.back}
        </a>
      )}
      <article className="mt-6 overflow-hidden rounded-[2rem] border border-[#55766F]/20 bg-[#FFF9EE]">
        {maker.hero_image && (
          <img
            src={maker.hero_image}
            alt={makerText(maker, "name", language)}
            className="max-h-[30rem] w-full object-cover"
          />
        )}
        <div className="p-6 sm:p-10">
          <p className="text-sm text-[#55766F]">{maker.location}</p>
          <h1
            className="mt-3 text-4xl font-semibold sm:text-5xl"
            style={{ fontFamily: "var(--joko-font-display)" }}
          >
            {makerText(maker, "name", language)}
          </h1>
          <div className="mt-4">{favoriteControl}</div>
          <p className="mt-4 text-lg leading-8">
            {makerText(maker, "intro", language)}
          </p>
          <p className="mt-6 whitespace-pre-line leading-7 text-[#303532]/75">
            {makerText(maker, "story", language)}
          </p>
          {makerText(maker, "joko_note", language) && (
            <div className="mt-8 rounded-2xl bg-[#D5E8E2]/50 p-5">
              <h2 className="font-semibold">{labels.note}</h2>
              <p className="mt-2 whitespace-pre-line leading-7">
                {makerText(maker, "joko_note", language)}
              </p>
            </div>
          )}
          {maker.website_url && (
            <a
              href={maker.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-block text-sm underline"
            >
              {language === "th"
                ? "เว็บไซต์ผู้ผลิต"
                : language === "zh"
                  ? "制作人网站"
                  : "Creator website"}{" "}
              ↗
            </a>
          )}
        </div>
      </article>
      <h2
        className="mb-6 mt-12 text-3xl font-semibold"
        style={{ fontFamily: "var(--joko-font-display)" }}
      >
        {labels.picked}
      </h2>
      <div className="joko-products-grid grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6">
        {selected.map((product) => {
          const rows = availability?.key === productIds ? availability.rows.filter((row) => row.product_id === product.id) : [];
          const remaining = Math.max(0, ...rows.map((row) => row.remaining_quantity));
          return (
            <ProductCard
              key={product.id}
              product={{ ...product, maker }}
              preview={preview}
              previewLanguage={language}
              productHref={`/products/${encodeURIComponent(product.slug)}`}
              onLoginRequired={() => setShowAuthModal(true)}
              commerceUnavailableLabel={preview ? undefined : availabilityError
                ? language === "th" ? "ตรวจสอบวันรับสินค้าไม่ได้" : language === "zh" ? "无法查询取货日期" : "Pickup availability unavailable"
                : availability?.key !== productIds
                  ? language === "th" ? "กำลังตรวจสอบวันรับสินค้า…" : language === "zh" ? "正在查询取货日期…" : "Checking pickup availability…"
                  : !orderingEnabled ? language === "th" ? "ยังไม่เปิดรับคำสั่งซื้อ" : language === "zh" ? "暂未开放订购" : "Ordering is not open yet" : undefined}
              stockRemainingOverride={preview || availability?.key !== productIds || !orderingEnabled ? null : remaining}
              quantityLimitOverride={preview ? 0 : remaining}
              availabilityOverride={{ isAvailable: remaining > 0 && product.is_active, isSoldOut: remaining === 0, isNotOfferedToday: false, remainingStock: remaining }}
            />
          );
        })}
      </div>
      {!preview && availabilityError && <button type="button" className="mt-4 underline" onClick={() => setRetry((value) => value + 1)}>{language === "th" ? "ลองอีกครั้ง" : language === "zh" ? "重试" : "Try again"}</button>}
      {!preview && <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />}
      {!selected.length && <p>{labels.products}</p>}
      <SourcingDisclosure previewLanguage={language} />
    </>
  );
}
