import { useLanguage } from '../../../context/LanguageContext';
import { jokoBrandingCssVariables } from '../../../platform/builder/branding';
import { usePublishedJokoBranding } from '../builder/usePublishedJokoLogo';

export function useInternalJokoBranding() {
  const { language } = useLanguage();
  const { logoUrl, branding } = usePublishedJokoBranding();

  return {
    logoUrl,
    brandingStyle: jokoBrandingCssVariables(branding, language),
  };
}
