import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCMSLabels } from '../hooks/useCMSLabels';

export interface PickupBasketFitDisplay {
  label: string;
  tone: 'positive' | 'warning';
}

interface PickupIntelligenceBadgesProps {
  nextPickupLabel?: string | null;
  basketFit?: PickupBasketFitDisplay | null;
  size?: 'compact' | 'detail';
  onOpenPickupCalendar?: () => void;
}

export function PickupIntelligenceBadges({
  nextPickupLabel,
  basketFit,
  size = 'compact',
  onOpenPickupCalendar,
}: PickupIntelligenceBadgesProps) {
  const { language } = useLanguage();
  const { getLabel } = useCMSLabels();
  if (!nextPickupLabel && !basketFit) return null;

  const textSize = size === 'detail' ? 'text-sm' : 'text-xs';
  const padding = size === 'detail' ? 'px-3 py-2' : 'px-2.5 py-1.5';
  const iconSize = size === 'detail' ? 'w-4 h-4' : 'w-3.5 h-3.5';
  const seeAllDates = getLabel(
    'pickup_intelligence.see_all_dates',
    language,
    language === 'th' ? 'ดูวันทั้งหมด' : language === 'zh' ? '查看所有日期' : 'See all dates',
  );

  return (
    <div className="flex flex-wrap gap-2">
      {nextPickupLabel && (
        onOpenPickupCalendar ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onOpenPickupCalendar();
            }}
            className={`inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 text-amber-800 font-medium hover:bg-amber-100 hover:border-amber-300 transition-colors ${textSize} ${padding}`}
          >
            <CalendarDays className={`${iconSize} shrink-0`} />
            <span>{nextPickupLabel}</span>
            <span className="text-amber-700/75">· {seeAllDates}</span>
            <ArrowRight className={`${iconSize} shrink-0`} />
          </button>
        ) : (
          <div className={`inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 text-amber-800 font-medium ${textSize} ${padding}`}>
            <CalendarDays className={`${iconSize} shrink-0`} />
            <span>{nextPickupLabel}</span>
          </div>
        )
      )}

      {basketFit && (
        <div className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${textSize} ${padding} ${basketFit.tone === 'positive' ? 'border-green-200 bg-green-50 text-green-700' : 'border-orange-200 bg-orange-50 text-orange-800'}`}>
          {basketFit.tone === 'positive' ? <CheckCircle2 className={`${iconSize} shrink-0`} /> : <AlertTriangle className={`${iconSize} shrink-0`} />}
          <span>{basketFit.label}</span>
        </div>
      )}
    </div>
  );
}
