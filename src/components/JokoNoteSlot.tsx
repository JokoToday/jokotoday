import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getPublishedJokoNote, localizeJokoNote, type JokoNote as JokoNoteRecord } from '../lib/jokoNotesService';
import { JokoNote } from './JokoNote';

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

  return (
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
  );
}

export default JokoNoteSlot;
