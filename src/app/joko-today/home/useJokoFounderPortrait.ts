import { usePublishedJokoBranding } from '../builder/usePublishedJokoLogo';

/** Preserve the approved hero portrait unless Admin publishes a dedicated About replacement. */
export function useJokoFounderPortrait(): string | null {
  const { branding, document } = usePublishedJokoBranding();
  const hero = document?.sections.find((section) => section.type === 'home.hero.v1');
  const heroPortrait = hero?.type === 'home.hero.v1'
    ? hero.props.notebookNote?.imageUrl?.trim() || null
    : null;
  // A dedicated About portrait overrides the approved hero image on both cards
  // and the Meet Founders page. Older published revisions still use the hero.
  return branding.aboutCards?.people?.imageUrl?.trim() || heroPortrait;
}
