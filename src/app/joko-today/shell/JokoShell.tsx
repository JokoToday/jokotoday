import type { CSSProperties, ReactNode } from 'react';
import Footer from '../../../components/Footer';
import { PageCanvas } from '../../../platform/design-system';
import { useLanguage } from '../../../context/LanguageContext';
import JokoShellHeader, { type JokoShellSection } from './JokoShellHeader';
import { jokoBrandingCssVariables } from '../../../platform/builder/branding';
import { usePublishedJokoBranding } from '../builder/usePublishedJokoLogo';
import './jokoShellBackground.css';

interface JokoShellProps {
  onNavigate: (page: string) => void;
  activeSection?: JokoShellSection | null;
  children: ReactNode;
}

export function JokoShell({ onNavigate, activeSection = null, children }: JokoShellProps) {
  const { branding, document } = usePublishedJokoBranding();
  const hero = document?.sections.find(section => section.type === 'home.hero.v1');
  const config = hero?.type === 'home.hero.v1' ? hero.props : null;
  const fullBleed = window.location.pathname === '/' && config?.heroBackgroundMode === 'full-bleed';
  const image = config?.heroImageUrl || '/assets/home-experience/joko-bakery-full-v2.webp';
  const mobile = config?.heroMobileImageUrl || image;
  const heroStyle = fullBleed ? ({
    '--joko-hero-desktop': `url("${image.replaceAll('"', '%22')}")`,
    '--joko-hero-mobile': `url("${mobile.replaceAll('"', '%22')}")`,
    '--joko-hero-x': `${config?.heroFocusX ?? 65}%`,
    '--joko-hero-y': `${config?.heroFocusY ?? 40}%`,
    '--joko-hero-mobile-x': `${config?.heroMobileFocusX ?? 50}%`,
    '--joko-hero-mobile-y': `${config?.heroMobileFocusY ?? 45}%`,
    '--joko-hero-text-opacity': (config?.heroTextOverlay ?? 65) / 100,
    '--joko-hero-header-opacity': (config?.heroHeaderOpacity ?? 85) / 100,
  } as CSSProperties) : undefined;
  const { language } = useLanguage();

  return (
    <PageCanvas
      surface="soft"
      className={`joko-home-shell min-h-screen ${fullBleed ? `joko-hero-full-bleed ${config?.heroBehindHeader === false ? 'joko-hero-below-header' : ''}` : ''}`}
      style={{ ...jokoBrandingCssVariables(branding, language), ...heroStyle }}
    >
      <div className="flex min-h-screen flex-col">
        <JokoShellHeader onNavigate={onNavigate} activeSection={activeSection} />
        <main className="flex-1">{children}</main>
        <Footer onNavigate={onNavigate} variant="mineral" />
      </div>
    </PageCanvas>
  );
}

export default JokoShell;
