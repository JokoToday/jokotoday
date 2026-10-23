import { useEffect, useState } from "react";
import { Printer, Share2, Play } from "lucide-react";
import { useLanguage } from "../../../../context/LanguageContext";
import { useAuth } from "../../../../context/AuthContext";
import { getRecipe } from "./service";
import {
  languages,
  safeHttpUrl,
  youtubeEmbed,
  type RecipeRecord,
  type StoredRecipe,
} from "./model";
import { recipeLabels } from "./labels";
import RecipeComments from "./RecipeComments";
import RecipeLike from "./RecipeLike";
import "./recipe.css";
export function RecipeView({
  recipe,
  id,
  preview = false,
}: {
  recipe: RecipeRecord;
  id?: string;
  preview?: boolean;
}) {
  const { language, setLanguage } = useLanguage();
  const { user } = useAuth();
  const t = recipeLabels[language];
  const [loaded, setLoaded] = useState(false),
    [share, setShare] = useState(false),
    [notice, setNotice] = useState("");
  const embed = youtubeEmbed(recipe.source.url);
  const minutes = (v: number | null) =>
    v === null
      ? t.unknown
      : new Intl.NumberFormat(language, {
          style: "unit",
          unit: "minute",
          unitDisplay: "short",
        }).format(v);
  useEffect(() => {
    setLoaded(false);
  }, [recipe.source.url]);
  return (
    <article id="recipe-top" className="joko-recipe" lang={language}>
      <a href="/diy">← JOKO DIY / {t.back}</a>
      <header className="recipe-heading">
        <div>
          <h1>{recipe.title[language]}</h1>
          <p className="recipe-intro">{recipe.intro[language]}</p>
        </div>
        <div
          role="group"
          aria-label="Recipe language"
          className="recipe-languages"
        >
          {languages.map((l) => (
            <button
              key={l}
              aria-pressed={language === l}
              onClick={() => setLanguage(l)}
            >
              {l === "en" ? "English" : l === "th" ? "ไทย" : "中文"}
            </button>
          ))}
        </div>
      </header>
      <div className="recipe-actions">
        {!preview && id && <RecipeLike id={id} language={language} />}
        <button
          disabled={preview}
          type="button"
          className="recipe-action"
          onClick={async () => {
            if (navigator.share) {
              try {
                await navigator.share({
                  title: recipe.title[language],
                  url: window.location.href.split("#")[0],
                });
              } catch (e) {
                if (!(e instanceof DOMException && e.name === "AbortError"))
                  setShare(true);
              }
            } else setShare((v) => !v);
          }}
        >
          <Share2 size={18} />
          {t.share}
        </button>
        {share && (
          <div className="recipe-share">
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href.split("#")[0])}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Facebook
            </a>
            <a
              href={`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(window.location.href.split("#")[0])}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              LINE
            </a>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    window.location.href.split("#")[0],
                  );
                  setNotice(t.copied);
                } catch {
                  setNotice(t.error);
                }
              }}
            >
              {t.copy}
            </button>
          </div>
        )}
      </div>
      {notice && <p role="status">{notice}</p>}
      {recipe.hero.url && safeHttpUrl(recipe.hero.url) && (
        <figure className="recipe-hero">
          <img
            src={recipe.hero.url}
            alt={recipe.hero.alt[language]}
            fetchPriority="high"
          />
          <figcaption>
            {recipe.hero.kind === "illustration"
              ? `${t.imageIllustration} · `
              : ""}
            {recipe.hero.credit}
          </figcaption>
        </figure>
      )}
      <section className="recipe-video" aria-label={t.video}>
        <h2>{t.video}</h2>
        <p>
          {t.source}:{" "}
          <a href={recipe.source.url} target="_blank" rel="noopener noreferrer">
            {recipe.source.creator} · {recipe.source.platform} ↗
          </a>
        </p>
        {embed ? (
          loaded ? (
            <iframe
              title={`${recipe.title[language]} — ${recipe.source.creator}`}
              src={embed}
              referrerPolicy="strict-origin-when-cross-origin"
              allow="encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : (
            <button
              className="recipe-video-load"
              onClick={() => setLoaded(true)}
            >
              <Play />
              {t.load}
            </button>
          )
        ) : (
          <a
            className="recipe-action"
            href={recipe.source.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.sourceLink} ↗
          </a>
        )}
        {embed && <small>{t.privacy}</small>}
      </section>
      <nav className="recipe-jumps">
        <a href="#recipe-ingredients">{t.ingredients} ↓</a>
        <a href="#recipe-method">{t.method} ↓</a>
        <a href="#recipe-comments">{t.comments} ↓</a>
      </nav>
      <section id="recipe-ingredients" className="recipe-paper">
        <div className="recipe-paper-heading">
          <p className="recipe-hand">{t.notes}</p>
          <button className="recipe-action" onClick={() => window.print()}>
            <Printer size={17} />
            {t.print}
          </button>
        </div>
        <dl className="recipe-facts">
          {[
            [t.prep, minutes(recipe.times.prep_minutes)],
            [t.cook, minutes(recipe.times.cook_minutes)],
            [t.makes, recipe.yield[language] || t.unknown],
            [
              t.difficulty,
              recipe.difficulty ? t[recipe.difficulty] : t.unknown,
            ],
            ...(recipe.times.rest_minutes !== null
              ? [[t.rest, minutes(recipe.times.rest_minutes)]]
              : []),
            ...(recipe.times.total_minutes !== null
              ? [[t.total, minutes(recipe.times.total_minutes)]]
              : []),
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <h2>{t.ingredients}</h2>
        <ul className="recipe-ingredients">
          {recipe.ingredients.map((i, n) => (
            <li key={i.id}>
              {i.group[language] &&
                (n === 0 ||
                  recipe.ingredients[n - 1].group[language] !==
                    i.group[language]) && <h3>{i.group[language]}</h3>}
              <label>
                <input type="checkbox" />
                {i.amount === null
                  ? t.unknown
                  : `${i.amount} ${i.unit ?? ""}`}{" "}
                {i.name[language]}
              </label>
            </li>
          ))}
        </ul>
        {recipe.equipment.length > 0 && (
          <>
            <h3>{t.equipment}</h3>
            <p>{recipe.equipment.map((e) => e[language]).join(" · ")}</p>
          </>
        )}
        <nav className="recipe-section-links">
          <a href="#recipe-top">↑ {t.top}</a>
          <a href="#recipe-method">{t.toMethod} ↓</a>
          <a className="recipe-store" href="/store">
            {t.store} →
          </a>
        </nav>
      </section>
      <section id="recipe-method" className="recipe-paper">
        <h2>{t.method}</h2>
        <ol className="recipe-method">
          {recipe.method.map((s, i) => (
            <li key={s.id}>
              <span className="recipe-step-number" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <h3>{s.title[language]}</h3>
                <p>{s.instruction[language]}</p>
              </div>
            </li>
          ))}
        </ol>
        {recipe.notes.length > 0 && (
          <aside>
            <h3>{t.sourceNotes}</h3>
            {recipe.notes.map((n, i) => (
              <p key={i}>{n[language]}</p>
            ))}
          </aside>
        )}
        {recipe.joko_notes.length > 0 && (
          <aside className="recipe-joko-note">
            <h3>{t.jokoNotes}</h3>
            {recipe.joko_notes.map((n, i) => (
              <p key={i}>{n[language]}</p>
            ))}
          </aside>
        )}
        {recipe.issues.some((i) => !i.resolved) && (
          <aside className="recipe-review-note">
            <h3>{t.issues}</h3>
            {recipe.issues
              .filter((i) => !i.resolved)
              .map((i) => (
                <p key={i.id}>{i.message[language]}</p>
              ))}
          </aside>
        )}
        <nav className="recipe-section-links">
          <a href="#recipe-ingredients">↑ {t.toIngredients}</a>
          <a href="#recipe-top">↑ {t.top}</a>
        </nav>
      </section>
      {!preview && id ? (
        <RecipeComments
          key={`${id}:${user?.id ?? "guest"}`}
          recipeId={id}
          language={language}
        />
      ) : (
        <section id="recipe-comments" className="recipe-paper">
          <h2>{t.comments}</h2>
          <p>{t.experience}</p>
          <p>{t.review}</p>
        </section>
      )}
      <footer className="recipe-credit">
        {t.source}:{" "}
        <a href={recipe.source.url} target="_blank" rel="noopener noreferrer">
          {recipe.source.creator} · {recipe.source.platform} ↗
        </a>
      </footer>
    </article>
  );
}
export default function RecipePage({ slug }: { slug: string }) {
  const { language } = useLanguage();
  const [recipe, setRecipe] = useState<StoredRecipe | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false);
  useEffect(() => {
    let disposed = false;
    setLoading(true);
    setError(false);
    setRecipe(null);
    getRecipe(slug)
      .then((r) => {
        if (!disposed) setRecipe(r);
      })
      .catch(() => {
        if (!disposed) setError(true);
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [slug]);
  useEffect(() => {
    if (recipe) document.title = `${recipe.payload.title[language]} — JOKO DIY`;
  }, [recipe, language]);
  if (loading)
    return (
      <p className="joko-recipe" role="status">
        {recipeLabels[language].loading}
      </p>
    );
  if (!recipe || error)
    return (
      <div className="joko-recipe">
        <p role="alert">{recipeLabels[language].unavailable}</p>
        <a href="/diy">{recipeLabels[language].back}</a>
      </div>
    );
  return <RecipeView key={recipe.id} recipe={recipe.payload} id={recipe.id} />;
}
