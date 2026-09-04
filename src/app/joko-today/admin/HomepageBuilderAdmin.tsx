import { useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, RotateCcw, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import {
  BuilderPageRenderer,
  jokoTodayHomepageFixture,
  type BuilderAction,
  type BuilderDocument,
} from '../../../platform/builder';
import { HomepagePuckEditorProof } from '../../../platform/builder/editor';
import {
  createJokoTodayHomepageBuilderProviders,
  jokoTodayBuilderSite,
} from '../builder';

type HomepageBuilderMode = 'edit' | 'preview';

function cloneSeedDocument(): BuilderDocument {
  return JSON.parse(JSON.stringify(jokoTodayHomepageFixture)) as BuilderDocument;
}

function modeFromLocation(): HomepageBuilderMode {
  return window.location.pathname === '/admin/homepage/preview' ? 'preview' : 'edit';
}

function describeAction(action: BuilderAction): string {
  switch (action.type) {
    case 'commerce.openProducts':
      return 'Open Products';
    case 'site.openHowItWorks':
      return 'Open How It Works';
    case 'commerce.browseCategory':
      return `Browse category ${action.categoryId}`;
  }
}

export function HomepageBuilderAdmin() {
  const { language, setLanguage } = useLanguage();
  const providers = useMemo(() => createJokoTodayHomepageBuilderProviders(), []);
  const [draftDocument, setDraftDocument] = useState<BuilderDocument>(cloneSeedDocument);
  const [editorRevision, setEditorRevision] = useState(0);
  const [mode, setModeState] = useState<HomepageBuilderMode>(modeFromLocation);
  const [notice, setNotice] = useState('');
  const [issues, setIssues] = useState<string[]>([]);

  useEffect(() => {
    const handlePopState = () => setModeState(modeFromLocation());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const setMode = (nextMode: HomepageBuilderMode) => {
    setModeState(nextMode);
    const path = nextMode === 'preview'
      ? '/admin/homepage/preview'
      : '/admin/homepage';

    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
  };

  const handlePreviewAction = (action: BuilderAction) => {
    setNotice(`Preview action only: ${describeAction(action)}. No navigation was performed.`);
  };

  const handleReset = () => {
    setDraftDocument(cloneSeedDocument());
    setIssues([]);
    setNotice('Session draft reset to the source-controlled Homepage seed.');
    setEditorRevision((value) => value + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-primary-700">
              <ShieldCheck className="w-4 h-4" />
              Admin-only session draft
            </div>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Website / Homepage Builder</h1>
            <p className="mt-1 text-sm text-gray-600">
              Uses live JOKO TODAY product, category and Hero media providers. Changes are not saved or published and reset on refresh.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 text-sm font-medium" aria-label="Builder locale">
              {(['en', 'th', 'zh'] as const).map((locale) => (
                <button
                  key={locale}
                  type="button"
                  onClick={() => setLanguage(locale)}
                  aria-pressed={language === locale}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    language === locale
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {locale === 'zh' ? '中文' : locale.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <RotateCcw className="w-4 h-4" />
              Reset session
            </button>

            {mode === 'edit' ? (
              <button
                type="button"
                onClick={() => setMode('preview')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
              >
                <Eye className="w-4 h-4" />
                Preview draft
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setMode('edit')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-900"
              >
                <Pencil className="w-4 h-4" />
                Back to editor
              </button>
            )}
          </div>
        </div>
      </div>

      {(notice || issues.length > 0) && (
        <div className="max-w-7xl mx-auto px-4 pt-4 sm:px-6 lg:px-8">
          {notice && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              {notice}
            </div>
          )}
          {issues.length > 0 && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p className="font-semibold">Builder adapter rejected the draft:</p>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                {issues.map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {mode === 'edit' ? (
        <div className="mt-4 border-y border-gray-200 bg-white">
          <HomepagePuckEditorProof
            key={editorRevision}
            document={draftDocument}
            locale={language}
            site={jokoTodayBuilderSite}
            providers={providers}
            onAction={handlePreviewAction}
            onDocumentChange={(document) => {
              setDraftDocument(document);
              setIssues([]);
            }}
            onApplyDraft={(document) => {
              setDraftDocument(document);
              setIssues([]);
              setNotice('Draft applied to this browser session only. Nothing has been published.');
            }}
            onAdapterError={(nextIssues) => setIssues(nextIssues)}
            height="calc(100vh - 11rem)"
          />
        </div>
      ) : (
        <div className="mt-4">
          <div className="max-w-7xl mx-auto px-4 pb-3 sm:px-6 lg:px-8">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Draft preview only — this is not the public Homepage and no action below will navigate away from Admin.
            </div>
          </div>
          <div className="border-y border-gray-200 bg-white">
            <BuilderPageRenderer
              document={draftDocument}
              locale={language}
              site={jokoTodayBuilderSite}
              providers={providers}
              onAction={handlePreviewAction}
              onValidationError={(validationIssues) => {
                setIssues(validationIssues.map((issue) => `${issue.path}: ${issue.message}`));
              }}
              onSectionError={(sectionId, error) => {
                setIssues((current) => [...current, `${sectionId}: ${error.message}`]);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default HomepageBuilderAdmin;
