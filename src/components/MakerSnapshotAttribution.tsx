import { useLanguage } from "../context/LanguageContext";

export function MakerSnapshotAttribution({
  item,
}: {
  item: {
    maker_name_en?: string | null;
    maker_name_th?: string | null;
    maker_name_zh?: string | null;
  };
}) {
  const { language } = useLanguage();
  const name = item[`maker_name_${language}`] || item.maker_name_en;
  return name ? (
    <span className="mt-1 block text-xs font-normal text-[#55766F]">
      {name}
    </span>
  ) : null;
}
