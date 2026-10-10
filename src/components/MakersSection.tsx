import { useEffect, useState } from "react";
import { getMakers, type Maker } from "../lib/makersService";
import { useLanguage } from "../context/LanguageContext";
import { MakerCard } from "./MakerCard";

export function MakersSection() {
  const [makers, setMakers] = useState<Maker[]>([]);
  const { language } = useLanguage();
  useEffect(() => {
    let active = true;
    getMakers()
      .then((rows) => {
        if (active)
          setMakers(rows.filter((row) => row.show_on_homepage).slice(0, 3));
      })
      .catch(() => {
        /* Older deployments can keep rendering the rest of the homepage. */
      });
    return () => {
      active = false;
    };
  }, []);
  if (!makers.length) return null;
  return (
    <section
      id="makers"
      className="joko-paper-band px-4 py-12 sm:px-6 sm:py-16"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[.2em] text-[#55766F]">
              {language === "th" ? "คัดเลือกโดย JOKO" : language === "zh" ? "由 JOKO 精选" : "Selected by JOKO"}
            </p>
            <h2
              className="mt-2 text-4xl font-semibold text-[#303532]"
              style={{ fontFamily: "var(--joko-font-display)" }}
            >
              JOKO Makers
            </h2>
            <p className="mt-3 text-[#303532]/70">
              {language === "th"
                ? "ค้นพบผู้ผลิตและสิ่งดี ๆ ที่เราเลือกมาให้"
                : language === "zh"
                  ? "发现我们精选的制作人与好物。"
                  : "Meet the people behind the good things we selected."}
            </p>
          </div>
          <a
            href="/makers"
            className="text-sm text-[#A44F1D] underline underline-offset-4"
          >
            {language === "th"
              ? "ดูผู้ผลิตทั้งหมด"
              : language === "zh"
                ? "查看所有制作人"
                : "Explore all makers"}
          </a>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {makers.map((maker) => (
            <MakerCard key={maker.id} maker={maker} />
          ))}
        </div>
      </div>
    </section>
  );
}
