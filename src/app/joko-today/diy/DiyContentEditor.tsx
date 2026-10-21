import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Eye, Loader2, Save } from 'lucide-react';
import { diyContentFields, resolveDiyPageContent, validateDiyContent, type DiyLanguage, type DiyPageContent } from './content';
import './diyEditor.css';

interface Props {
  loadContent: () => Promise<DiyPageContent>;
  saveContent: (content: DiyPageContent) => Promise<DiyPageContent>;
  onDirtyChange?: (dirty: boolean) => void;
  savedMessage?: string;
  saveDescription?: string;
}
export default function DiyContentEditor({ loadContent, saveContent, onDirtyChange, savedMessage, saveDescription }: Props) {
  const [content, setContent] = useState(resolveDiyPageContent([]));
  const [baseline, setBaseline] = useState('');
  const [language, setLanguage] = useState<DiyLanguage>('en');
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dirty = ready && JSON.stringify(content) !== baseline;
  const text = content[language];
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  useEffect(() => {
    let disposed = false;
    loadContent().then(next => {
      if (disposed) return;
      setContent(next); setBaseline(JSON.stringify(next)); setReady(true);
    }).catch(() => { if (!disposed) setError('Could not load the saved DIY text. Reload this editor before making changes.'); })
      .finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [loadContent]);
  useEffect(() => {
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!ready || saving) return;
    setNotice('');
    const problem = validateDiyContent(content);
    if (problem) { setError(problem); return; }
    setSaving(true); setError('');
    try {
      const saved = await saveContent(content);
      setContent(saved); setBaseline(JSON.stringify(saved));
      setNotice(savedMessage ?? 'DIY page saved. The public page uses this text in all three languages.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Save failed. Your edits are still here; try again.'); }
    finally { setSaving(false); }
  }
  return <section className="diy-editor" aria-labelledby="diy-editor-title">
    <div className="diy-editor-heading"><div><p className="diy-editor-eyebrow">WEBSITE CONTENT</p><h1 id="diy-editor-title">JOKO DIY page</h1><p>Edit the page introduction, notebook heading and catalog text. Recipe cards and illustrations will be managed separately.</p></div><a href="/diy" target="_blank" rel="noopener noreferrer"><Eye size={17} />Open public page ↗</a></div>
    <p className="diy-editor-help">The site-wide header and menu stay in Website / Homepage. The featured recipe title and creator credit come from its source, and are not changed here. <strong>{saveDescription ?? 'Save updates the public page directly; there is no separate Publish step.'}</strong></p>
    {loading && <p role="status"><Loader2 size={18} className="animate-spin" />Loading saved text…</p>}
    {error && <p className="diy-editor-error" role="alert">{error}</p>}
    {notice && <p className="diy-editor-success" role="status"><CheckCircle2 size={18} />{notice}</p>}
    {!loading && ready && <form onSubmit={save}>
      <div className="diy-editor-toolbar"><div className="diy-editor-languages" role="group" aria-label="Editing language">{(['en','th','zh'] as const).map(value => <button type="button" key={value} disabled={saving} aria-pressed={language === value} onClick={() => setLanguage(value)}>{value === 'en' ? 'English' : value === 'th' ? 'ไทย' : '简体中文'}</button>)}</div><span role="status">{saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'All changes saved'}</span><button className="diy-editor-save" type="submit" disabled={saving || !dirty}><Save size={17} />{saving ? 'Saving…' : 'Save DIY page'}</button></div>
      <div className="diy-editor-layout"><div className="diy-editor-fields"><fieldset disabled={saving}><legend className="sr-only">Page text — {language.toUpperCase()}</legend>{diyContentFields.map(field => <div className="diy-editor-field" key={field.key}><label htmlFor={`diy-content-${field.key}`}>{field.label}</label><textarea id={`diy-content-${field.key}`} lang={language} rows={field.rows} maxLength={2000} value={text[field.key]} onChange={event => { setContent(current => ({ ...current, [language]: { ...current[language], [field.key]: event.target.value } })); setNotice(''); setError(''); }} /></div>)}</fieldset><button className="diy-editor-save" type="submit" disabled={saving || !dirty}><Save size={17} />Save DIY page</button></div>
      <aside className="diy-editor-preview" aria-label="Unsaved text preview" lang={language}><p className="diy-editor-eyebrow">TEXT PREVIEW — {language.toUpperCase()}</p><p>{text.eyebrow}</p><h2>{text.headline}<br /><em>{text.homemade}</em></h2><strong>{text.community}</strong><p>{text.intro}</p><p><em>{text.curated}</em></p><div className="diy-editor-note"><h3>{text.featured}</h3><p>Chocolate chip cookies</p><small>Original creator video / source credit</small><span>{text.original} →</span></div><h3>{text.browse}</h3><p>{text.search}</p><hr /><p>{text.store}</p><strong>{text.storeLink} →</strong><small className="diy-editor-preview-note">Preview only. Changes are not public until Save. Photos, layout and recipe content are unchanged by this editor.</small></aside></div>
    </form>}
  </section>;
}
