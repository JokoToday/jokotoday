export type HomepageRendererMode = 'legacy' | 'builder';

/**
 * Public Homepage renderer switch.
 *
 * Safety rule: anything other than the explicit value `builder` resolves to
 * `legacy`, so a missing or malformed environment variable cannot cut the
 * public Homepage over accidentally.
 */
export function getHomepageRendererMode(
  value = import.meta.env.VITE_HOMEPAGE_RENDERER,
): HomepageRendererMode {
  return typeof value === 'string' && value.trim().toLowerCase() === 'builder'
    ? 'builder'
    : 'legacy';
}

export const homepageRendererMode = getHomepageRendererMode();
