import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  CalendarCheck,
  Image,
  Leaf,
  Lightbulb,
  MousePointer2,
  NotebookText,
  X,
} from "lucide-react";
import { useLanguage } from "../../../context/LanguageContext";
import { usePublishedJokoBranding } from "../builder/usePublishedJokoLogo";
import { jokoBrandingCssVariables } from "../../../platform/builder/branding";
import { loadAssistantContent } from "../../../lib/assistantContentService";
import { assistantCopy } from "./copy";
import {
  assistantLanguages,
  assistantSections,
  fallbackAssistantContent,
  matchSavedQuestion,
  searchSavedQuestions,
  visibleQuestions,
  type AssistantContent,
  type AssistantLanguage as Language,
  type AssistantSection,
  type CuratedQuestion,
} from "./content";
import "./assistant.css";

type Product = {
  id: string;
  name: Record<Language, string>;
  price: number;
  product_url: string;
  pickups: {
    pickup_date: string;
    remaining_quantity: number;
    order_cutoff_local?: string;
    locations: { id: string; name: Record<Language, string> }[];
  }[];
};
type Message = {
  language: Language;
  role: "user" | "assistant";
  text: string;
  products?: Product[];
  checkedAt?: string;
  links?: CuratedQuestion["links"];
  suggestions?: CuratedQuestion[];
  liveAction?: boolean;
};
async function request(
  path: string,
  body: object,
  signal: AbortSignal,
  method = "POST",
) {
  const response = await fetch(`/api/assistant/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
    credentials: "omit",
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      typeof result.error === "string" ? result.error : "unavailable",
    );
  return result;
}
function safeProducts(value: unknown): Product[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 10).filter((p): p is Product => {
    if (
      !p ||
      typeof p !== "object" ||
      typeof p.id !== "string" ||
      !assistantLanguages.every((l) => typeof p.name?.[l] === "string") ||
      typeof p.price !== "number" ||
      !Number.isFinite(p.price) ||
      p.price < 0 ||
      !Array.isArray(p.pickups)
    )
      return false;
    try {
      const url = new URL(p.product_url);
      return (
        url.origin === "https://joko.today" &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        /^\/products\/[a-zA-Z0-9_-]+$/.test(url.pathname) &&
        p.pickups.every(
          (s: Product["pickups"][number]) =>
            /^\d{4}-\d{2}-\d{2}$/.test(s.pickup_date) &&
            Number.isSafeInteger(s.remaining_quantity) &&
            s.remaining_quantity >= 0 &&
            (!s.order_cutoff_local ||
              /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s.order_cutoff_local)) &&
            Array.isArray(s.locations) &&
            s.locations.every(
              (l) =>
                typeof l.id === "string" &&
                assistantLanguages.every(
                  (k) => typeof l.name?.[k] === "string",
                ),
            ),
        )
      );
    } catch {
      return false;
    }
  });
}
const icons = {
  faq: NotebookText,
  curious: Lightbulb,
  guide: Leaf,
  live: CalendarCheck,
};
export default function AssistantWidget({
  onNavigate,
  previewContent,
}: {
  onNavigate: (page: string) => void;
  previewContent?: AssistantContent;
}) {
  const { language: siteLanguage } = useLanguage();
  const { branding } = usePublishedJokoBranding();
  const [language, setLanguage] = useState<Language>(
    assistantLanguages.includes(siteLanguage as Language)
      ? (siteLanguage as Language)
      : "en",
  );
  const [open, setOpen] = useState(false),
    [section, setSection] = useState<AssistantSection>("faq"),
    [category, setCategory] = useState("");
  const [content, setContent] = useState<AssistantContent>(
    previewContent ?? fallbackAssistantContent,
  );
  const [contentError, setContentError] = useState(false),
    [loadingContent, setLoadingContent] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]),
    [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false);
  const sessions = useRef<Partial<Record<Language, string>>>({}),
    controller = useRef<AbortController>(),
    busyRef = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null),
    launcher = useRef<HTMLButtonElement>(null),
    log = useRef<HTMLDivElement>(null);
  const text = assistantCopy[language],
    shownMessages = messages.filter((m) => m.language === language);
  const hasMessages = shownMessages.length > 0;
  const questions = visibleQuestions(content, language, section);
  const categories = content.categories
    .filter(
      (c) =>
        c.section === section &&
        c.enabled &&
        c.name[language].trim() &&
        questions.some((q) => q.categoryId === c.id),
    )
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const selectedCategory = categories.some((c) => c.id === category)
    ? category
    : (categories[0]?.id ?? "");
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!open || previewContent) return;
    let active = true;
    setLoadingContent(true);
    void loadAssistantContent()
      .then((value) => {
        if (active) {
          setContent(value ?? fallbackAssistantContent);
          setContentError(false);
        }
      })
      .catch(() => {
        if (active) setContentError(true);
      })
      .finally(() => {
        if (active) setLoadingContent(false);
      });
    return () => {
      active = false;
    };
  }, [open, previewContent]);
  useEffect(() => {
    if (previewContent) setContent(previewContent);
  }, [previewContent]);
  useEffect(() => {
    if (open && !busy) input.current?.focus();
  }, [open, busy]);
  useEffect(() => {
    if (log.current && hasMessages)
      log.current.scrollTop = log.current.scrollHeight;
  }, [messages, busy, open, language, hasMessages]);
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => launcher.current?.focus());
  };
  const append = (...items: Message[]) =>
    setMessages((previous) => [...previous, ...items].slice(-80));
  function showSaved(q: CuratedQuestion) {
    if (busyRef.current) return;
    append(
      { language, role: "user", text: q.question[language] },
      { language, role: "assistant", text: q.answer[language], links: q.links },
    );
    setDraft("");
  }
  async function send(value = draft, forceLive = false) {
    const message = value.trim();
    if (!message || message.length > 1000 || busyRef.current) return;
    const saved = !forceLive && matchSavedQuestion(content, language, message);
    if (saved) {
      showSaved(saved);
      return;
    }
    if (!forceLive && section !== "live") {
      append(
        { language, role: "user", text: message },
        {
          language,
          role: "assistant",
          text: text.noMatch,
          suggestions: searchSavedQuestions(content, language, message),
          liveAction: true,
        },
      );
      setDraft("");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setDraft("");
    append({ language, role: "user", text: message });
    const abort = new AbortController();
    controller.current = abort;
    const timeout = window.setTimeout(() => abort.abort(), 85000);
    try {
      if (!sessions.current[language]) {
        const created = await request("session", {}, abort.signal);
        if (typeof created.sessionId !== "string") throw Error("unavailable");
        sessions.current[language] = created.sessionId;
      }
      const result = await request(
        "messages",
        {
          sessionId: sessions.current[language],
          clientRequestId: crypto.randomUUID(),
          message,
          language,
        },
        abort.signal,
      );
      if (typeof result.answer !== "string" || result.answer.length > 4000)
        throw Error("unavailable");
      append({
        language,
        role: "assistant",
        text: result.answer,
        products: safeProducts(result.products),
        checkedAt:
          typeof result.checked_at === "string" ? result.checked_at : undefined,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      append({
        language,
        role: "assistant",
        text:
          code === "session_expired" || code === "session_limit"
            ? text.expired
            : code === "budget_exhausted" || code === "assistant_disabled"
              ? text.budget
              : text.error,
      });
    } finally {
      window.clearTimeout(timeout);
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function clear() {
    if (busyRef.current) return;
    const token = sessions.current[language];
    if (token) {
      busyRef.current = true;
      setBusy(true);
      try {
        await request(
          "session",
          { sessionId: token },
          AbortSignal.timeout(5000),
          "DELETE",
        );
      } catch {
        /* Drop local state even after an expired session. */
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    }
    delete sessions.current[language];
    setMessages((previous) => previous.filter((m) => m.language !== language));
    setDraft("");
    input.current?.focus();
  }
  const chooseSection = (value: AssistantSection) => {
    setSection(value);
    setCategory("");
  };
  return (
    <div
      className="joko-assistant"
      lang={language === "zh" ? "zh-CN" : language}
      style={jokoBrandingCssVariables(branding, language)}
    >
      <button
        hidden={open}
        ref={launcher}
        type="button"
        className="joko-assistant-launcher"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {text.title}
      </button>
      {open && (
        <section
          role="dialog"
          aria-labelledby="joko-assistant-title"
          className="joko-assistant-panel"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          }}
        >
          <header className="joko-assistant-top">
            <div>
              <p>JOKO TODAY</p>
              <h2 id="joko-assistant-title">{text.title}</h2>
            </div>
            <div className="joko-assistant-header-actions">
              <select
                aria-label={
                  language === "th"
                    ? "ภาษา"
                    : language === "zh"
                      ? "语言"
                      : "Language"
                }
                value={language}
                disabled={busy}
                onChange={(event) => {
                  setLanguage(event.target.value as Language);
                  setDraft("");
                }}
              >
                <option value="en">English</option>
                <option value="th">ไทย</option>
                <option value="zh">简体中文</option>
              </select>
              <button type="button" onClick={close} aria-label={text.close}>
                <X size={19} />
              </button>
            </div>
          </header>
          <div className="joko-assistant-scroll" ref={log}>
            <div className="joko-assistant-welcome">
              <div>
                <h3>
                  {text.help}
                  <br />
                  {text.curiosityLead}
                  <em>{text.curiosity}</em>
                </h3>
                <p>{text.welcome}</p>
              </div>
              <div className="joko-assistant-illustration">
                {content.illustration.url ? (
                  <img
                    src={content.illustration.url}
                    alt={content.illustration.alt[language]}
                    referrerPolicy="no-referrer"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <>
                    <Image size={28} aria-hidden="true" />
                    <span>{text.picture}</span>
                  </>
                )}
              </div>
            </div>
            <nav className="joko-assistant-tabs" aria-label={text.category}>
              {assistantSections.map((s) => {
                const Icon = icons[s];
                return (
                  <button
                    type="button"
                    key={s}
                    aria-pressed={section === s}
                    disabled={busy}
                    onClick={() => chooseSection(s)}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>
                      <strong>{text[s]}</strong>
                      <small>{text[`${s}Sub`]}</small>
                    </span>
                  </button>
                );
              })}
            </nav>
            <div className="joko-assistant-topics">
              <div className="joko-assistant-topic-title">
                <label htmlFor="joko-assistant-category">{text.category}</label>
                <span className={section === "live" ? "is-live" : ""}>
                  {section === "live" ? text.liveTag : text.curated}
                </span>
              </div>
              {categories.length > 0 && (
                <select
                  id="joko-assistant-category"
                  value={selectedCategory}
                  disabled={busy}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name[language]}
                    </option>
                  ))}
                </select>
              )}
              {loadingContent && (
                <p className="joko-assistant-secondary" role="status">
                  {text.loading}
                </p>
              )}
              {contentError && (
                <p className="joko-assistant-secondary">
                  {text.unavailableContent}
                </p>
              )}
              {section === "guide" && (
                <p className="joko-assistant-secondary">{text.guideNotice}</p>
              )}
              {section === "live" && (
                <p className="joko-assistant-secondary">
                  {text.liveDescription}
                </p>
              )}
              {!questions.length && !loadingContent && (
                <p className="joko-assistant-secondary">{text.empty}</p>
              )}
              {questions
                .filter((q) => q.categoryId === selectedCategory)
                .map((q) =>
                  section === "live" ? (
                    <button
                      type="button"
                      className="joko-assistant-sample"
                      key={q.id}
                      disabled={busy}
                      onClick={() => void send(q.question[language], true)}
                    >
                      ↗ {q.question[language]}
                    </button>
                  ) : (
                    <details
                      className="joko-assistant-question"
                      key={`${language}-${q.id}`}
                    >
                      <summary>{q.question[language]}</summary>
                      <p>{q.answer[language]}</p>
                      {q.links
                        .filter((l) => l.label[language].trim())
                        .map((l) => (
                          <a key={l.path} href={l.path} onClick={close}>
                            {l.label[language]}
                          </a>
                        ))}
                    </details>
                  ),
                )}
              {questions.length > 0 && (
                <p className="joko-assistant-hint">
                  <MousePointer2 size={14} aria-hidden="true" />
                  {text.hint}
                </p>
              )}
            </div>
            <div
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              className="joko-assistant-log"
            >
              {shownMessages.map((m, index) => (
                <div
                  key={`${language}-${index}`}
                  className={`joko-assistant-message ${m.role}`}
                >
                  <p>{m.text}</p>
                  {m.links
                    ?.filter((l) => l.label[language].trim())
                    .map((l) => (
                      <a key={l.path} href={l.path} onClick={close}>
                        {l.label[language]}
                      </a>
                    ))}
                  {m.suggestions?.map((q) => (
                    <button
                      type="button"
                      key={q.id}
                      disabled={busy}
                      onClick={() => showSaved(q)}
                    >
                      {q.question[language]}
                    </button>
                  ))}
                  {m.liveAction && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => chooseSection("live")}
                    >
                      {text.liveAction}
                    </button>
                  )}
                  {m.products?.map((product) => (
                    <article
                      key={product.id}
                      className="joko-assistant-product"
                    >
                      <strong>{product.name[language] || text.unnamed}</strong>
                      <span>
                        {new Intl.NumberFormat(
                          language === "th"
                            ? "th-TH"
                            : language === "zh"
                              ? "zh-CN"
                              : "en-US",
                          { style: "currency", currency: "THB" },
                        ).format(product.price)}
                      </span>
                      {product.pickups.length ? (
                        product.pickups.map((p) => (
                          <p key={p.pickup_date}>
                            {p.pickup_date} · {p.remaining_quantity}{" "}
                            {text.remaining} ·{" "}
                            {p.locations
                              .map((l) => l.name[language] || text.location)
                              .join(", ")}
                            {p.order_cutoff_local && (
                              <small>
                                {text.cutoff} {p.order_cutoff_local} (UTC+7)
                              </small>
                            )}
                          </p>
                        ))
                      ) : (
                        <p>{text.unavailable}</p>
                      )}
                      <a
                        href={new URL(product.product_url).pathname}
                        onClick={close}
                      >
                        {text.open}
                      </a>
                    </article>
                  ))}
                  {m.checkedAt && Number.isFinite(Date.parse(m.checkedAt)) && (
                    <small>
                      {text.checked}:{" "}
                      {new Date(m.checkedAt).toLocaleString(
                        language === "th"
                          ? "th-TH"
                          : language === "zh"
                            ? "zh-CN"
                            : "en-GB",
                        { timeZone: "Asia/Bangkok" },
                      )}
                    </small>
                  )}
                </div>
              ))}
              {busy && <p role="status">{text.wait}</p>}
            </div>
          </div>
          <div className="joko-assistant-bottom">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <label className="sr-only" htmlFor="joko-assistant-input">
                {text.placeholder}
              </label>
              <textarea
                ref={input}
                id="joko-assistant-input"
                value={draft}
                maxLength={1000}
                rows={1}
                placeholder={text.placeholder}
                onChange={(e) => setDraft(e.target.value)}
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy || !draft.trim()}
                aria-label={text.send}
              >
                <ArrowUp size={18} />
              </button>
            </form>
            <p className="joko-assistant-secondary">{text.privacy}</p>
            <footer>
              <button
                type="button"
                onClick={() => {
                  close();
                  onNavigate("products");
                }}
              >
                {text.browse}
              </button>
              <a href="#joko-contact" onClick={close}>
                {text.contact}
              </a>
              <button
                type="button"
                disabled={busy}
                onClick={() => void clear()}
              >
                {text.clear}
              </button>
            </footer>
          </div>
        </section>
      )}
    </div>
  );
}
