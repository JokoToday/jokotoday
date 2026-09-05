export type HomepageRendererMode = 'legacy' | 'builder';

const HOMEPAGE_RENDERER_META = 'joko-homepage-renderer';

/**
 * Public Homepage renderer switch.
 *
 * The value is read at runtime from a source-controlled meta tag in
 * index.html. PR 5 ships that tag as `legacy`, so deployment environment
 * variables cannot activate the Builder path accidentally. Because the value
 * is runtime-resolved, the Builder chunk remains packaged and testable rather
 * than being tree-shaken as unreachable code.
 */
export function getHomepageRendererMode(): HomepageRendererMode {
  const value = document
    .querySelector(`meta[name="${HOMEPAGE_RENDERER_META}"]`)
    ?.getAttribute('content')
    ?.trim()
    .toLowerCase();

  return value === 'builder' ? 'builder' : 'legacy';
}

export const homepageRendererMode = getHomepageRendererMode();
