import { Heart } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  fetchNotebookReactionState,
  toggleNotebookReaction,
  type NotebookReactionTarget,
} from '../../../lib/notebookReactionsService';

interface NotebookReactionButtonProps {
  target: NotebookReactionTarget;
  locale: 'en' | 'th' | 'zh';
}

const copy = {
  en: { noticed: 'noticed', add: 'I noticed this', remove: 'Remove my notice' },
  th: { noticed: 'มีคนสังเกต', add: 'ฉันสังเกตเห็นสิ่งนี้', remove: 'ยกเลิกการสังเกตของฉัน' },
  zh: { noticed: '被留意', add: '我留意到了', remove: '取消我的留意' },
} as const;

export function NotebookReactionButton({ target, locale }: NotebookReactionButtonProps) {
  const [count, setCount] = useState(0);
  const [reacted, setReacted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const labels = copy[locale];

  useEffect(() => {
    let active = true;
    setLoading(true);
    setAvailable(true);

    void fetchNotebookReactionState(target).then((state) => {
      if (!active) return;
      if (!state) {
        setAvailable(false);
      } else {
        setCount(state.count);
        setReacted(state.reacted);
      }
      setLoading(false);
    });

    return () => { active = false; };
  }, [target.id, target.type]);

  if (!available) return null;

  const handleToggle = async () => {
    if (loading) return;
    setLoading(true);
    const next = await toggleNotebookReaction(target);
    if (next) {
      setCount(next.count);
      setReacted(next.reacted);
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto flex max-w-6xl justify-end px-3 pb-2 pt-5 sm:px-5">
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        aria-pressed={reacted}
        aria-label={reacted ? labels.remove : labels.add}
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-primary-900/10 bg-background/80 px-4 py-2 text-sm font-medium text-primary-950/70 shadow-sm transition hover:border-primary-900/20 hover:text-primary-950 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-wait disabled:opacity-60"
      >
        <Heart
          className={`h-4 w-4 ${reacted ? 'fill-primary-700 text-primary-700' : 'text-primary-700'}`}
          aria-hidden="true"
        />
        <span>{count}</span>
        <span className="text-primary-950/55">· {labels.noticed}</span>
      </button>
    </div>
  );
}

export default NotebookReactionButton;
