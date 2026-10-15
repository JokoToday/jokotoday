import { useEffect, useState } from 'react';
import {
  getPublishedJokoIllustration,
  localizeJokoNote,
  type JokoBubbleSize,
  type JokoNote as JokoAccentRecord,
} from '../lib/jokoNotesService';
import { getActivePageAccentPreview, removePageAccentPreview } from '../lib/pageAccentPreview';
import { PageAccentPreviewBadge } from './PageAccentPreviewBadge';

const SIZE_CLASSES: Record<JokoBubbleSize, string> = {
  small: 'w-[5.75rem] 2xl:w-[6.5rem]',
  medium: 'w-[7.25rem] 2xl:w-[8rem]',
  large: 'w-[8.75rem] 2xl:w-[9.75rem]',
};

interface JokoIllustrationSlotProps {
  pageKey: string;
  placementKey: string;
  className?: string;
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
}: JokoIllustrationSlotProps) {
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
        setIllustration(null);
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
  const localized = localizeJokoNote(illustration, 'en');

  return (
    <>
      <div
        className={`${SIZE_CLASSES[illustration.bubble_size]} ${className}`}
        aria-hidden={!localized.imageAlt}
      >
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
      </div>
      {isPreview && <PageAccentPreviewBadge />}
    </>
  );
}

export default JokoIllustrationSlot;
