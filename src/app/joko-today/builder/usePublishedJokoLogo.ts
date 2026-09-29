import { useEffect, useState } from 'react';
import { loadPublishedHomepageBuilderDocument } from './publishedHomepageProvider';

export const DEFAULT_JOKO_LOGO_URL = '/assets/brand/joko-today-logo-v0.4.webp';

let cachedLogoUrl: string | null = null;
let pendingLogoUrl: Promise<string> | null = null;
let cacheGeneration = 0;
const listeners = new Set<() => void>();

export function invalidatePublishedJokoLogoCache() {
  cacheGeneration += 1;
  cachedLogoUrl = null;
  pendingLogoUrl = null;
  listeners.forEach((listener) => listener());
}

async function resolvePublishedLogoUrl(): Promise<string> {
  if (cachedLogoUrl) return cachedLogoUrl;
  if (pendingLogoUrl) return pendingLogoUrl;

  const generation = cacheGeneration;
  const request = loadPublishedHomepageBuilderDocument()
    .then((published) => {
      const hero = published?.document.sections.find((section) => section.type === 'home.hero.v1');
      const logoUrl = hero?.type === 'home.hero.v1'
        ? hero.props.logoUrl || DEFAULT_JOKO_LOGO_URL
        : DEFAULT_JOKO_LOGO_URL;

      if (generation === cacheGeneration) {
        cachedLogoUrl = logoUrl;
      }

      return logoUrl;
    })
    .catch((error) => {
      console.error('[JOKO Branding] Could not load published logo; using bundled fallback.', error);
      return DEFAULT_JOKO_LOGO_URL;
    })
    .finally(() => {
      if (pendingLogoUrl === request) {
        pendingLogoUrl = null;
      }
    });

  pendingLogoUrl = request;
  return request;
}

export function usePublishedJokoLogo(): string {
  const [logoUrl, setLogoUrl] = useState(cachedLogoUrl || DEFAULT_JOKO_LOGO_URL);

  useEffect(() => {
    let active = true;

    const refresh = () => {
      void resolvePublishedLogoUrl().then((resolved) => {
        if (active) setLogoUrl(resolved);
      });
    };

    listeners.add(refresh);
    refresh();

    return () => {
      active = false;
      listeners.delete(refresh);
    };
  }, []);

  return logoUrl;
}
