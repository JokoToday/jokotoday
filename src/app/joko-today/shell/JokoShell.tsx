import type { ReactNode } from 'react';
import Footer from '../../../components/Footer';
import { PageCanvas } from '../../../platform/design-system';
import { builderSiteStyleToCssVariables } from '../../../platform/builder';
import { usePublishedJokoBranding } from '../builder/usePublishedJokoLogo';
import JokoShellHeader, { type JokoShellSection } from './JokoShellHeader';
import './jokoShellBackground.css';

interface JokoShellProps {
  onNavigate: (page: string) => void;
  activeSection?: JokoShellSection | null;
  children: ReactNode;
}

export function JokoShell({ onNavigate, activeSection = null, children }: JokoShellProps) {
  const { siteStyle } = usePublishedJokoBranding();

  return (
    <div
      className="joko-home-shell min-h-screen"
      style={builderSiteStyleToCssVariables(siteStyle)}
    >
      <PageCanvas surface="soft" className="min-h-screen">
      <div className="flex min-h-screen flex-col">
        <JokoShellHeader onNavigate={onNavigate} activeSection={activeSection} />
        <main className="flex-1">{children}</main>
        <Footer onNavigate={onNavigate} variant="mineral" />
      </div>
      </PageCanvas>
    </div>
  );
}

export default JokoShell;
