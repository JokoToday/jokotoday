import { usePublishedJokoBranding } from '../builder/usePublishedJokoLogo';

/** Reuse the exact approved, published hero notebook portrait. Never invent a likeness. */
export function useJokoFounderPortrait(): string | null {
  const { document } = usePublishedJokoBranding();
  const hero = document?.sections.find((section) => section.type === 'home.hero.v1');
  return hero?.type === 'home.hero.v1'
    ? hero.props.notebookNote?.imageUrl?.trim() || null
    : null;
}
