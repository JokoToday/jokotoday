import { JokoHeroNotebookNote } from './JokoHeroNotebookNote';
import type { JokoNoteFontPreset, JokoNoteImageLayout } from '../lib/jokoNotesService';

export interface JokoNoteProps {
  title?: string;
  body?: string;
  imageUrl?: string;
  imageAlt?: string;
  href?: string;
  className?: string;
  interactive?: boolean;
  fontPreset?: JokoNoteFontPreset;
  headingSize?: number;
  bodySize?: number;
  rotation?: number;
  imageLayout?: JokoNoteImageLayout;
}

/**
 * Site-wide editorial JOKO Note.
 *
 * The paper treatment is intentionally shared with the Homepage Hero note so
 * every note belongs to one visual family. Page placement remains code-owned.
 */
export function JokoNote(props: JokoNoteProps) {
  return <JokoHeroNotebookNote {...props} />;
}

export default JokoNote;
