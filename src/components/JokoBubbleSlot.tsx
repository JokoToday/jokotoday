import { useEffect, useState } from 'react';
import {
  getPublishedJokoBubble,
  type JokoBubbleSize,
  type JokoNote as JokoAccentRecord,
} from '../lib/jokoNotesService';

const SIZE_CLASSES: Record<JokoBubbleSize, string> = {
  small: 'max-w-[11rem] sm:max-w-[12rem]',
  medium: 'max-w-[14rem] sm:max-w-[16rem]',
  large: 'max-w-[17rem] sm:max-w-[20rem]',
};

interface JokoBubbleSlotProps {
  pageKey: string;
  placementKey: string;
  className?: string;
}

export function JokoBubbleSlot({ pageKey, placementKey, className = '' }: JokoBubbleSlotProps) {
  const [bubble, setBubble] = useState<JokoAccentRecord | null>(null);

  useEffect(() => {
    let active = true;

    getPublishedJokoBubble(pageKey, placementKey)
      .then((value) => {
        if (active) setBubble(value);
      })
      .catch((error) => {
        console.error(`[Page Accents] Could not load bubble ${pageKey}/${placementKey}`, error);
        if (active) setBubble(null);
      });

    return () => {
      active = false;
    };
  }, [pageKey, placementKey]);

  if (!bubble?.bubble_image_url) return null;

  const image = (
    <img
      src={bubble.bubble_image_url}
      alt={bubble.bubble_alt || ''}
      className="block h-auto w-full object-contain"
      loading="eager"
      decoding="async"
    />
  );

  const wrapperClass = `w-full ${SIZE_CLASSES[bubble.bubble_size]} ${className}`;

  if (bubble.link_url) {
    return (
      <a
        href={bubble.link_url}
        className={`block transition-transform hover:scale-[1.015] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C76624]/45 ${wrapperClass}`}
      >
        {image}
      </a>
    );
  }

  return <div className={wrapperClass}>{image}</div>;
}

export default JokoBubbleSlot;
