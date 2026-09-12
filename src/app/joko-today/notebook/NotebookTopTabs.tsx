import { ArrowLeft, X } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import type { NotebookIndexKind, NotebookRouteTarget } from '../../../platform/notebook';

interface NotebookTopTabsProps {
  target: NotebookRouteTarget;
  onNavigate: (target: NotebookRouteTarget) => void;
  onBack: () => void;
  onClose: () => void;
}

type LanguageCode = 'en' | 'th' | 'zh';
type TabKey = 'today' | NotebookIndexKind | 'history';

const copy = {
  en: { back: 'Back', close: 'Close for now', today: 'Today', people: 'People', curiosities: 'Curiosities', places: 'Places', products: 'Products', history: 'History' },
  th: { back: 'ย้อนกลับ', close: 'ปิดไว้ก่อน', today: 'วันนี้', people: 'ผู้คน', curiosities: 'ความสงสัย', places: 'สถานที่', products: 'สินค้า', history: 'ย้อนหลัง' },
  zh: { back: '返回', close: '先合上', today: '今日', people: '人物', curiosities: '好奇', places: '地点', products: '产品', history: '往期' },
} as const;

const tabStyles: Record<TabKey, string> = {
  today: 'border-amber-200 bg-amber-100/90',
  people: 'border-rose-200 bg-rose-100/85',
  curiosities: 'border-sky-200 bg-sky-100/85',
  places: 'border-emerald-200 bg-emerald-100/80',
  products: 'border-orange-200 bg-orange-100/85',
  history: 'border-slate-300 bg-slate-100/90',
};
function activeTab(target: NotebookRouteTarget): TabKey {
  if (target.type === 'notebook.today') return 'today';
  if (target.type === 'notebook.history') return 'history';
  if (target.type === 'notebook.person') return 'people';
  if (target.type === 'notebook.product') return 'products';
  if (target.type === 'notebook.question') return 'curiosities';
  return target.index;
}

function targetForTab(tab: TabKey): NotebookRouteTarget {
  if (tab === 'today') return { type: 'notebook.today' };
  if (tab === 'history') return { type: 'notebook.history' };
  return { type: 'notebook.index', index: tab };
}

export function NotebookTopTabs({ target, onNavigate, onBack, onClose }: NotebookTopTabsProps) {
  const { language } = useLanguage();
  const lang: LanguageCode = language === 'th' || language === 'zh' ? language : 'en';
  const labels = copy[lang];
  const selected = activeTab(target);
  const tabs: TabKey[] = ['today', 'people', 'curiosities', 'places', 'products', 'history'];

  return (
    <div className="relative z-40 mx-auto max-w-[68rem] px-2 sm:px-4">
      <div className="mb-1 flex items-center justify-between px-1 text-xs font-semibold text-primary-950/65 sm:px-2">
        <button type="button" onClick={onBack} className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 transition hover:bg-primary-50 hover:text-primary-950 focus:outline-none focus:ring-2 focus:ring-primary-500">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {labels.back}
        </button>
        <button type="button" onClick={onClose} className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 transition hover:bg-primary-50 hover:text-primary-950 focus:outline-none focus:ring-2 focus:ring-primary-500">
          {labels.close}
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <nav aria-label="Notebook sections" className="overflow-x-auto pb-px">
        <div className="flex min-w-max items-end gap-1 px-1 sm:px-2">
          {tabs.map((tab) => {
            const isActive = selected === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onNavigate(targetForTab(tab))}
                aria-current={isActive ? 'page' : undefined}
                className={`relative min-h-10 rounded-t-xl border px-3.5 pb-2 pt-2 text-xs font-semibold tracking-[0.03em] text-primary-950 shadow-sm transition sm:px-4 ${tabStyles[tab]} ${isActive ? '-mb-px translate-y-px border-b-transparent pb-3 pt-2.5 shadow-md' : 'opacity-75 hover:-translate-y-0.5 hover:opacity-100'}`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default NotebookTopTabs;
