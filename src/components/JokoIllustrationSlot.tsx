import { useEffect, useState } from 'react';
import {
  getPublishedJokoIllustration,
  localizeJokoNote,
  type JokoBubbleSize,
  type JokoNote as JokoAccentRecord,
} from '../lib/jokoNotesService';
import { getActivePageAccentPreview, removePageAccentPreview } from '../lib/pageAccentPreview';
import { PageAccentPreviewBadge } from './PageAccentPreviewBadge';
import { useLanguage } from '../context/LanguageContext';

const SIZE_CLASSES: Record<JokoBubbleSize, string> = {
  small: 'w-[7.25rem] 2xl:w-[8rem]',
  medium: 'w-[9rem] 2xl:w-[10rem]',
  large: 'w-[10.75rem] 2xl:w-[12rem]',
};

interface JokoIllustrationSlotProps {
  pageKey: string;
  placementKey: string;
  className?: string;
  onActivate?: () => void;
}

/**
 * Design-controlled transparent illustration slot.
 *
 * The image is content-managed in Page Accents while position remains code-owned
 * so the Hero stays stable across responsive breakpoints.
 */
export function JokoIllustrationSlot({
  pageKey,
  placementKey,
  className = '',
  onActivate,
}: JokoIllustrationSlotProps) {
  const { language } = useLanguage();
  const lang = language === 'th' || language === 'zh' ? language : 'en';
  const [illustration, setIllustration] = useState<JokoAccentRecord | null>(null);

  useEffect(() => {
    let active = true;

    const loadPublished = () => {
      getPublishedJokoIllustration(pageKey, placementKey)
        .then((value) => {
          if (active) setIllustration(value);
        })
        .catch((error) => {
          console.error(`[Page Accents] Could not load illustration ${pageKey}/${placementKey}`, error);
          if (active) setIllustration(null);
        });
    };

    const preview = getActivePageAccentPreview(pageKey);

    if (preview) {
      const draft = preview.draft;
      if (
        draft.accent_type === 'illustration'
        && draft.placement_key === placementKey
        && draft.image_url
      ) {
        setIllustration({
          id: `preview-${preview.token}`,
          created_at: '',
          updated_at: '',
          ...draft,
        });
      } else {
        // Homepage accents intentionally coexist. Previewing a bubble must not
        // make an already-published Hero illustration disappear.
        loadPublished();
      }

      const timeout = window.setTimeout(() => {
        removePageAccentPreview(preview.token);
        if (active) loadPublished();
      }, Math.max(0, preview.expiresAt - Date.now()));

      return () => {
        active = false;
        window.clearTimeout(timeout);
      };
    }

    loadPublished();

    return () => {
      active = false;
    };
  }, [pageKey, placementKey]);

  if (!illustration?.image_url) return null;

  const activePreview = getActivePageAccentPreview(pageKey);
  const isPreview = Boolean(
    activePreview
    && activePreview.draft.accent_type === 'illustration'
    && activePreview.draft.placement_key === placementKey,
  );
  const localized = localizeJokoNote(illustration, lang);

  const image = (
    <div
      className="origin-bottom-right"
      style={{ transform: `rotate(${illustration.rotation || 0}deg)` }}
    >
      <img
        src={illustration.image_url}
        alt={localized.imageAlt}
        className="block h-auto w-full object-contain"
        loading="eager"
        decoding="async"
      />
    </div>
  );

  const wrapperClass = `relative shrink-0 ${SIZE_CLASSES[illustration.bubble_size]} ${className}`;
  const interactiveClass = 'cursor-pointer rounded-xl transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C76624]/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#D9ECE9]';

  return (
    <div className={wrapperClass}>
      {illustration.link_url ? (
        <a
          href={illustration.link_url}
          className={`block ${interactiveClass}`}
          aria-label={localized.imageAlt || 'Open linked page'}
        >
          {image}
        </a>
      ) : onActivate ? (
        <button
          type="button"
          onClick={onActivate}
          className={`block border-0 bg-transparent p-0 text-left ${interactiveClass}`}
          aria-label={localized.imageAlt || 'Open linked page'}
        >
          {image}
        </button>
      ) : (
        <div aria-hidden={!localized.imageAlt}>{image}</div>
      )}
      {isPreview && <PageAccentPreviewBadge />}
    </div>
  );
}

export default JokoIllustrationSlot;
