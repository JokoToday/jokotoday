import { useEffect, useState } from "react";
import { Plus, RefreshCw, Save, Send } from "lucide-react";
import {
  loadAssistantAdmin,
  publishAssistantContent,
  saveAssistantDraft,
  type AssistantAdminState,
} from "../lib/assistantContentService";
import { uploadGalleryImage } from "../lib/mediaService";
import AssistantWidget from "../app/joko-today/assistant/AssistantWidget";
import {
  assistantLanguages,
  assistantSections,
  blankText,
  starterAssistantContent,
  parseAssistantContent,
  safeIllustrationUrl,
  type AssistantContent,
  type CuratedQuestion,
  type Localized,
  type QuestionCategory,
} from "../app/joko-today/assistant/content";
const labels = { en: "English", th: "ไทย", zh: "简体中文" };
const sectionLabels = {
  faq: "JOKO essentials / FAQ",
  curious: "Curious Bites",
  guide: "Ingredients & preferences",
  live: "Live availability (AI)",
};
const clone = (v: AssistantContent) => structuredClone(v);
function LocalizedFields({
  label,
  value,
  multiline = false,
  maxLength,
  onChange,
}: {
  label: string;
  value: Localized;
  multiline?: boolean;
  maxLength: number;
  onChange: (value: Localized) => void;
}) {
  return (
    <fieldset className="rounded-xl border border-[#d1d8cb] p-3">
      <legend className="px-1 text-sm font-medium">{label}</legend>
      <div className="grid gap-3 lg:grid-cols-3">
        {assistantLanguages.map((l) => (
          <label key={l} className="block">
            <span className="text-xs">{labels[l]}</span>
            {multiline ? (
              <textarea
                aria-label={`${label} — ${labels[l]}`}
                value={value[l]}
                maxLength={maxLength}
                rows={4}
                onChange={(e) => onChange({ ...value, [l]: e.target.value })}
                className="mt-1 w-full rounded-lg border p-2 text-sm"
              />
            ) : (
              <input
                aria-label={`${label} — ${labels[l]}`}
                value={value[l]}
                maxLength={maxLength}
                onChange={(e) => onChange({ ...value, [l]: e.target.value })}
                className="mt-1 w-full rounded-lg border p-2 text-sm"
              />
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
export function AskJokoManagement() {
  const [state, setState] = useState<AssistantAdminState>(),
    [draft, setDraft] = useState<AssistantContent>();
  const [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [preview, setPreview] = useState(false);
  const patch = (next: AssistantContent) => {
    setDraft(next);
    setDirty(true);
    setNotice("");
  };
  const selectedQuestion = draft?.questions.find((q) => q.id === selected);
  const selectedCategory = draft?.categories.find(
    (c) => c.id === selectedQuestion?.categoryId,
  );
  async function load(checkDirty = true) {
    if (
      checkDirty &&
      dirty &&
      !window.confirm("Reload and discard unsaved Ask JOKO changes?")
    )
      return;
    setBusy(true);
    setError("");
    try {
      const next = await loadAssistantAdmin();
      setState(next);
      setDraft(clone(next.draft));
      setDirty(false);
      setPreview(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Ask JOKO.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  function updateQuestion(patchValue: Partial<CuratedQuestion>) {
    if (!draft || !selectedQuestion) return;
    patch({
      ...draft,
      questions: draft.questions.map((q) =>
        q.id === selected ? { ...q, ...patchValue } : q,
      ),
    });
  }
  function updateCategory(id: string, patchValue: Partial<QuestionCategory>) {
    if (draft)
      patch({
        ...draft,
        categories: draft.categories.map((c) =>
          c.id === id ? { ...c, ...patchValue } : c,
        ),
      });
  }
  async function save(publish = false) {
    if (!draft || !state) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      parseAssistantContent(draft);
      const saved = await saveAssistantDraft(draft, state.version);
      // Retain the successful draft version even if a subsequent publish fails.
      setState(saved);
      setDraft(clone(saved.draft));
      setDirty(false);
      if (publish) {
        const published = await publishAssistantContent(saved.version);
        setState(published);
        setNotice(
          "Published. Customers see the complete translations of enabled questions.",
        );
      } else
        setNotice(
          "Draft saved privately. The published widget has not changed.",
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save Ask JOKO.");
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File | undefined) {
    if (!file || !draft) return;
    setBusy(true);
    setError("");
    try {
      const ticket = await uploadGalleryImage({
        file,
        gallerySlot: "ask-joko",
      });
      if (!safeIllustrationUrl(ticket.publicUrl))
        throw Error("Use a JOKO media image URL.");
      patch({
        ...draft,
        illustration: { ...draft.illustration, url: ticket.publicUrl },
      });
      setNotice("Image uploaded. Save and publish to display it.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not upload illustration.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <div className="joko-admin-paper-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Ask JOKO</h2>
            <p className="mt-1 text-sm">
              Private drafts, approved answers and live inventory questions.
              Missing translations are hidden in that language.
            </p>
            <p className="mt-2 text-xs">
              {state?.publishedAt
                ? `Last published: ${new Date(state.publishedAt).toLocaleString()}`
                : "Nothing published yet."}
              {dirty ? " · Unsaved changes" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="joko-admin-secondary-button flex items-center gap-2 px-3 py-2"
              type="button"
              disabled={busy}
              onClick={() => void load()}
            >
              <RefreshCw size={16} />
              Reload
            </button>
            <button
              className="joko-admin-secondary-button flex items-center gap-2 px-3 py-2"
              type="button"
              disabled={busy || !draft}
              onClick={() => void save()}
            >
              <Save size={16} />
              Save draft
            </button>
            <button
              className="joko-admin-primary-button flex items-center gap-2 px-3 py-2"
              type="button"
              disabled={busy || !draft}
              onClick={() => void save(true)}
            >
              <Send size={16} />
              Save & publish
            </button>
            <button
              className="joko-admin-secondary-button px-3 py-2"
              type="button"
              disabled={!draft || busy}
              onClick={() => setPreview(!preview)}
            >
              Preview draft
            </button>
          </div>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mt-3 text-sm text-[#466861]">
            {notice}
          </p>
        )}
        {busy && (
          <p role="status" className="mt-3 text-sm">
            Working…
          </p>
        )}
      </div>
      {draft && (
        <fieldset disabled={busy} className="space-y-5 border-0 p-0">
          <section className="joko-admin-paper-card space-y-3 p-5">
            <h3 className="font-semibold">Illustration</h3>
            <label className="block text-sm">
              JPG, PNG or WebP
              <input
                aria-label="Upload Ask JOKO illustration"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => void upload(e.target.files?.[0])}
                className="mt-2 block w-full text-sm"
              />
            </label>
            <label className="block text-sm">
              Existing JOKO media URL
              <input
                value={draft.illustration.url}
                maxLength={1000}
                onChange={(e) =>
                  patch({
                    ...draft,
                    illustration: {
                      ...draft.illustration,
                      url: e.target.value,
                    },
                  })
                }
                className="mt-1 w-full rounded-lg border p-2 text-sm"
              />
            </label>
            <LocalizedFields
              label="Image description"
              value={draft.illustration.alt}
              maxLength={200}
              onChange={(alt) =>
                patch({
                  ...draft,
                  illustration: { ...draft.illustration, alt },
                })
              }
            />
          </section>
          <section className="joko-admin-paper-card space-y-4 p-5">
            <div className="flex flex-wrap justify-between gap-3">
              <h3 className="font-semibold">Question categories</h3>
              <button
                type="button"
                className="joko-admin-secondary-button flex items-center gap-2 px-3 py-2"
                disabled={draft.categories.length >= 20}
                onClick={() =>
                  patch({
                    ...draft,
                    categories: [
                      ...draft.categories,
                      {
                        id: crypto.randomUUID(),
                        name: blankText(),
                        section: "faq",
                        enabled: true,
                        order: draft.categories.length,
                      },
                    ],
                  })
                }
              >
                <Plus size={16} />
                Add category
              </button>
            </div>
            {!draft.categories.length && (
              <button
                type="button"
                className="joko-admin-secondary-button px-3 py-2"
                onClick={() => patch(starterAssistantContent())}
              >
                Load starter questions into this draft
              </button>
            )}
            {draft.categories.map((c) => (
              <div
                key={c.id}
                className="space-y-3 rounded-xl border border-[#d1d8cb] p-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-sm">
                    Section
                    <select
                      aria-label={`Section for ${c.name.en || c.id}`}
                      value={c.section}
                      onChange={(e) =>
                        updateCategory(c.id, {
                          section: e.target
                            .value as QuestionCategory["section"],
                        })
                      }
                      className="ml-2 rounded border p-2"
                    >
                      {assistantSections.map((s) => (
                        <option key={s} value={s}>
                          {sectionLabels[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    Order
                    <input
                      aria-label={`Order for ${c.name.en || c.id}`}
                      type="number"
                      min={-999999}
                      max={999999}
                      value={c.order}
                      onChange={(e) =>
                        updateCategory(c.id, { order: Number(e.target.value) })
                      }
                      className="ml-2 w-20 rounded border p-2"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={c.enabled}
                      onChange={(e) =>
                        updateCategory(c.id, { enabled: e.target.checked })
                      }
                    />
                    Enabled
                  </label>
                  <button
                    type="button"
                    className="text-sm underline"
                    onClick={() => {
                      if (draft.questions.some((q) => q.categoryId === c.id)) {
                        setError(
                          "Move or remove the questions in this category first.",
                        );
                        return;
                      }
                      patch({
                        ...draft,
                        categories: draft.categories.filter(
                          (v) => v.id !== c.id,
                        ),
                      });
                    }}
                  >
                    Remove category
                  </button>
                </div>
                <LocalizedFields
                  label="Category name"
                  value={c.name}
                  maxLength={100}
                  onChange={(name) => updateCategory(c.id, { name })}
                />
              </div>
            ))}
          </section>
          <section className="joko-admin-paper-card space-y-4 p-5">
            <div className="flex flex-wrap justify-between gap-3">
              <h3 className="font-semibold">Questions & answers</h3>
              <button
                type="button"
                className="joko-admin-secondary-button flex items-center gap-2 px-3 py-2"
                disabled={
                  !draft.categories.length || draft.questions.length >= 200
                }
                onClick={() => {
                  const id = crypto.randomUUID();
                  patch({
                    ...draft,
                    questions: [
                      ...draft.questions,
                      {
                        id,
                        categoryId: draft.categories[0].id,
                        question: blankText(),
                        answer: blankText(),
                        aliases: { en: [], th: [], zh: [] },
                        links: [],
                        enabled: false,
                        order: draft.questions.length,
                        ingredientsConfirmed: false,
                      },
                    ],
                  });
                  setSelected(id);
                }}
              >
                <Plus size={16} />
                Add question
              </button>
            </div>
            <label className="block text-sm">
              Choose question
              <select
                aria-label="Choose question"
                value={selectedQuestion ? selected : ""}
                onChange={(e) => setSelected(e.target.value)}
                className="mt-1 w-full rounded border p-2"
              >
                <option value="">Select a question…</option>
                {draft.questions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.question.en ||
                      q.question.th ||
                      q.question.zh ||
                      "Untitled question"}
                    {q.enabled ? "" : " · draft / hidden"}
                  </option>
                ))}
              </select>
            </label>
            {selectedQuestion && (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-sm">
                    Category
                    <select
                      value={selectedQuestion.categoryId}
                      onChange={(e) =>
                        updateQuestion({
                          categoryId: e.target.value,
                          ingredientsConfirmed: false,
                        })
                      }
                      className="ml-2 rounded border p-2"
                    >
                      {draft.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name.en || c.name.th || c.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    Order
                    <input
                      aria-label="Question order"
                      type="number"
                      min={-999999}
                      max={999999}
                      value={selectedQuestion.order}
                      onChange={(e) =>
                        updateQuestion({ order: Number(e.target.value) })
                      }
                      className="ml-2 w-20 rounded border p-2"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedQuestion.enabled}
                      onChange={(e) =>
                        updateQuestion({ enabled: e.target.checked })
                      }
                    />
                    Enabled when published
                  </label>
                </div>
                <LocalizedFields
                  label="Question"
                  value={selectedQuestion.question}
                  maxLength={300}
                  onChange={(question) =>
                    updateQuestion({ question, ingredientsConfirmed: false })
                  }
                />
                {selectedCategory?.section === "live" ? (
                  <p className="rounded-lg bg-[#edf2e9] p-3 text-sm">
                    This question is sent to the live inventory assistant in the
                    selected language. No saved stock or pickup answer is
                    published.
                  </p>
                ) : (
                  <>
                    <LocalizedFields
                      label="Approved answer"
                      value={selectedQuestion.answer}
                      multiline
                      maxLength={4000}
                      onChange={(answer) =>
                        updateQuestion({ answer, ingredientsConfirmed: false })
                      }
                    />
                    <LocalizedFields
                      label="Alternative wording (one per line)"
                      value={{
                        en: selectedQuestion.aliases.en.join("\n"),
                        th: selectedQuestion.aliases.th.join("\n"),
                        zh: selectedQuestion.aliases.zh.join("\n"),
                      }}
                      multiline
                      maxLength={3000}
                      onChange={(value) =>
                        updateQuestion({
                          aliases: {
                            en: value.en.split("\n").filter(Boolean),
                            th: value.th.split("\n").filter(Boolean),
                            zh: value.zh.split("\n").filter(Boolean),
                          },
                        })
                      }
                    />
                    <p className="text-xs">
                      An exact question or alias opens the saved answer without
                      an AI request. Keep aliases specific and unique.
                    </p>
                  </>
                )}
                {selectedCategory?.section === "guide" && (
                  <label className="flex items-start gap-2 rounded-lg border border-[#c7b58f] p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedQuestion.ingredientsConfirmed}
                      onChange={(e) =>
                        updateQuestion({
                          ingredientsConfirmed: e.target.checked,
                        })
                      }
                    />
                    I have confirmed this product and ingredient information
                    with the maker. Unconfirmed product guidance is hidden.
                  </label>
                )}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">
                    Related pages or products
                  </h4>
                  {selectedQuestion.links.map((link, index) => (
                    <div
                      key={index}
                      className="space-y-2 rounded-lg border p-3"
                    >
                      <label className="block text-sm">
                        JOKO page path
                        <input
                          aria-label={`Related path ${index + 1}`}
                          value={link.path}
                          maxLength={200}
                          placeholder="/products/croissant"
                          onChange={(e) =>
                            updateQuestion({
                              links: selectedQuestion.links.map((v, n) =>
                                n === index
                                  ? { ...v, path: e.target.value }
                                  : v,
                              ),
                              ingredientsConfirmed: false,
                            })
                          }
                          className="mt-1 w-full rounded border p-2"
                        />
                      </label>
                      <LocalizedFields
                        label={`Link label ${index + 1}`}
                        value={link.label}
                        maxLength={100}
                        onChange={(label) =>
                          updateQuestion({
                            links: selectedQuestion.links.map((v, n) =>
                              n === index ? { ...v, label } : v,
                            ),
                          })
                        }
                      />
                      <button
                        type="button"
                        className="text-sm underline"
                        onClick={() =>
                          updateQuestion({
                            links: selectedQuestion.links.filter(
                              (_, n) => n !== index,
                            ),
                            ingredientsConfirmed: false,
                          })
                        }
                      >
                        Remove link
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={selectedQuestion.links.length >= 6}
                    className="joko-admin-secondary-button px-3 py-2"
                    onClick={() =>
                      updateQuestion({
                        links: [
                          ...selectedQuestion.links,
                          { path: "/products", label: blankText() },
                        ],
                        ingredientsConfirmed: false,
                      })
                    }
                  >
                    Add related page
                  </button>
                </div>
                <button
                  type="button"
                  className="text-sm text-red-700 underline"
                  onClick={() => {
                    if (
                      window.confirm("Remove this question from the draft?")
                    ) {
                      patch({
                        ...draft,
                        questions: draft.questions.filter(
                          (q) => q.id !== selected,
                        ),
                      });
                      setSelected("");
                    }
                  }}
                >
                  Remove question from draft
                </button>
              </>
            )}
          </section>
        </fieldset>
      )}
      {preview && draft && (
        <>
          <p className="text-sm">
            Private draft preview: click Ask JOKO below. Saved answers are
            local; live questions use the configured AI service.
          </p>
          <AssistantWidget
            previewContent={draft}
            onNavigate={() => {
              setNotice("Related links open on the public site.");
            }}
          />
        </>
      )}
    </div>
  );
}
