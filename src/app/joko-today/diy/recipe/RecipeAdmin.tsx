import {
  useCallback,
  useEffect,
  useId,
  useState,
  type ChangeEvent,
} from "react";
import { useAuth } from "../../../../context/AuthContext";
import { uploadGalleryImage } from "../../../../lib/mediaService";
import {
  languages,
  parseRecipe,
  publishProblems,
  type Localized,
  type RecipeLanguage,
  type RecipeRecord,
  type StoredRecipe,
} from "./model";
import {
  listRecipes,
  loadComments,
  moderateComment,
  publishRecipe,
  saveRecipe,
  unpublishRecipe,
  type RecipeComment,
} from "./service";
import { CommentPhotos } from "./RecipeComments";
import { RecipeView } from "./RecipePage";
import "./recipeAdmin.css";
const blankText = (): Localized => ({ en: "", th: "", zh: "" });
function rememberedDraft(userId: string, value?: string | null): string | null {
  try {
    const key = `joko-diy-editor:${userId}`;
    if (value === null) sessionStorage.removeItem(key);
    else if (value !== undefined) sessionStorage.setItem(key, value);
    return sessionStorage.getItem(key);
  } catch {
    // Browser storage is optional; saving the actual draft still uses the server.
    return null;
  }
}
function MoveButtons({
  index,
  length,
  move,
  remove,
}: {
  index: number;
  length: number;
  move: (to: number) => void;
  remove: () => void;
}) {
  return (
    <span className="ra-move">
      <button
        type="button"
        disabled={index === 0}
        onClick={() => move(index - 1)}
        aria-label="Move up"
      >
        ↑
      </button>
      <button
        type="button"
        disabled={index === length - 1}
        onClick={() => move(index + 1)}
        aria-label="Move down"
      >
        ↓
      </button>
      <button type="button" onClick={remove}>
        Remove
      </button>
    </span>
  );
}
function LocalizedField({
  label,
  value,
  language,
  onChange,
  rows,
}: {
  label: string;
  value: Localized;
  language: RecipeLanguage;
  onChange: (v: Localized) => void;
  rows: number;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id}>
        {label} ({language.toUpperCase()})
      </label>
      <textarea
        id={id}
        lang={language}
        rows={rows}
        maxLength={4000}
        value={value[language]}
        onChange={(e) => onChange({ ...value, [language]: e.target.value })}
      />
    </div>
  );
}
export default function RecipeAdmin({
  onDirtyChange,
}: {
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { user, userRole } = useAuth();
  const [records, setRecords] = useState<StoredRecipe[]>([]),
    [record, setRecord] = useState<StoredRecipe | undefined>(),
    [recipe, setRecipe] = useState<RecipeRecord | null>(null),
    [baseline, setBaseline] = useState(""),
    [lang, setLang] = useState<RecipeLanguage>("en"),
    [raw, setRaw] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(false),
    [queue, setQueue] = useState<RecipeComment[]>([]);
  const dirty = !!recipe && JSON.stringify(recipe) !== baseline;
  const refresh = useCallback(async () => {
    const [recipes, comments] = await Promise.all([
      listRecipes(true),
      loadComments(undefined, true),
    ]);
    setRecords(recipes);
    setQueue(comments.filter((c) => c.status !== "uploading"));
    return recipes;
  }, []);
  useEffect(() => {
    let cancelled = false;
    setRecord(undefined);
    setRecipe(null);
    setBaseline("");
    setRecords([]);
    setQueue([]);
    if (userRole === "admin" && user?.id)
      void refresh().then((recipes) => {
        if (cancelled) return;
        const savedId = rememberedDraft(user.id);
        const saved = recipes.find((r) => r.id === savedId);
        if (saved) {
          setRecord(saved);
          setRecipe(saved.payload);
          setBaseline(JSON.stringify(saved.payload));
        } else if (savedId) rememberedDraft(user.id, null);
      }).catch(() => {
        if (!cancelled) setError(
          "Could not load recipes. Confirm the recipe migration is installed.",
        );
      });
    return () => { cancelled = true; };
  }, [user?.id, userRole, refresh]);
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  if (!user || userRole !== "admin")
    return <p role="alert">Admin access required.</p>;
  function select(r: StoredRecipe) {
    if (dirty && !window.confirm("Discard unsaved recipe changes?")) return;
    setRecord(r);
    rememberedDraft(user!.id, r.id);
    setRecipe(r.payload);
    setBaseline(JSON.stringify(r.payload));
    setNotice("");
    setError("");
  }
  function importJson(text: string) {
    try {
      if (new TextEncoder().encode(text).byteLength > 524288)
        throw new Error("JSON must be 512 KB or smaller.");
      const parsed = parseRecipe(JSON.parse(text));
      if (dirty && !window.confirm("Replace the unsaved recipe draft?")) return;
      setRecipe(parsed);
      setRecord(undefined);
      rememberedDraft(user!.id, null);
      setBaseline("");
      setNotice(
        "Imported into a new unsaved draft. Nothing has been published.",
      );
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
    }
  }
  async function action(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Action failed. Your edits are still here.",
      );
    } finally {
      setBusy(false);
    }
  }
  const set = <K extends keyof RecipeRecord>(key: K, value: RecipeRecord[K]) =>
    setRecipe((r) => (r ? { ...r, [key]: value } : r));
  function textField(
    label: string,
    value: Localized,
    change: (v: Localized) => void,
    rows = 2,
  ) {
    return (
      <LocalizedField
        label={label}
        value={value}
        language={lang}
        onChange={change}
        rows={rows}
      />
    );
  }
  function move<K extends "ingredients" | "method">(
    key: K,
    index: number,
    to: number,
  ) {
    if (!recipe) return;
    const items = [...recipe[key]];
    const [item] = items.splice(index, 1);
    items.splice(to, 0, item);
    set(key, items as RecipeRecord[K]);
  }
  const exportJson = () => {
    if (!recipe) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(recipe, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${recipe.slug}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section className="recipe-admin">
      <h1>JOKO DIY recipes</h1>
      <p>
        Import ChatGPT’s JOKO JSON, check all three languages, add your image,
        then save and publish. Saving a draft does not alter the public version.
      </p>
      {error && (
        <pre role="alert" className="recipe-error">
          {error}
        </pre>
      )}
      {notice && (
        <p role="status" className="ra-notice">
          {notice}
        </p>
      )}
      <fieldset disabled={busy}>
        <legend>Add new recipe · Import JSON</legend>
        <a href="/templates/joko-recipe-v1.example.json" download>
          Download example JSON
        </a>
        <label className="ra-json-upload">
          Upload JSON
          <input
            type="file"
            accept="application/json,.json"
            onChange={async (e: ChangeEvent<HTMLInputElement>) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (file.size > 524288) {
                setError("JSON must be 512 KB or smaller.");
                return;
              }
              importJson(await file.text());
            }}
          />
        </label>
        <details>
          <summary>Or paste JSON</summary>
          <textarea
            rows={5}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Paste JOKO recipe JSON"
          />
          <button type="button" onClick={() => importJson(raw)}>
            Validate & import draft
          </button>
        </details>
      </fieldset>
      <label>
        Existing draft
        <select
          value={record?.id ?? ""}
          disabled={busy}
          onChange={(e) => {
            const r = records.find((r) => r.id === e.target.value);
            if (r) select(r);
          }}
        >
          <option value="">Select a recipe…</option>
          {records.map((r) => (
            <option key={r.id} value={r.id}>
              {r.payload.title.en || r.slug} · revision {r.revision}
            </option>
          ))}
        </select>
      </label>
      {recipe && (
        <>
          <div className="ra-toolbar">
            <div role="group" aria-label="Editing language">
              {languages.map((l) => (
                <button
                  disabled={busy}
                  type="button"
                  key={l}
                  aria-pressed={lang === l}
                  onClick={() => setLang(l)}
                >
                  {l === "en" ? "English" : l === "th" ? "ไทย" : "中文"}
                </button>
              ))}
            </div>
            <strong>{dirty ? "Unsaved changes" : "Draft saved"}</strong>
            <button
              type="button"
              className="ra-preview-toggle"
              aria-expanded={preview}
              aria-controls="recipe-editor-preview"
              onClick={() => setPreview((p) => !p)}
            >
              {preview ? "Hide recipe preview" : "Show recipe preview"}
            </button>
            <span className="ra-preview-status" role="status">
              {preview ? "Preview is open below." : "Preview is hidden."}
            </span>
            <button disabled={busy} onClick={exportJson}>
              Export JSON
            </button>
            <a href="#recipe-original-video">Add original video URL ↓</a>
          </div>
          {preview && (
            <section id="recipe-editor-preview" className="ra-preview" aria-label="Recipe preview">
              <p>Recipe preview · select the language within the page. Unsaved edits are included.</p>
              <RecipeView recipe={recipe} preview />
            </section>
          )}
          <fieldset disabled={busy} className="ra-fields">
            <legend>Recipe details</legend>
            <label>
              URL slug (fixed after first publication)
              <input
                value={recipe.slug}
                onChange={(e) => set("slug", e.target.value)}
              />
            </label>
            <label>
              Category
              <select
                value={recipe.category}
                onChange={(e) =>
                  set("category", e.target.value as RecipeRecord["category"])
                }
              >
                {["bread", "buns", "cakes", "cookies", "pastries"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            {textField("Title", recipe.title, (v) => set("title", v))}
            {textField("Introduction", recipe.intro, (v) => set("intro", v), 3)}
            {textField("Yield / finished quantity", recipe.yield, (v) =>
              set("yield", v),
            )}
            <label>
              Difficulty
              <select
                value={recipe.difficulty ?? ""}
                onChange={(e) =>
                  set(
                    "difficulty",
                    (e.target.value || null) as RecipeRecord["difficulty"],
                  )
                }
              >
                <option value="">Not assigned</option>
                <option value="easy">Easy</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
            <div className="ra-grid">
              {Object.entries(recipe.times).map(([key, value]) => (
                <label key={key}>
                  {key.replaceAll("_", " ")}
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    step="any"
                    value={value ?? ""}
                    onChange={(e) =>
                      set("times", {
                        ...recipe.times,
                        [key]:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <h2 id="recipe-original-video">Original video and creator</h2>
            <p>Paste the original video URL below. YouTube plays embedded; TikTok and RedNote currently open the original post. Video-file upload is not available yet.</p>
            {(["creator", "url", "original_title", "language"] as const).map(
              (key) => (
                <label key={key}>
                  {{ creator: "Original creator", url: "Original video URL (YouTube, TikTok or RedNote)", original_title: "Original video title", language: "Original video language" }[key]}
                  <input
                    type={key === "url" ? "url" : "text"}
                    placeholder={key === "url" ? "https://…" : undefined}
                    value={recipe.source[key]}
                    onChange={(e) =>
                      set("source", { ...recipe.source, [key]: e.target.value })
                    }
                  />
                </label>
              ),
            )}
            <label>
              Platform
              <select
                value={recipe.source.platform}
                onChange={(e) =>
                  set("source", {
                    ...recipe.source,
                    platform: e.target
                      .value as RecipeRecord["source"]["platform"],
                  })
                }
              >
                {["YouTube", "TikTok", "RedNote", "Other"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <h2>Hero image</h2>
            <label>
              Upload hero image
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file)
                    await action(async () => {
                      const result = await uploadGalleryImage({
                        file,
                        gallerySlot: "diy-recipes",
                      });
                      set("hero", {
                        ...recipe.hero,
                        url: result.publicUrl,
                        permission: "pending",
                      });
                      setNotice(
                        "Image uploaded. Check its credit and permission before publishing.",
                      );
                    });
                }}
              />
            </label>
            <label>
              Image URL
              <input
                value={recipe.hero.url}
                onChange={(e) =>
                  set("hero", { ...recipe.hero, url: e.target.value })
                }
              />
            </label>
            {textField("Image description", recipe.hero.alt, (v) =>
              set("hero", { ...recipe.hero, alt: v }),
            )}
            <label>
              Image credit
              <input
                value={recipe.hero.credit}
                onChange={(e) =>
                  set("hero", { ...recipe.hero, credit: e.target.value })
                }
              />
            </label>
            <label>
              Image type
              <select
                value={recipe.hero.kind}
                onChange={(e) =>
                  set("hero", {
                    ...recipe.hero,
                    kind: e.target.value as RecipeRecord["hero"]["kind"],
                  })
                }
              >
                {["source-frame", "photo", "illustration"].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={recipe.hero.permission === "permitted"}
                onChange={(e) =>
                  set("hero", {
                    ...recipe.hero,
                    permission: e.target.checked ? "permitted" : "pending",
                  })
                }
              />{" "}
              JOKO has confirmed permission to use this image
            </label>
            <h2>Ingredients</h2>
            {recipe.ingredients.map((i, n) => (
              <fieldset key={i.id}>
                <legend>Ingredient {n + 1}</legend>
                <MoveButtons
                  index={n}
                  length={recipe.ingredients.length}
                  move={(to) => move("ingredients", n, to)}
                  remove={() =>
                    set(
                      "ingredients",
                      recipe.ingredients.filter((_, x) => x !== n),
                    )
                  }
                />
                {textField("Ingredient", i.name, (v) =>
                  set(
                    "ingredients",
                    recipe.ingredients.map((a, x) =>
                      x === n ? { ...a, name: v } : a,
                    ),
                  ),
                )}
                {textField("Group", i.group, (v) =>
                  set(
                    "ingredients",
                    recipe.ingredients.map((a, x) =>
                      x === n ? { ...a, group: v } : a,
                    ),
                  ),
                )}
                {(["amount", "unit"] as const).map((key) => (
                  <label key={key}>
                    {key} · shared across languages
                    <input
                      value={i[key] ?? ""}
                      placeholder="Not specified"
                      onChange={(e) =>
                        set(
                          "ingredients",
                          recipe.ingredients.map((a, x) =>
                            x === n
                              ? { ...a, [key]: e.target.value || null }
                              : a,
                          ),
                        )
                      }
                    />
                  </label>
                ))}
              </fieldset>
            ))}
            <button
              onClick={() =>
                set("ingredients", [
                  ...recipe.ingredients,
                  {
                    id: crypto.randomUUID(),
                    name: blankText(),
                    group: blankText(),
                    amount: null,
                    unit: null,
                  },
                ])
              }
            >
              Add ingredient
            </button>
            <h2>Method</h2>
            {recipe.method.map((s, n) => (
              <fieldset key={s.id}>
                <legend>Step {n + 1}</legend>
                <MoveButtons
                  index={n}
                  length={recipe.method.length}
                  move={(to) => move("method", n, to)}
                  remove={() =>
                    set(
                      "method",
                      recipe.method.filter((_, x) => x !== n),
                    )
                  }
                />
                {textField("Step title", s.title, (v) =>
                  set(
                    "method",
                    recipe.method.map((a, x) =>
                      x === n ? { ...a, title: v } : a,
                    ),
                  ),
                )}
                {textField(
                  "Instructions (including source temperatures and timings)",
                  s.instruction,
                  (v) =>
                    set(
                      "method",
                      recipe.method.map((a, x) =>
                        x === n ? { ...a, instruction: v } : a,
                      ),
                    ),
                  4,
                )}
              </fieldset>
            ))}
            <button
              onClick={() =>
                set("method", [
                  ...recipe.method,
                  {
                    id: crypto.randomUUID(),
                    title: blankText(),
                    instruction: blankText(),
                  },
                ])
              }
            >
              Add step
            </button>
            {(["equipment", "notes", "joko_notes"] as const).map((key) => (
              <section key={key}>
                <h2>{key.replaceAll("_", " ")}</h2>
                {recipe[key].map((n, index) => (
                  <div key={index}>
                    {textField(
                      key,
                      n,
                      (v) =>
                        set(
                          key,
                          recipe[key].map((a, x) => (x === index ? v : a)),
                        ),
                      3,
                    )}
                    <button
                      onClick={() =>
                        set(
                          key,
                          recipe[key].filter((_, x) => x !== index),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button onClick={() => set(key, [...recipe[key], blankText()])}>
                  Add {key.replaceAll("_", " ")}
                </button>
              </section>
            ))}
            <h2>Source issues</h2>
            {recipe.issues.map((issue, n) => (
              <fieldset key={issue.id}>
                {textField(
                  "Issue",
                  issue.message,
                  (v) =>
                    set(
                      "issues",
                      recipe.issues.map((a, x) =>
                        x === n ? { ...a, message: v } : a,
                      ),
                    ),
                  3,
                )}
                <label>
                  <input
                    type="checkbox"
                    checked={issue.blocking}
                    onChange={(e) =>
                      set(
                        "issues",
                        recipe.issues.map((a, x) =>
                          x === n ? { ...a, blocking: e.target.checked } : a,
                        ),
                      )
                    }
                  />{" "}
                  Blocks publication
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={issue.resolved}
                    onChange={(e) =>
                      set(
                        "issues",
                        recipe.issues.map((a, x) =>
                          x === n ? { ...a, resolved: e.target.checked } : a,
                        ),
                      )
                    }
                  />{" "}
                  Resolved by reviewer
                </label>
              </fieldset>
            ))}
            <button
              onClick={() =>
                set("issues", [
                  ...recipe.issues,
                  {
                    id: crypto.randomUUID(),
                    message: blankText(),
                    blocking: true,
                    resolved: false,
                  },
                ])
              }
            >
              Add source issue
            </button>
            <details>
              <summary>Imported source evidence (retained on export)</summary>
              <pre>{JSON.stringify(recipe.evidence, null, 2)}</pre>
            </details>
          </fieldset>
          <div className="ra-toolbar">
            <button
              disabled={busy || !dirty}
              onClick={() =>
                action(async () => {
                  const saved = await saveRecipe(parseRecipe(recipe), record);
                  setRecord(saved);
                  rememberedDraft(user.id, saved.id);
                  setRecipe(saved.payload);
                  setBaseline(JSON.stringify(saved.payload));
                  setNotice("Draft saved. The public recipe is unchanged.");
                  await refresh();
                })
              }
            >
              Save draft
            </button>
            <button
              disabled={busy || dirty || !record}
              onClick={() =>
                action(async () => {
                  if (!record) return;
                  await publishRecipe(record);
                  setNotice("Recipe published in all three languages.");
                  await refresh();
                })
              }
            >
              Publish saved draft
            </button>
            <button
              disabled={busy || !record}
              onClick={() =>
                action(async () => {
                  if (record) {
                    await unpublishRecipe(record.id);
                    setNotice("Recipe unpublished. Draft retained.");
                  }
                })
              }
            >
              Unpublish
            </button>
            {record && (
              <a
                href={`/diy/recipes/${record.slug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open public recipe ↗
              </a>
            )}
          </div>
          {publishProblems(recipe).length > 0 && (
            <details open>
              <summary>Before publishing</summary>
              <ul>
                {publishProblems(recipe).map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      <section className="ra-moderation">
        <h2>Comment review</h2>
        <p>
          Approve or reject text and photos together. Revisions return to this
          queue.
        </p>
        <button disabled={busy} onClick={() => action(async () => { await refresh(); })}>
          Refresh queue
        </button>
        {queue.length === 0 && <p>No submissions to review.</p>}
        {queue.map((c) => (
          <article key={c.id}>
            <strong>{c.author_name}</strong> · {c.status} ·{" "}
            <small>{c.recipe_id}</small>
            <p>{c.body}</p>
            <CommentPhotos paths={c.photos} language="en" />
            <button
              disabled={busy}
              onClick={() =>
                action(async () => {
                  await moderateComment(c, true);
                  await refresh();
                  setNotice("Comment and photos approved.");
                })
              }
            >
              Approve
            </button>
            <button
              disabled={busy}
              onClick={() =>
                action(async () => {
                  await moderateComment(c, false);
                  await refresh();
                  setNotice("Comment and photos hidden.");
                })
              }
            >
              Reject / hide
            </button>
          </article>
        ))}
      </section>
    </section>
  );
}
