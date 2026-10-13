import { useLanguage } from '../../context/LanguageContext';

export function SpecialsPrice({ regular, special, money }: { regular: number; special: number; money: (value: number) => string }) {
  const { language } = useLanguage();
  const labels = language === 'th' ? ['ราคาปกติ', 'ราคาพิเศษ'] : language === 'zh' ? ['原价', '特价'] : ['Regular price', 'Specials price'];
  return <div className="my-4 flex flex-wrap items-baseline gap-x-4 gap-y-2">
    {regular > special && <span className="relative inline-block text-lg text-[#303532]/70" aria-label={`${labels[0]}: ${money(regular)}`}>
      <span>{money(regular)}</span>
      <svg aria-hidden="true" viewBox="0 0 100 20" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-[-4%] top-1/2 h-4 w-[108%] -translate-y-1/2 -rotate-[7deg] overflow-visible">
        <path d="M2 12 Q24 8 47 10 T98 7" fill="none" stroke="#B83A32" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M5 15 Q43 11 94 10" fill="none" stroke="#B83A32" strokeWidth="1" strokeLinecap="round" opacity="0.55" />
      </svg>
    </span>}
    <strong aria-label={`${labels[1]}: ${money(special)}`} className="inline-block -rotate-2 text-3xl leading-tight text-[#B83A32]" style={{ fontFamily: '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive' }}>{money(special)}</strong>
  </div>;
}
