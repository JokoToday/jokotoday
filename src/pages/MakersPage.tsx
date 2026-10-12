import { useEffect, useState } from "react";
import { getMakers, type Maker } from "../lib/makersService";
import { getProducts, type CMSProduct } from "../lib/cmsService";
import { useLanguage } from "../context/LanguageContext";
import { MakerCard } from "../components/MakerCard";
import { MakerProfile } from "../components/MakerProfile";

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
  return (
    <div className="joko-mineral-field px-4 py-10 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-6xl">
        {loading ? (
          <p role="status">{labels.loading}</p>
        ) : error ? (
          <p role="alert">{labels.error}</p>
        ) : slug ? (
          maker ? (
            <MakerProfile maker={maker} products={products} />
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
