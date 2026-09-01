import { AlertTriangle, CalendarDays, CheckCircle2 } from 'lucide-react';

export interface PickupBasketFitDisplay {
  label: string;
  tone: 'positive' | 'warning';
}

interface PickupIntelligenceBadgesProps {
  nextPickupLabel?: string | null;
  basketFit?: PickupBasketFitDisplay | null;
  size?: 'compact' | 'detail';
}

export function PickupIntelligenceBadges({ nextPickupLabel, basketFit, size = 'compact' }: PickupIntelligenceBadgesProps) {
  if (!nextPickupLabel && !basketFit) return null;

  const textSize = size === 'detail' ? 'text-sm' : 'text-xs';
  const padding = size === 'detail' ? 'px-3 py-2' : 'px-2.5 py-1.5';
  const iconSize = size === 'detail' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  return (
    <div className="flex flex-wrap gap-2">
      {nextPickupLabel && (
        <div className={`inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 text-amber-800 font-medium ${textSize} ${padding}`}>
          <CalendarDays className={`${iconSize} shrink-0`} />
          <span>{nextPickupLabel}</span>
        </div>
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
