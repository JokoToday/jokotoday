import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, X } from "lucide-react";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../context/AuthContext";
import { AuthModal } from "../../../../components/AuthModal";
import {
  loadComments,
  reviseComment,
  submitComment,
  withdrawComment,
  type RecipeComment,
} from "./service";
import { prepareRecipePhoto, MAX_PHOTOS } from "./photos";
import { recipeLabels } from "./labels";
import type { RecipeLanguage } from "./model";

export function CommentPhotos({
  paths,
  language,
}: {
  paths: string[];
  language: RecipeLanguage;
}) {
  const [photoError, setPhotoError] = useState(false);
  const [urls, setUrls] = useState<string[]>([]);
  const [zoom, setZoom] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const t = recipeLabels[language];
  useEffect(() => {
    let disposed = false;
    const blobs: string[] = [];
    setUrls([]);
    setZoom(null);
    setPhotoError(false);
    void Promise.all(
      paths.map(async (path) => {
        const { data, error } = await supabase.storage
          .from("diy-comment-photos")
          .download(path);
        if (error) throw error;
        if (disposed) throw new Error("Disposed");
        const url = URL.createObjectURL(data);
        blobs.push(url);
        return url;
      }),
    )
      .then((next) => {
        if (!disposed) setUrls(next);
      })
      .catch(() => {
        if (!disposed) setPhotoError(true);
      });
    return () => {
      disposed = true;
      for (const url of blobs) URL.revokeObjectURL(url);
    };
  }, [paths]);
  useEffect(() => {
    if (zoom) dialog.current?.showModal();
    else dialog.current?.close();
  }, [zoom]);
  return (
    <>
      {photoError && <p role="alert">{t.photoError}</p>}
      <div className="recipe-photos">
        {urls.map((url, i) => (
          <button
            type="button"
            key={url}
            onClick={() => setZoom(url)}
            aria-label={`${t.enlarge} ${i + 1}`}
          >
            <img src={url} alt={`${t.photos} ${i + 1}`} />
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        className="recipe-photo-dialog"
        onCancel={() => setZoom(null)}
      >
        <button type="button" onClick={() => setZoom(null)}>
          <X />
          {t.close}
        </button>
        {zoom && <img src={zoom} alt={t.enlarge} />}
      </dialog>
    </>
  );
}
function LocalPhotos({
  photos,
  remove,
  label,
}: {
  photos: Blob[];
  remove: (i: number) => void;
  label: string;
}) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const next = photos.map((p) => URL.createObjectURL(p));
    setUrls(next);
    return () => next.forEach(URL.revokeObjectURL);
  }, [photos]);
  return (
    <div className="recipe-photos">
      {urls.map((url, i) => (
        <button
          type="button"
          key={url}
          onClick={() => remove(i)}
          aria-label={`${label} ${i + 1}`}
        >
          <img src={url} alt="" />
          <span>×</span>
        </button>
      ))}
    </div>
  );
}
export default function RecipeComments({
  recipeId,
  language,
}: {
  recipeId: string;
  language: RecipeLanguage;
}) {
  const { user } = useAuth();
  const t = recipeLabels[language];
  const [comments, setComments] = useState<RecipeComment[]>([]),
    [own, setOwn] = useState<RecipeComment[]>([]);
  const [body, setBody] = useState(""),
    [photos, setPhotos] = useState<Blob[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [auth, setAuth] = useState(false),
    [editing, setEditing] = useState<RecipeComment | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let disposed = false;
    setLoading(true);
    setError("");
    Promise.all([
      loadComments(recipeId),
      user ? loadComments(recipeId, true, user.id) : Promise.resolve([]),
    ])
      .then(([pub, mine]) => {
        if (!disposed) {
          setComments(pub);
          setOwn(mine);
        }
      })
      .catch(() => {
        if (!disposed) setError(t.error);
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [recipeId, user, t.error]);
  async function refresh() {
    const [pub, mine] = await Promise.all([
      loadComments(recipeId),
      user ? loadComments(recipeId, true, user.id) : Promise.resolve([]),
    ]);
    if (mounted.current) {
      setComments(pub);
      setOwn(mine);
    }
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!user || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (editing) await reviseComment(editing, body);
      else await submitComment(recipeId, body, photos, user.id);
      if (!mounted.current) return;
      setBody("");
      setPhotos([]);
      setEditing(null);
      setNotice(t.pending);
      await refresh();
    } catch {
      if (mounted.current) setError(t.error);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section
      id="recipe-comments"
      className="recipe-paper"
      aria-labelledby="recipe-comments-title"
    >
      <h2 id="recipe-comments-title">{t.comments}</h2>
      <p>{t.experience}</p>
      {error && (
        <p role="alert" className="recipe-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {user ? (
        <form onSubmit={send}>
          <label htmlFor="recipe-comment-body">{t.comment}</label>
          <textarea
            id="recipe-comment-body"
            required
            minLength={1}
            maxLength={3000}
            disabled={busy}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t.placeholder}
          />
          {!editing && (
            <>
              <label className="recipe-action recipe-photo-input">
                <Camera size={18} />
                {t.photos}
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                  disabled={busy || photos.length >= 4}
                  onChange={async (e) => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    if (files.length + photos.length > MAX_PHOTOS) {
                      setError(t.limit);
                      return;
                    }
                    setBusy(true);
                    setError("");
                    try {
                      const prepared: Blob[] = [];
                      for (const f of files)
                        prepared.push(await prepareRecipePhoto(f));
                      if (mounted.current)
                        setPhotos((old) => [...old, ...prepared]);
                    } catch {
                      if (mounted.current) setError(t.photoError);
                    } finally {
                      if (mounted.current) setBusy(false);
                    }
                  }}
                />
              </label>
              <small>{t.limit}</small>
              <LocalPhotos
                photos={photos}
                remove={(i) => {
                  if (!busy) setPhotos((p) => p.filter((_, n) => n !== i));
                }}
                label={t.remove}
              />
            </>
          )}
          <p className="recipe-review-note">{t.review}</p>
          <button className="recipe-primary" disabled={busy || !body.trim()}>
            {busy ? t.sending : t.submit}
          </button>
          {editing && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setEditing(null);
                setBody("");
              }}
            >
              {t.cancel}
            </button>
          )}
        </form>
      ) : (
        <button className="recipe-action" onClick={() => setAuth(true)}>
          {t.signIn}
        </button>
      )}
      {loading && <p role="status">{t.loading}</p>}
      {own.length > 0 && (
        <details>
          <summary>{t.own}</summary>
          {own.map((c) => (
            <article className="recipe-comment" key={c.id}>
              <small>
                {c.status === "approved"
                  ? t.approved
                  : c.status === "rejected"
                    ? t.rejected
                    : c.status === "uploading"
                      ? t.uploading
                      : t.awaiting}
              </small>
              <p>{c.body}</p>
              <CommentPhotos paths={c.photos} language={language} />
              <button
                disabled={busy}
                onClick={() => {
                  setEditing(c);
                  setBody(c.body);
                  document.getElementById("recipe-comment-body")?.focus();
                }}
              >
                {t.edit}
              </button>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await withdrawComment(c.id);
                    await refresh();
                  } catch {
                    setError(t.error);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t.remove}
              </button>
            </article>
          ))}
        </details>
      )}
      {!loading && !comments.length && <p>{t.empty}</p>}
      {comments.map((c) => (
        <article key={c.id} className="recipe-comment">
          <strong>{c.author_name}</strong>
          <time dateTime={c.created_at}>
            {new Date(c.created_at).toLocaleDateString(
              language === "zh" ? "zh-CN" : language,
            )}
          </time>
          <p>{c.body}</p>
          <CommentPhotos paths={c.photos} language={language} />
        </article>
      ))}
      <nav className="recipe-section-links">
        <a href="#recipe-top">↑ {t.top}</a>
      </nav>
      {auth && <AuthModal isOpen={true} onClose={() => setAuth(false)} />}
    </section>
  );
}
