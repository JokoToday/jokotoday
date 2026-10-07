import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { getPageByKey, type CMSPage } from '../../../lib/cmsService';
import { Container } from '../../../platform/design-system';
import { LEGAL_PAGES, localizedLegalContent, type LegalPageKind } from './legalPages';

function LegalBody({ body }: { body: string }) {
  const blocks = body.replace(/\r\n/g, '\n').split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);

  return (
    <div className="space-y-6 text-base leading-8 text-[#303532]/85">
      {blocks.map((block, index) => {
        const key = `${index}-${block.slice(0, 18)}`;
        if (block.startsWith('### ')) {
          return <h3 key={key} className="text-lg font-semibold text-[#292D2B]">{block.slice(4)}</h3>;
        }
        if (block.startsWith('## ') || block.startsWith('# ')) {
          return <h2 key={key} className="text-xl font-semibold text-[#292D2B] sm:text-2xl">{block.replace(/^#{1,2}\s+/, '')}</h2>;
        }
        const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
        if (lines.every((line) => /^[-*]\s+/.test(line))) {
          return <ul key={key} className="ml-6 list-disc space-y-2">{lines.map((line, i) => <li key={i}>{line.replace(/^[-*]\s+/, '')}</li>)}</ul>;
        }
        if (lines.every((line) => /^\d+[.)]\s+/.test(line))) {
          return <ol key={key} className="ml-6 list-decimal space-y-2">{lines.map((line, i) => <li key={i}>{line.replace(/^\d+[.)]\s+/, '')}</li>)}</ol>;
        }
        return <p key={key} className="whitespace-pre-line">{block}</p>;
      })}
    </div>
  );
}

export default function LegalPage({ kind, onNavigate }: { kind: LegalPageKind; onNavigate: (page: string) => void }) {
  const { language } = useLanguage();
  const locale = language === 'th' || language === 'zh' ? language : 'en';
  const config = LEGAL_PAGES[kind];
  const [page, setPage] = useState<CMSPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setPage(null);
    setLoading(true);
    void getPageByKey(config.pageKey)
      .then((result) => { if (active) setPage(result); })
      .catch((error) => console.warn('Legal page CMS unavailable:', error))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [config.pageKey]);

  const content = localizedLegalContent(page, kind, locale);

  return (
    <div className="joko-mineral-field min-h-[70vh]">
      <section className="relative py-10 sm:py-14 lg:py-16">
        <Container width="wide">
          <div className="mx-auto max-w-4xl">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-[#3F665E] hover:text-[#304B45]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {config.copy[locale].back}
            </button>
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#3F665E]">JOKO TODAY</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#292D2B] sm:text-5xl" style={{ fontFamily: 'var(--joko-font-display)' }}>
                {content.title}
              </h1>
              <span className="mt-4 block h-[3px] w-32 -rotate-1 rounded-full bg-[#D98242]/75" aria-hidden="true" />
            </div>
            <article className="rounded-[2rem] border border-[#8B765E]/14 bg-[#FFF9EE]/92 px-6 py-9 shadow-[0_18px_46px_rgba(48,75,69,.08)] sm:px-10 sm:py-12">
              {loading ? (
                <p className="text-[#303532]/65" role="status">
                  {locale === 'th' ? 'กำลังโหลด…' : locale === 'zh' ? '加载中…' : 'Loading…'}
                </p>
              ) : (
                <LegalBody body={content.body} />
              )}
            </article>
          </div>
        </Container>
      </section>
    </div>
  );
}
