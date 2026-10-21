import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CookingPot, ExternalLink, Heart, Play, Search, X } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { JokoHeroNotebookNote } from '../../../components/JokoHeroNotebookNote';
import { diyCopy } from './copy';
import { diyRecipes, filterDiyRecipes, type DiyRecipe } from './recipes';
import type { DiyText } from './content';
import './diy.css';

const SAVE_KEY = 'joko-diy-saved-v1';
const categories = ['all', 'bread', 'buns', 'cakes', 'cookies', 'pastries'] as const;
function readSaved(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SAVE_KEY) || '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && diyRecipes.some(recipe => recipe.id === id)) : [];
  } catch { return []; }
}
function selectedFromUrl() {
  return diyRecipes.find(recipe => recipe.source && recipe.id === new URLSearchParams(window.location.search).get('recipe')) ?? null;
}

function CreatorVideo({ recipe, onClose }: { recipe: DiyRecipe; onClose: () => void }) {
  const { language } = useLanguage();
  const text = diyCopy[language];
  const dialog = useRef<HTMLDialogElement>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => { element?.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  return <dialog ref={dialog} className="diy-detail" aria-labelledby="diy-detail-title"
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="diy-detail__inner">
      <button type="button" className="diy-back" onClick={onClose}><X size={18} />{text.close}</button>
      <p className="diy-eyebrow">JOKO DIY · {text.source}</p>
      <h2 id="diy-detail-title" lang="en">{recipe.title}</h2>
      {recipe.source ? <>
        <p className="diy-source">{text.source} · <a href={recipe.source.url} target="_blank" rel="noopener noreferrer">{recipe.source.creator} <ExternalLink size={14} /></a></p>
        <div className="diy-player">{videoLoaded
          ? <iframe src={`https://www.youtube-nocookie.com/embed/${recipe.source.youtubeId}?playsinline=1`} title={`${recipe.title} — ${recipe.source.creator}`} allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
          : <button type="button" onClick={() => setVideoLoaded(true)} aria-label={text.load}><img src={recipe.image} alt="" /><span className="diy-play"><Play fill="currentColor" /></span><span className="diy-player-label">{text.load}</span></button>}</div>
        <p className="diy-fine">{text.privacy} <a href={recipe.source.url} target="_blank" rel="noopener noreferrer">{text.creator} ↗</a></p>
      </> : <img className="diy-detail-photo" src={recipe.image} alt={recipe.title} />}
    </div>
  </dialog>;
}

export default function DiyPage({ onNavigate, content }: { onNavigate: (page: string) => void; content?: DiyText }) {
  const { language } = useLanguage();
  const text = content ?? diyCopy[language];
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState(readSaved);
  const [storageError, setStorageError] = useState(false);
  const [selected, setSelected] = useState<DiyRecipe | null>(selectedFromUrl);
  useEffect(() => {
    const sync = () => setSelected(selectedFromUrl());
    const syncSaved = (event: StorageEvent) => { if (event.key === SAVE_KEY) setSaved(readSaved()); };
    window.addEventListener('popstate', sync);
    window.addEventListener('storage', syncSaved);
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('storage', syncSaved); };
  }, []);
  function openRecipe(recipe: DiyRecipe) {
    if (!recipe.source) return;
    const url = new URL(window.location.href);
    url.searchParams.set('recipe', recipe.id);
    window.history.pushState({ diyRecipe: true }, '', `${url.pathname}${url.search}${url.hash}`);
    setSelected(recipe);
  }
  function closeRecipe() {
    if (window.history.state?.diyRecipe) { window.history.back(); return; }
    const url = new URL(window.location.href);
    url.searchParams.delete('recipe');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    setSelected(null);
  }
  function toggleSaved(id: string) {
    const next = saved.includes(id) ? saved.filter(value => value !== id) : [...saved, id];
    setSaved(next);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(next)); setStorageError(false); }
    catch { setStorageError(true); }
  }
  const featured = diyRecipes[0];
  const recipes = filterDiyRecipes(diyRecipes.slice(1), query, category, savedOnly, saved);
  // Include the featured recipe when explicitly searching, filtering or viewing saved cards.
  const visible = query.trim() || category !== 'all' || savedOnly
    ? filterDiyRecipes(diyRecipes, query, category, savedOnly, saved) : recipes;
  return <div className="joko-diy" lang={language}>
    <div className="diy-wrap">
      <section className="diy-hero" aria-labelledby="diy-title">
        <div className="diy-intro">
          <p className="diy-eyebrow">{text.eyebrow}</p>
          <div className="diy-intro-line"><div className="diy-wordmark" aria-label="JOKO DIY"><span>JŌKO</span><span><CookingPot aria-hidden="true" /> DIY</span></div>
          <div><h1 id="diy-title">{text.headline}<br /><em>{text.homemade}</em></h1><p className="diy-community-tagline">{text.community}</p><p>{text.intro}</p></div></div>
          <div className="diy-hero-flourish" aria-hidden="true"><CookingPot strokeWidth={0.7} /><span>{text.curated}</span></div>
        </div>
        <aside className="diy-feature" aria-label={text.featured}>
          <JokoHeroNotebookNote title={text.featured} body={featured.title} rotation={2}>
            <button className="diy-feature-photo" type="button" onClick={() => openRecipe(featured)} aria-label={`${text.view}: ${featured.title}`}><img src={featured.image} alt={featured.title} fetchPriority="high" /><span className="diy-play"><Play fill="currentColor" /></span><span className="diy-photo-label">{text.photo}</span></button>
            <div className="diy-feature-credit"><span>{featured.source?.platform} · {featured.source?.creator}</span><button type="button" className="diy-feature-save" aria-pressed={saved.includes(featured.id)} aria-label={`${saved.includes(featured.id) ? text.unsave : text.save}: ${featured.title}`} onClick={() => toggleSaved(featured.id)}><Heart size={18} fill={saved.includes(featured.id) ? 'currentColor' : 'none'} /></button></div>
            <button className="diy-button" type="button" onClick={() => openRecipe(featured)}>{text.original}<ArrowRight size={17} /></button>
          </JokoHeroNotebookNote>
        </aside>
      </section>
      <section className="diy-catalog" aria-labelledby="diy-catalog-title">
        <div className="diy-catalog-heading"><h2 id="diy-catalog-title">{text.browse}</h2><label className="diy-search"><Search size={20} aria-hidden="true" /><span className="sr-only">{text.search}</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={text.search} /></label></div>
        <div className="diy-filters" role="group" aria-label={text.browse}>{categories.map(value => <button key={value} type="button" aria-pressed={category === value} onClick={() => setCategory(value)}>{text[value]}</button>)}<button type="button" aria-pressed={savedOnly} onClick={() => setSavedOnly(value => !value)}><Heart size={15} />{text.saved}</button></div>
        <p className="diy-preview">{text.preview} {language !== 'en' && text.english}</p>
        <p className="diy-fine" role="status">{visible.length} {text.count} · {storageError ? text.storageError : text.local}</p>
        <div className="diy-grid">{visible.map(recipe => <article key={recipe.id} className="diy-card">
          <button type="button" className="diy-card-photo" disabled={!recipe.source} onClick={() => openRecipe(recipe)} aria-label={`${text.view}: ${recipe.title}`}><img src={recipe.image} alt={recipe.title} loading="lazy" width="800" height="600" /><span className="diy-photo-label">{text.photo}</span>{recipe.source && <><span className="diy-play"><Play fill="currentColor" /></span><span className="diy-platform">{recipe.source.platform}</span></>}</button>
          <div className="diy-card-body"><h3 lang="en"><button type="button" disabled={!recipe.source} onClick={() => openRecipe(recipe)}>{recipe.title}</button></h3><p lang="en">{recipe.description}</p><div className="diy-card-meta">{recipe.source ? <a href={recipe.source.url} target="_blank" rel="noopener noreferrer">{text.by} {recipe.source.creator} <ExternalLink size={12} /></a> : text.pending}</div><div className="diy-card-actions">{recipe.source ? <button type="button" onClick={() => openRecipe(recipe)}>{text.original}<ArrowRight size={16} /></button> : <span className="diy-pending">{text.sourcePending}</span>}<button type="button" className="diy-heart" aria-pressed={saved.includes(recipe.id)} aria-label={`${saved.includes(recipe.id) ? text.unsave : text.save}: ${recipe.title}`} onClick={() => toggleSaved(recipe.id)}><Heart size={21} fill={saved.includes(recipe.id) ? 'currentColor' : 'none'} /></button></div></div>
        </article>)}</div>
        {!visible.length && <div className="diy-empty"><p>{text.empty}</p><button className="diy-button" type="button" onClick={() => { setQuery(''); setCategory('all'); setSavedOnly(false); }}>{text.reset}</button></div>}
      </section>
      <aside className="diy-store"><CookingPot size={36} strokeWidth={1} aria-hidden="true" /><p>{text.store}</p><button className="diy-button" type="button" onClick={() => onNavigate('products-non-bakery')}>{text.storeLink}<ArrowRight size={17} /></button></aside>
    </div>
    {selected && <CreatorVideo key={selected.id} recipe={selected} onClose={closeRecipe} />}
  </div>;
}
