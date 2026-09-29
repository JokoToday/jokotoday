import { useEffect, useState } from 'react';
import { loadPublishedHomepageBuilderDocument } from './publishedHomepageProvider';

export const DEFAULT_JOKO_LOGO_URL = '/assets/brand/joko-today-logo-v0.4.webp';

let cachedLogoUrl: string | null = null;
let pendingLogoUrl: Promise<string> | null = null;

async function resolvePublishedLogoUrl(): Promise<string> {
  if (cachedLogoUrl) return cachedLogoUrl;
  if (pendingLogoUrl) return pendingLogoUrl;

  pendingLogoUrl = loadPublishedHomepageBuilderDocument()
    .then((published) => {
      const hero = published?.document.sections.find((section) => section.type === 'home.hero.v1');
      const logoUrl = hero?.type === 'home.hero.v1'
        ? hero.props.logoUrl || DEFAULT_JOKO_LOGO_URL
        : DEFAULT_JOKO_LOGO_URL;
      cachedLogoUrl = logoUrl;
      return logoUrl;
    })
    .catch((error) => {
      console.error('[JOKO Branding] Could not load published logo; using bundled fallback.', error);
      return DEFAULT_JOKO_LOGO_URL;
    })
    .finally(() => {
      pendingLogoUrl = null;
    });

  return pendingLogoUrl;
}

export function usePublishedJokoLogo(): string {
  const [logoUrl, setLogoUrl] = useState(cachedLogoUrl || DEFAULT_JOKO_LOGO_URL);

  useEffect(() => {
    let active = true;
    void resolvePublishedLogoUrl().then((resolved) => {
      if (active) setLogoUrl(resolved);
    });
    return () => {
      active = false;
    };
  }, []);

  return logoUrl;
}
