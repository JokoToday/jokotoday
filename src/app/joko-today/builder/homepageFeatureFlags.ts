export type HomepageRendererMode = 'legacy' | 'builder';

/**
 * Public Homepage renderer switch.
 *
 * PR 5 deliberately keeps this source-controlled and locked to `legacy`.
 * The later production cutover PR may change this single value to `builder`
 * only after a real published Homepage revision passes parity review.
 */
export const homepageRendererMode: HomepageRendererMode = 'legacy';
