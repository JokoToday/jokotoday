import { useEffect, useState } from 'react';
import {
  normalizeBuilderSiteStyle,
  type BuilderDocument,
  type BuilderSiteStyle,
} from '../../../platform/builder';
import { loadPublishedHomepageBuilderDocument } from './publishedHomepageProvider';

export const DEFAULT_JOKO_LOGO_URL = '/assets/brand/joko-today-logo-v0.4.webp';

export interface PublishedJokoBranding {
  logoUrl: string;
  siteStyle: BuilderSiteStyle;
  document: BuilderDocument | null;
}

const DEFAULT_BRANDING: PublishedJokoBranding = {
  logoUrl: DEFAULT_JOKO_LOGO_URL,
  siteStyle: normalizeBuilderSiteStyle(),
  document: null,
};

let cachedBranding: PublishedJokoBranding | null = null;
let pendingBranding: Promise<PublishedJokoBranding> | null = null;
let cacheGeneration = 0;
const listeners = new Set<() => void>();

export function invalidatePublishedJokoLogoCache() {
  cacheGeneration += 1;
  cachedBranding = null;
  pendingBranding = null;
  listeners.forEach((listener) => listener());
}

async function resolvePublishedBranding(): Promise<PublishedJokoBranding> {
  if (cachedBranding) return cachedBranding;
  if (pendingBranding) return pendingBranding;

  const generation = cacheGeneration;
  const request = loadPublishedHomepageBuilderDocument()
    .then((published) => {
      const hero = published?.document.sections.find((section) => section.type === 'home.hero.v1');
      const branding: PublishedJokoBranding = {
        logoUrl: hero?.type === 'home.hero.v1'
          ? hero.props.logoUrl || DEFAULT_JOKO_LOGO_URL
          : DEFAULT_JOKO_LOGO_URL,
        siteStyle: normalizeBuilderSiteStyle(published?.document.siteStyle),
        document: published?.document ?? null,
      };

      if (generation === cacheGeneration) {
        cachedBranding = branding;
      }

      return branding;
    })
    .catch((error) => {
      console.error('[JOKO Branding] Could not load published branding; using bundled defaults.', error);
      return DEFAULT_BRANDING;
    })
    .finally(() => {
      if (pendingBranding === request) {
        pendingBranding = null;
      }
    });

  pendingBranding = request;
  return request;
}

export function usePublishedJokoBranding(): PublishedJokoBranding {
  const [branding, setBranding] = useState<PublishedJokoBranding>(
    cachedBranding || DEFAULT_BRANDING,
  );

  useEffect(() => {
    let active = true;

    const refresh = () => {
      void resolvePublishedBranding().then((resolved) => {
        if (active) setBranding(resolved);
      });
    };

    listeners.add(refresh);
    refresh();

    return () => {
      active = false;
      listeners.delete(refresh);
    };
  }, []);

  return branding;
}

export function usePublishedJokoLogo(): string {
  return usePublishedJokoBranding().logoUrl;
}
