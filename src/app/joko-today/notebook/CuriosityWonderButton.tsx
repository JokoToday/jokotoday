import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  loadCuriosityWonderState,
  toggleCuriosityWonder,
} from '../../../lib/curiosityPersistenceService';

interface CuriosityWonderButtonProps {
  curiosityId: string;
  locale: 'en' | 'th' | 'zh';
  onCountChange?: (count: number) => void;
}

const copy = {
  en: {
    add: 'I wondered that too',
    remove: 'I no longer wonder this',
    one: '1 person wondered this too',
    many: 'people wondered this too',
  },
  th: {
    add: 'ฉันก็สงสัยเหมือนกัน',
    remove: 'ฉันไม่สงสัยเรื่องนี้แล้ว',
    one: '1 คนก็สงสัยเรื่องนี้เหมือนกัน',
    many: 'คนก็สงสัยเรื่องนี้เหมือนกัน',
  },
  zh: {
    add: '我也好奇',
    remove: '我不再好奇这个问题',
    one: '1 个人也好奇这个问题',
    many: '个人也好奇这个问题',
  },
} as const;

export function CuriosityWonderButton({
  curiosityId,
  locale,
  onCountChange,
}: CuriosityWonderButtonProps) {
  const [count, setCount] = useState(0);
  const [wondered, setWondered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const labels = copy[locale];

  useEffect(() => {
    let active = true;
    setLoading(true);
    setAvailable(true);

    void loadCuriosityWonderState(curiosityId).then((state) => {
      if (!active) return;
      if (!state) {
        setAvailable(false);
      } else {
        setCount(state.count);
        setWondered(state.wondered);
        onCountChange?.(state.count);
      }
      setLoading(false);
    });

    return () => { active = false; };
  }, [curiosityId, onCountChange]);

  if (!available) return null;

  const handleToggle = async () => {
    if (loading) return;
    setLoading(true);
    const state = await toggleCuriosityWonder(curiosityId);
    if (state) {
      setCount(state.count);
      setWondered(state.wondered);
      onCountChange?.(state.count);
    }
    setLoading(false);
  };

  const countLabel = count === 1 ? labels.one : `${count} ${labels.many}`;

  return (
    <div className="mt-8 rounded-2xl border border-[#C76624]/18 bg-[#FFF9EE]/70 p-5 sm:flex sm:items-center sm:justify-between sm:gap-5">
      <div>
        <p className="font-header text-xl font-semibold text-[#303532]">{labels.add}</p>
        <p className="mt-1 text-sm text-[#303532]/60">{countLabel}</p>
      </div>
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        aria-pressed={wondered}
        aria-label={wondered ? labels.remove : labels.add}
        className={`mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#C76624] disabled:cursor-wait disabled:opacity-60 sm:mt-0 ${
          wondered
            ? 'border-[#C76624]/45 bg-[#C76624] text-white'
            : 'border-[#C76624]/28 bg-white/70 text-[#A44F1D] hover:border-[#C76624]/55'
        }`}
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        {labels.add}
      </button>
    </div>
  );
}

export default CuriosityWonderButton;
