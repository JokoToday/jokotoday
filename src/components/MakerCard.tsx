import type { Maker } from "../lib/makersService";
import { makerText } from "../lib/makersService";
import { useLanguage } from "../context/LanguageContext";

export function MakerCard({ maker }: { maker: Maker }) {
  const { language } = useLanguage();
  return (
    <a
      href={`/makers/${encodeURIComponent(maker.slug)}`}
      className="block overflow-hidden rounded-[2rem] border border-[#55766F]/20 bg-[#FFF9EE] transition hover:shadow-lg focus-visible:outline-2 focus-visible:outline-[#55766F]"
    >
      {maker.hero_image && (
        <img
          src={maker.hero_image}
          alt={makerText(maker, "name", language)}
          className="aspect-[2/1] w-full object-cover"
          loading="lazy"
        />
      )}
      <div className="p-6">
        <p className="text-xs text-[#55766F]">{maker.location}</p>
        <h2
          className="mt-2 text-2xl font-semibold text-[#303532]"
          style={{ fontFamily: "var(--joko-font-display)" }}
        >
          {makerText(maker, "name", language)}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#303532]/75">
          {makerText(maker, "intro", language)}
        </p>
        <span className="mt-4 inline-block text-sm text-[#A44F1D]">
          {language === "th"
            ? "รู้จักผู้ผลิต →"
            : language === "zh"
              ? "了解制作人 →"
              : "Meet the maker →"}
        </span>
      </div>
    </a>
  );
}
