import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getPublishedJokoNote, localizeJokoNote, type JokoNote as JokoNoteRecord } from '../lib/jokoNotesService';
import { getActivePageAccentPreview, removePageAccentPreview } from '../lib/pageAccentPreview';
import { JokoNote } from './JokoNote';
import { PageAccentPreviewBadge } from './PageAccentPreviewBadge';

interface JokoNoteSlotProps {
  pageKey: string;
  placementKey: string;
  className?: string;
}

export function JokoNoteSlot({ pageKey, placementKey, className = '' }: JokoNoteSlotProps) {
  const { language } = useLanguage();
  const [note, setNote] = useState<JokoNoteRecord | null>(null);

  useEffect(() => {
    let active = true;
    const preview = getActivePageAccentPreview(pageKey);

    if (preview) {
      const draft = preview.draft;
      if (draft.accent_type === 'note' && draft.placement_key === placementKey) {
        setNote({
          id: `preview-${preview.token}`,
          created_at: '',
          updated_at: '',
          ...draft,
        });
      } else {
        setNote(null);
      }
      const timeout = window.setTimeout(() => {
        removePageAccentPreview(preview.token);
        if (active) setNote(null);
      }, Math.max(0, preview.expiresAt - Date.now()));

      return () => {
        active = false;
        window.clearTimeout(timeout);
      };
    }

    getPublishedJokoNote(pageKey, placementKey)
      .then((value) => {
        if (active) setNote(value);
      })
      .catch((error) => {
        console.error(`[JOKO Notes] Could not load ${pageKey}/${placementKey}`, error);
        if (active) setNote(null);
      });

    return () => {
      active = false;
    };
  }, [pageKey, placementKey]);

  if (!note) return null;

  const localized = localizeJokoNote(note, language);
  if (!localized.title && !localized.body && !note.image_url) return null;

  const activePreview = getActivePageAccentPreview(pageKey);
  const isPreview = Boolean(
    activePreview
    && activePreview.draft.accent_type === 'note'
    && activePreview.draft.placement_key === placementKey,
  );

  return (
    <>
      <JokoNote
      title={localized.title}
      body={localized.body}
      imageUrl={note.image_url || undefined}
      imageAlt={localized.imageAlt}
      href={note.link_url || undefined}
      fontPreset={note.font_preset}
      headingSize={note.heading_size}
      bodySize={note.body_size}
      rotation={note.rotation}
      imageLayout={note.image_layout}
        className={className}
      />
      {isPreview && <PageAccentPreviewBadge />}
    </>
  );
}

export default JokoNoteSlot;
