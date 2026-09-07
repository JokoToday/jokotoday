export type HomepageRendererMode = 'legacy' | 'builder' | 'experience';

const HOMEPAGE_RENDERER_META = 'joko-homepage-renderer';

/**
 * Public Homepage renderer switch.
 *
 * The value is read at runtime from a source-controlled meta tag in
 * index.html so deployment environment variables cannot silently change
 * the public Homepage renderer. Legacy and Builder remain packaged as
 * reversible fallbacks while the source-controlled Experience composition
 * is introduced slice by slice.
 */
export function getHomepageRendererMode(): HomepageRendererMode {
  const value = document
    .querySelector(`meta[name="${HOMEPAGE_RENDERER_META}"]`)
    ?.getAttribute('content')
    ?.trim()
    .toLowerCase();

  if (value === 'experience') return 'experience';
  if (value === 'builder') return 'builder';
  return 'legacy';
}

export const homepageRendererMode = getHomepageRendererMode();
