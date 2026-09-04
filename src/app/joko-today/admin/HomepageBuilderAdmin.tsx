import { useEffect, useMemo, useState } from 'react';
import {
  Eye,
  History,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import {
  BuilderPageRenderer,
  jokoTodayHomepageFixture,
  type BuilderAction,
  type BuilderDocument,
} from '../../../platform/builder';
import { HomepagePuckEditorProof } from '../../../platform/builder/editor';
import {
  BuilderPersistenceConflictError,
  createJokoTodayHomepageBuilderProviders,
  jokoTodayBuilderSite,
  listHomepageBuilderRevisions,
  loadOrInitializeHomepageBuilderState,
  publishHomepageBuilderDraft,
  restoreHomepageBuilderRevision,
  saveHomepageBuilderDraft,
  type HomepageBuilderRevisionSummary,
  type HomepageBuilderState,
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function HomepageBuilderAdmin() {
  const { language, setLanguage } = useLanguage();
  const providers = useMemo(() => createJokoTodayHomepageBuilderProviders(), []);
  const [draftDocument, setDraftDocument] = useState<BuilderDocument>(cloneSeedDocument);
  const [pageState, setPageState] = useState<HomepageBuilderState | null>(null);
  const [revisions, setRevisions] = useState<HomepageBuilderRevisionSummary[]>([]);
  const [editorRevision, setEditorRevision] = useState(0);
  const [mode, setModeState] = useState<HomepageBuilderMode>(modeFromLocation);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [issues, setIssues] = useState<string[]>([]);

  const applyServerState = (state: HomepageBuilderState, remountEditor = false) => {
    setPageState(state);
    setDraftDocument(state.draft.document);
    setDirty(false);
    if (remountEditor) setEditorRevision((value) => value + 1);
  };

  const refreshRevisions = async () => {
    const nextRevisions = await listHomepageBuilderRevisions();
    setRevisions(nextRevisions);
  };

  const loadPersistentState = async () => {
    setLoading(true);
    setBusy('loading');
    setIssues([]);
    try {
      const state = await loadOrInitializeHomepageBuilderState(cloneSeedDocument());
      applyServerState(state, true);
      await refreshRevisions();
      setNotice('Persistent Homepage draft loaded.');
    } catch (error) {
      setIssues([
        error instanceof Error
          ? error.message
          : 'Could not load Homepage Builder persistence.',
      ]);
    } finally {
      setBusy(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPersistentState();
    // The persistence identity is source-controlled for JOKO TODAY.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handlePersistenceError = (error: unknown) => {
    if (error instanceof BuilderPersistenceConflictError) {
      setIssues([error.message]);
      setNotice('Another Admin changed this draft. Use “Reload draft” before continuing.');
      return;
    }

    setIssues([
      error instanceof Error ? error.message : 'Homepage Builder persistence failed.',
    ]);
  };

  const persistDraft = async (document: BuilderDocument): Promise<HomepageBuilderState | null> => {
    if (!pageState || busy) return null;

    setBusy('saving');
    setIssues([]);
    try {
      const state = await saveHomepageBuilderDraft(document, pageState.lockVersion);
      applyServerState(state);
      setNotice(`Draft saved at ${formatDate(state.draft.updatedAt)}. Nothing was published.`);
      return state;
    } catch (error) {
      handlePersistenceError(error);
      return null;
    } finally {
      setBusy(null);
    }
  };

  const handlePreview = async () => {
    if (!pageState || busy) return;
    if (dirty) {
      const saved = await persistDraft(draftDocument);
      if (!saved) return;
    }
    setMode('preview');
    setNotice('Previewing the persisted Draft. This is not the public Homepage.');
  };

  const handlePublish = async () => {
    if (!pageState || busy) return;
    if (dirty) {
      setIssues(['Save the current Draft before publishing.']);
      return;
    }

    const confirmed = window.confirm(
      'Publish the current Homepage Draft as a new immutable revision? The public Homepage will remain on the legacy renderer until the later cutover phase.',
    );
    if (!confirmed) return;

    setBusy('publishing');
    setIssues([]);
    try {
      const state = await publishHomepageBuilderDraft(pageState.lockVersion);
      applyServerState(state);
      await refreshRevisions();
      setNotice(
        `Published Builder revision ${state.published?.revisionNumber ?? ''}. The production Homepage renderer has not been cut over yet.`,
      );
    } catch (error) {
      handlePersistenceError(error);
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async (revision: HomepageBuilderRevisionSummary) => {
    if (!pageState || busy) return;

    const warning = dirty
      ? 'You have unsaved local edits. Restoring will replace them with this published revision. Continue?'
      : `Restore published revision ${revision.revisionNumber} into Draft? This will not publish it.`;

    if (!window.confirm(warning)) return;

    setBusy(`restore-${revision.revisionId}`);
    setIssues([]);
    try {
      const state = await restoreHomepageBuilderRevision(
        revision.revisionId,
        pageState.lockVersion,
      );
      applyServerState(state, true);
      await refreshRevisions();
      setMode('edit');
      setNotice(
        `Revision ${revision.revisionNumber} was copied into Draft. Publish is still a separate explicit action.`,
      );
    } catch (error) {
      handlePersistenceError(error);
    } finally {
      setBusy(null);
    }
  };

  const handleResetToSeed = () => {
    if (busy) return;
    setDraftDocument(cloneSeedDocument());
    setDirty(true);
    setIssues([]);
    setNotice('Source-controlled Homepage seed loaded locally. Choose Save Draft to persist it.');
    setEditorRevision((value) => value + 1);
    setMode('edit');
  };

  if (loading) {
    return (
      <div className="min-h-[55vh] flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-700">
          <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
          Loading persistent Homepage Builder…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-primary-700">
              <ShieldCheck className="w-4 h-4" />
              Admin-only persistent Draft
            </div>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Website / Homepage Builder</h1>
            <p className="mt-1 text-sm text-gray-600">
              Draft changes persist in Supabase. Publish creates immutable revisions; Restore only copies a revision back into Draft.
            </p>
            {pageState && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                <span>Draft lock v{pageState.lockVersion}</span>
                <span>Saved {formatDate(pageState.draft.updatedAt)}</span>
                <span className={dirty ? 'font-semibold text-amber-700' : 'text-emerald-700'}>
                  {dirty ? 'Unsaved local edits' : 'Draft saved'}
                </span>
                <span>
                  {pageState.published
                    ? `Published revision ${pageState.published.revisionNumber}`
                    : 'No published Builder revision yet'}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 text-sm font-medium" aria-label="Builder locale">
              {(['en', 'th', 'zh'] as const).map((locale) => (
                <button
                  key={locale}
                  type="button"
                  onClick={() => setLanguage(locale)}
                  aria-pressed={language === locale}
                  disabled={Boolean(busy)}
                  className={`px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 ${
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
              onClick={() => void loadPersistentState()}
              disabled={Boolean(busy)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              Reload draft
            </button>

            <button
              type="button"
              onClick={handleResetToSeed}
              disabled={Boolean(busy)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to seed
            </button>

            {mode === 'edit' ? (
              <button
                type="button"
                onClick={() => void handlePreview()}
                disabled={Boolean(busy) || !pageState}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {busy === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                Preview draft
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setMode('edit')}
                  disabled={Boolean(busy)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 disabled:opacity-50"
                >
                  <Pencil className="w-4 h-4" />
                  Back to editor
                </button>
                <button
                  type="button"
                  onClick={() => void handlePublish()}
                  disabled={Boolean(busy) || dirty || !pageState}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busy === 'publishing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                  Publish
                </button>
              </>
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
              <p className="font-semibold">Homepage Builder requires attention:</p>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                {issues.map((issue, index) => <li key={`${index}-${issue}`}>{issue}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 pt-4 sm:px-6 lg:px-8">
        <details className="rounded-lg border border-gray-200 bg-white" open={mode === 'preview'}>
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold text-gray-800">
            <History className="w-4 h-4 text-primary-600" />
            Revision history ({revisions.length})
          </summary>
          <div className="border-t border-gray-100 px-4 py-3">
            {revisions.length === 0 ? (
              <p className="text-sm text-gray-500">No published Builder revisions yet.</p>
            ) : (
              <div className="space-y-2">
                {revisions.map((revision) => (
                  <div
                    key={revision.revisionId}
                    className="flex flex-col gap-2 rounded-lg border border-gray-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">Revision {revision.revisionNumber}</span>
                        {revision.isCurrent && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            Current published
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {formatDate(revision.publishedAt)}
                        {revision.restoredFromRevisionId ? ' · published from a restored Draft' : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleRestore(revision)}
                      disabled={Boolean(busy) || !pageState}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {busy === `restore-${revision.revisionId}` ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4" />
                      )}
                      Restore to Draft
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>
      </div>

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
              setDirty(true);
              setIssues([]);
            }}
            onApplyDraft={async (document) => {
              setDraftDocument(document);
              await persistDraft(document);
            }}
            onAdapterError={(nextIssues) => setIssues(nextIssues)}
            applyDraftLabel="Save Draft"
            height="calc(100vh - 11rem)"
          />
        </div>
      ) : (
        <div className="mt-4">
          <div className="max-w-7xl mx-auto px-4 pb-3 sm:px-6 lg:px-8">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Persisted Draft preview — this is not the public Homepage. Publish stores an immutable Builder revision, but production `/` remains on the legacy Homepage until the later cutover phase.
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
