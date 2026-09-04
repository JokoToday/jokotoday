import type { BuilderSiteIdentity } from '../../../platform/builder';

/**
 * JOKO TODAY's application-owned Builder identity.
 *
 * PR 3 intentionally keeps this source-controlled while the Platform Site
 * registry is not persisted yet. Database-backed Site identity belongs to a
 * later persistence phase, not to the editor integration proof.
 */
export const jokoTodayBuilderSite: BuilderSiteIdentity = {
  siteId: 'joko-today',
  siteKey: 'joko-today',
  name: 'JOKO TODAY',
  supportedLocales: ['en', 'th', 'zh'],
  defaultLocale: 'en',
};
