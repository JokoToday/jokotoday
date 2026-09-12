import type { ReactNode } from 'react';
import Footer from '../../../components/Footer';
import { PageCanvas } from '../../../platform/design-system';
import JokoShellHeader, { type JokoShellSection } from './JokoShellHeader';

interface JokoShellProps {
  onNavigate: (page: string) => void;
  activeSection?: JokoShellSection | null;
  children: ReactNode;
}

export function JokoShell({ onNavigate, activeSection = null, children }: JokoShellProps) {
  return (
    <PageCanvas surface="soft" className="joko-home-shell min-h-screen bg-background">
      <div className="flex min-h-screen flex-col">
        <JokoShellHeader onNavigate={onNavigate} activeSection={activeSection} />
        <main className="flex-1">{children}</main>
        <Footer onNavigate={onNavigate} />
      </div>
    </PageCanvas>
  );
}

export default JokoShell;
