import type { Maker } from "../lib/makersService";
import { makerText } from "../lib/makersService";
import type { CMSProduct } from "../lib/cmsService";
import { useLanguage } from "../context/LanguageContext";
import { SourcingDisclosure } from "./MakerAttribution";
import { getPublicImageUrl } from "../lib/storage";

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
      back: "All makers",
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
  const selected = products.filter(
    (product) =>
      product.maker_id === maker.id && product.product_origin === "maker",
  );
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
                  : "Maker website"}{" "}
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
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {selected.map((product) => (
          <a
            key={product.id}
            href={
              preview
                ? undefined
                : `/products/${encodeURIComponent(product.slug)}`
            }
            className="overflow-hidden rounded-3xl border border-[#55766F]/20 bg-[#FFF9EE]"
          >
            {product.image && (
              <img
                src={
                  product.image.startsWith("http")
                    ? product.image
                    : getPublicImageUrl(`products/${product.image}`)
                }
                alt=""
                loading="lazy"
                className="aspect-[4/3] w-full object-cover"
              />
            )}
            <div className="p-5">
              <h3 className="text-xl font-semibold">
                {product[`name_${language}`] || product.name_en}
              </h3>
              <p className="mt-2 text-[#A44F1D]">
                ฿{Number(product.price).toFixed(2)}
              </p>
              <p className="mt-2 text-sm">
                {preview
                  ? language === "th"
                    ? "ตัวอย่างสินค้า"
                    : language === "zh"
                      ? "商品预览"
                      : "Product preview"
                  : language === "th"
                    ? "ดูสินค้าและวันรับ →"
                    : language === "zh"
                      ? "查看商品和取货日期 →"
                      : "View product & pickup dates →"}
              </p>
            </div>
          </a>
        ))}
      </div>
      {!selected.length && <p>{labels.products}</p>}
      <SourcingDisclosure previewLanguage={language} />
    </>
  );
}
