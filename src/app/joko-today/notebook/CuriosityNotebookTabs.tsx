import { ArrowLeft, X } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import type {
  CuriosityLocalizedText,
  CuriosityNotebookCollection,
} from '../../../platform/curiosity';
import type { NotebookRouteTarget } from '../../../platform/notebook';

interface CuriosityNotebookTabsProps {
  collections: readonly CuriosityNotebookCollection[];
  target: NotebookRouteTarget;
  onNavigate: (target: NotebookRouteTarget) => void;
  onBack: () => void;
  onClose: () => void;
}

type LanguageCode = 'en' | 'th' | 'zh';

const copy = {
  en: { back: 'Back', close: 'Close for now', nav: 'Curiosity Notebook collections' },
  th: { back: 'ย้อนกลับ', close: 'ปิดไว้ก่อน', nav: 'หมวดของสมุดบันทึกความสงสัย' },
  zh: { back: '返回', close: '先合上', nav: '好奇笔记本分类' },
} as const;

const tabStyles = [
  'border-amber-200 bg-amber-100/90',
  'border-sky-200 bg-sky-100/85',
  'border-orange-200 bg-orange-100/85',
  'border-emerald-200 bg-emerald-100/80',
  'border-rose-200 bg-rose-100/85',
  'border-slate-300 bg-slate-100/90',
] as const;

function text(value: CuriosityLocalizedText, locale: string): string {
  return value[locale] ?? value.en ?? Object.values(value)[0] ?? '';
}

export function CuriosityNotebookTabs({
  collections,
  target,
  onNavigate,
  onBack,
  onClose,
}: CuriosityNotebookTabsProps) {
  const { language } = useLanguage();
  const lang: LanguageCode = language === 'th' || language === 'zh' ? language : 'en';
  const labels = copy[lang];
  const selected = target.type === 'notebook.collection' ? target.slug : null;
  const navRef = useRef<HTMLElement | null>(null);
  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const active = activeTabRef.current;
    if (!nav || !active) return;
    nav.scrollLeft = Math.max(0, active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2);
  }, [collections, selected]);

  return (
    <div className="relative z-40 mx-auto max-w-[68rem] px-2 sm:px-4">
      <div className="mb-2 flex items-center justify-between gap-3 px-1 text-sm font-semibold text-primary-950/70 sm:px-2 sm:text-base">
        <button type="button" onClick={onBack} className="inline-flex min-h-10 items-center gap-2 rounded-md px-2.5 transition hover:bg-primary-50 hover:text-primary-950 focus:outline-none focus:ring-2 focus:ring-primary-500">
          <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          {labels.back}
        </button>
        <button type="button" onClick={onClose} className="inline-flex min-h-10 items-center gap-2 rounded-md px-2.5 transition hover:bg-primary-50 hover:text-primary-950 focus:outline-none focus:ring-2 focus:ring-primary-500">
          {labels.close}
          <X className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
        </button>
      </div>

      <nav ref={navRef} aria-label={labels.nav} className="overflow-x-auto pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max items-end gap-1 px-1 sm:px-2">
          {collections.map((collection, index) => {
            const isActive = selected === collection.slug;
            const style = tabStyles[index % tabStyles.length];
            return (
              <button
                key={collection.id}
                ref={isActive ? activeTabRef : undefined}
                type="button"
                onClick={() => onNavigate({ type: 'notebook.collection', slug: collection.slug })}
                aria-current={isActive ? 'page' : undefined}
                className={`relative min-h-11 rounded-t-xl border px-3 pb-2.5 pt-2.5 text-xs font-semibold tracking-[0.02em] text-primary-950 shadow-sm transition sm:min-h-12 sm:px-4 sm:pb-3 sm:pt-3 sm:text-sm ${style} ${isActive ? '-mb-px translate-y-px border-b-transparent pb-3.5 pt-3 shadow-md sm:pb-4 sm:pt-3.5' : 'opacity-80 hover:-translate-y-0.5 hover:opacity-100'}`}
              >
                {text(collection.navLabel ?? collection.label, lang)}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default CuriosityNotebookTabs;
