import { useEffect, useState } from 'react';
import {
  DEFAULT_JOKO_HOMEPAGE_BRANDING,
  resolveJokoHomepageBranding,
  type JokoHomepageBranding,
} from '../../../platform/builder/branding';
import type { BuilderDocument } from '../../../platform/builder/contracts';
import { loadPublishedHomepageBuilderDocument } from './publishedHomepageProvider';

export const DEFAULT_JOKO_LOGO_URL = '/assets/brand/joko-today-logo-v0.4.webp';

export interface PublishedJokoBranding {
  logoUrl: string;
  branding: JokoHomepageBranding;
  document: BuilderDocument | null;
}

let cachedBranding: PublishedJokoBranding | null = null;
let pendingBranding: Promise<PublishedJokoBranding> | null = null;
let cacheGeneration = 0;
const listeners = new Set<() => void>();

const DEFAULT_BRANDING: PublishedJokoBranding = {
  logoUrl: DEFAULT_JOKO_LOGO_URL,
  branding: DEFAULT_JOKO_HOMEPAGE_BRANDING,
  document: null,
};

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
      const next: PublishedJokoBranding = {
        logoUrl: hero?.type === 'home.hero.v1'
          ? hero.props.logoUrl || DEFAULT_JOKO_LOGO_URL
          : DEFAULT_JOKO_LOGO_URL,
        branding: resolveJokoHomepageBranding(published?.document.branding),
        document: published?.document ?? null,
      };

      if (generation === cacheGeneration) cachedBranding = next;
      return next;
    })
    .catch((error) => {
      console.error('[JOKO Branding] Could not load published branding; using defaults.', error);
      return DEFAULT_BRANDING;
    })
    .finally(() => {
      if (pendingBranding === request) pendingBranding = null;
    });

  pendingBranding = request;
  return request;
}

export function usePublishedJokoBranding(): PublishedJokoBranding {
  const [value, setValue] = useState(cachedBranding || DEFAULT_BRANDING);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void resolvePublishedBranding().then((resolved) => {
        if (active) setValue(resolved);
      });
    };

    listeners.add(refresh);
    refresh();
    return () => {
      active = false;
      listeners.delete(refresh);
    };
  }, []);

  return value;
}

export function usePublishedJokoLogo(): string {
  return usePublishedJokoBranding().logoUrl;
}
