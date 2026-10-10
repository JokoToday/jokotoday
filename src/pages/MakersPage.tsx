import { useEffect, useState } from "react";
import { getMakers, makerText, type Maker } from "../lib/makersService";
import { getProducts, type CMSProduct } from "../lib/cmsService";
import { useLanguage } from "../context/LanguageContext";
import { MakerCard } from "../components/MakerCard";
import { SourcingDisclosure } from "../components/MakerAttribution";
import { getPublicImageUrl } from "../lib/storage";

export default function MakersPage({ slug }: { slug?: string | null }) {
  const [makers, setMakers] = useState<Maker[]>([]);
  const [products, setProducts] = useState<CMSProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { language } = useLanguage();
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    Promise.all([getMakers(), slug ? getProducts() : Promise.resolve([])])
      .then(([rows, catalogue]) => {
        if (active) {
          setMakers(rows);
          setProducts(catalogue);
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);
  const labels = {
    en: {
      intro: "People making good things. Selected by JOKO.",
      loading: "Loading makers…",
      error: "Makers could not be loaded. Please try again.",
      empty: "Our first maker stories are coming soon.",
      missing: "This maker is not currently published.",
      picked: "What we picked",
      note: "Why JOKO picked them",
      back: "All makers",
      products: "Selected products are coming soon.",
    },
    th: {
      intro: "ผู้ผลิตสิ่งดี ๆ ที่ JOKO คัดเลือก",
      loading: "กำลังโหลด…",
      error: "โหลดข้อมูลไม่ได้ โปรดลองอีกครั้ง",
      empty: "เรื่องราวผู้ผลิตรายแรกกำลังจะมา",
      missing: "ยังไม่มีหน้าเผยแพร่สำหรับผู้ผลิตนี้",
      picked: "สิ่งที่เราเลือก",
      note: "เหตุผลที่ JOKO เลือก",
      back: "ผู้ผลิตทั้งหมด",
      products: "สินค้าที่คัดเลือกกำลังจะมา",
    },
    zh: {
      intro: "用心制作好物的人。由 JOKO 精选。",
      loading: "加载中…",
      error: "无法加载，请重试。",
      empty: "首批制作人故事即将上线。",
      missing: "该制作人尚未发布。",
      picked: "我们的精选",
      note: "JOKO 为什么选择他们",
      back: "所有制作人",
      products: "精选商品即将上线。",
    },
  }[language];
  const maker = slug ? makers.find((row) => row.slug === slug) : null;
  const selected = products.filter(
    (product) =>
      product.maker_id === maker?.id && product.product_origin === "maker",
  );
  return (
    <div className="joko-mineral-field px-4 py-10 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-6xl">
        {loading ? (
          <p role="status">{labels.loading}</p>
        ) : error ? (
          <p role="alert">{labels.error}</p>
        ) : slug ? (
          maker ? (
            <>
              <a href="/makers" className="text-sm text-[#55766F] underline">
                ← {labels.back}
              </a>
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
                    href={`/products/${encodeURIComponent(product.slug)}`}
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
                        {language === "th"
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
              <SourcingDisclosure />
            </>
          ) : (
            <h1 className="text-2xl">{labels.missing}</h1>
          )
        ) : (
          <>
            <h1
              className="text-4xl font-semibold sm:text-5xl"
              style={{ fontFamily: "var(--joko-font-display)" }}
            >
              JOKO Makers
            </h1>
            <p className="mb-8 mt-4 text-lg text-[#303532]/70">
              {labels.intro}
            </p>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {makers.map((row) => (
                <MakerCard key={row.id} maker={row} />
              ))}
            </div>
            {!makers.length && <p>{labels.empty}</p>}
          </>
        )}
      </div>
    </div>
  );
}
