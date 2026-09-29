import type { ReactNode } from 'react';
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
  const { branding } = usePublishedJokoBranding();
  const { language } = useLanguage();

  return (
    <PageCanvas
      surface="soft"
      className="joko-home-shell min-h-screen"
      style={jokoBrandingCssVariables(branding, language)}
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
