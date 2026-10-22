import { useEffect, useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import DiyPage from './DiyPage';
import { loadDiyPageContent } from './contentService';
import type { DiyPageContent } from './content';
import { diyCopy } from './copy';

export default function DiyPageWithContent({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { language } = useLanguage();
  const [content, setContent] = useState<DiyPageContent | null>(null);
  useEffect(() => {
    let disposed = false;
    let request = 0;
    const refresh = async () => {
      const current = ++request;
      try {
        const next = await loadDiyPageContent();
        if (!disposed && current === request) setContent(next);
      } catch { /* Keep the last saved copy, or bundled defaults when offline. */ }
    };
    void refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('joko-diy-content-updated', refresh);
    return () => { disposed = true; window.removeEventListener('focus', refresh); window.removeEventListener('joko-diy-content-updated', refresh); };
  }, []);
  return <DiyPage onNavigate={onNavigate} content={content ? { ...diyCopy[language], ...content[language] } : undefined} />;
}
