import { useEffect, useRef, useState } from "react";
import {
  getMakers,
  saveMaker,
  type Maker,
  type MakerDraft,
} from "../lib/makersService";
import { Upload, Eye } from "lucide-react";
import { MakerProfile } from "./MakerProfile";
import { supabase } from "../lib/supabase";
import type { CMSProduct } from "../lib/cmsService";
import { uploadGalleryImage } from "../lib/mediaService";

const emptyDraft = (): MakerDraft => ({
  slug: "",
  name_en: "",
  name_th: "",
  name_zh: "",
  intro_en: "",
  intro_th: "",
  intro_zh: "",
  story_en: "",
  story_th: "",
  story_zh: "",
  joko_note_en: "",
  joko_note_th: "",
  joko_note_zh: "",
  location: "",
  hero_image: null,
  website_url: null,
  is_published: false,
  show_on_homepage: false,
  is_ordering_enabled: false,
  sort_order: 0,
});

export function MakersManagement() {
  const [makers, setMakers] = useState<Maker[]>([]);
  const [draft, setDraft] = useState<MakerDraft>(emptyDraft);
  const [id, setId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const uploadInput = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLanguage, setPreviewLanguage] = useState<"en" | "th" | "zh">(
    "en",
  );
  const [previewProducts, setPreviewProducts] = useState<CMSProduct[]>([]);
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  useEffect(() => {
    let active = true;
    setPreviewProducts([]);
    setPreviewError("");
    setPreviewLoading(false);
    if (!previewOpen || !id) return;
    setPreviewLoading(true);
    void supabase
      .from("cms_products")
      .select("*")
      .eq("maker_id", id)
      .order("sort_order")
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) setPreviewError("Could not load assigned products.");
        else setPreviewProducts((data || []) as CMSProduct[]);
        setPreviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, previewOpen]);
  const load = async () => {
    try {
      setMakers(await getMakers(true));
    } catch {
      setError(
        "Could not load Makers. Apply the Makers migration before using this editor.",
      );
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const start = (maker?: Maker) => {
    setId(maker?.id);
    setDraft(maker ? { ...maker } : emptyDraft());
    setNotice("");
    setError("");
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = Object.fromEntries(
        Object.entries(draft).filter(
          ([key]) => !["id", "created_at", "updated_at"].includes(key),
        ),
      ) as MakerDraft;
      const saved = await saveMaker(payload, id);
      setId(saved.id);
      setNotice("Maker saved.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save Maker. Check the slug, required fields and publication settings.",
      );
    } finally {
      setBusy(false);
    }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const image = await uploadGalleryImage({
        file,
        gallerySlot: `maker-${draft.slug || "draft"}`,
      });
      setDraft((current) => ({ ...current, hero_image: image.publicUrl }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <p className="joko-admin-eyebrow">Catalogue & editorial</p>
      <h1 className="joko-admin-title text-3xl">JOKO Makers</h1>
      <p className="mt-3 text-sm">
        Create a maker profile, then assign products in the existing product
        editor. Publishing and enabling orders are separate choices.
      </p>
      {error && (
        <p role="alert" className="my-4 rounded-xl bg-red-50 p-4 text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="my-4 text-[#304B45]">
          {notice}
        </p>
      )}
      <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_1fr]">
        <aside className="space-y-2">
          <button
            className="joko-admin-primary-button w-full p-3"
            disabled={busy}
            onClick={() => start()}
          >
            New maker
          </button>
          {makers.map((maker) => (
            <button
              key={maker.id}
              disabled={busy}
              onClick={() => start(maker)}
              className="block w-full rounded-xl border border-[#55766F]/20 bg-[#FFF9EE] p-3 text-left"
            >
              <strong>{maker.name_en}</strong>
              <span className="block text-xs">
                {maker.is_published ? "Published" : "Draft"} ·{" "}
                {maker.is_ordering_enabled ? "Orders enabled" : "Preview only"}
              </span>
            </button>
          ))}
        </aside>
        <form
          onSubmit={save}
          className="space-y-5 rounded-3xl bg-[#FFF9EE] p-5 sm:p-8"
        >
          <fieldset disabled={busy} className="space-y-5">
            <label className="block text-sm">
              Slug
              <input
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                value={draft.slug}
                onChange={(event) =>
                  setDraft({ ...draft, slug: event.target.value })
                }
                className="mt-1 w-full rounded-xl border p-3"
              />
            </label>
            {(["en", "th", "zh"] as const).map((locale) => (
              <fieldset
                key={locale}
                className="space-y-3 border-t border-[#55766F]/20 pt-4"
              >
                <legend className="font-semibold">
                  {locale.toUpperCase()}
                </legend>
                {(["name", "intro", "story", "joko_note"] as const).map(
                  (field) => {
                    const key = `${field}_${locale}` as const;
                    return (
                      <label key={key} className="block text-sm">
                        {field === "joko_note"
                          ? "Why JOKO picked them"
                          : field === "name"
                            ? "Name"
                            : field === "intro"
                              ? "Short introduction"
                              : "Story"}
                        <textarea
                          rows={
                            field === "name" ? 1 : field === "story" ? 5 : 2
                          }
                          required={field === "name" && locale !== "zh"}
                          value={draft[key] || ""}
                          onChange={(event) =>
                            setDraft({ ...draft, [key]: event.target.value })
                          }
                          className="mt-1 w-full rounded-xl border p-3"
                        />
                      </label>
                    );
                  },
                )}
              </fieldset>
            ))}
            <label className="block text-sm">
              Location
              <input
                value={draft.location}
                onChange={(event) =>
                  setDraft({ ...draft, location: event.target.value })
                }
                className="mt-1 w-full rounded-xl border p-3"
              />
            </label>
            <label className="block text-sm">
              Website URL
              <input
                type="url"
                value={draft.website_url || ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    website_url: event.target.value || null,
                  })
                }
                className="mt-1 w-full rounded-xl border p-3"
              />
            </label>
            <label className="block text-sm">
              Hero image URL
              <input
                type="url"
                value={draft.hero_image || ""}
                onChange={(event) =>
                  setDraft({ ...draft, hero_image: event.target.value || null })
                }
                className="mt-1 w-full rounded-xl border p-3"
              />
            </label>
            <div className="rounded-2xl border-2 border-[#55766F]/30 bg-[#D5E8E2]/40 p-4">
              <input
                ref={uploadInput}
                type="file"
                aria-label="Choose maker image"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  void upload(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => uploadInput.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#304B45] px-5 py-3 font-semibold text-white shadow-sm hover:bg-[#243A35] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#304B45]"
              >
                <Upload className="h-5 w-5" aria-hidden="true" /> Upload image
              </button>
              <p className="mt-2 text-sm text-[#304B45]">
                Choose a JPG, PNG or WebP for this maker’s profile.
              </p>
            </div>
            {draft.hero_image && (
              <img
                src={draft.hero_image}
                alt={draft.name_en || "Maker image preview"}
                className="max-h-64 w-full rounded-2xl object-cover"
              />
            )}
            <label className="block text-sm">
              Display order
              <input
                type="number"
                min="0"
                step="1"
                value={draft.sort_order}
                onChange={(event) =>
                  setDraft({ ...draft, sort_order: Number(event.target.value) })
                }
                className="ml-3 w-24 rounded-xl border p-2"
              />
            </label>
            {(
              [
                "is_published",
                "show_on_homepage",
                "is_ordering_enabled",
              ] as const
            ).map((key) => (
              <label key={key} className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={draft[key]}
                  onChange={(event) =>
                    setDraft({ ...draft, [key]: event.target.checked })
                  }
                />
                {key === "is_published"
                  ? "Publish maker profile"
                  : key === "show_on_homepage"
                    ? "Feature on homepage"
                    : "Enable customer orders (requires published profile, dated capacity and verified online payment)"}
              </label>
            ))}
            <p className="text-xs text-[#303532]/70">
              Leave orders disabled until the mixed-basket checkout and
              sourcing/refund process are validated. Unpublishing a maker
              requires disabling orders first.
            </p>
            {id && draft.is_published && (
              <a
                href={`/makers/${encodeURIComponent(draft.slug)}`}
                target="_blank"
                rel="noreferrer"
                className="block text-sm underline"
              >
                Open published profile
              </a>
            )}
            <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              aria-expanded={previewOpen}
              aria-controls="maker-admin-preview"
              onClick={() => setPreviewOpen(!previewOpen)}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-[#55766F] bg-white px-5 py-3 font-semibold text-[#304B45]"
            >
              <Eye className="h-5 w-5" aria-hidden="true" />{" "}
              {previewOpen ? "Hide preview" : "Preview maker"}
            </button>
            <button
              type="submit"
              className="joko-admin-primary-button px-6 py-3"
            >
              {busy ? "Saving…" : "Save maker"}
            </button>
            </div>
          </fieldset>
        </form>
      </div>
      {previewOpen && (
        <section
          id="maker-admin-preview"
          aria-label="Maker draft preview"
          className="mt-8 rounded-3xl border-2 border-[#55766F]/30 bg-[#FFF9EE] p-4 sm:p-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Draft preview</h2>
              <p className="mt-2 text-sm">
                Shows your current edits, including unsaved changes. Assigned
                products may be inactive. This preview does not publish or
                enable orders.
              </p>
            </div>
            <label className="text-sm">
              Preview language{" "}
              <select
                value={previewLanguage}
                onChange={(event) =>
                  setPreviewLanguage(event.target.value as "en" | "th" | "zh")
                }
                className="rounded-lg border p-2"
              >
                <option value="en">EN</option>
                <option value="th">TH</option>
                <option value="zh">ZH</option>
              </select>
            </label>
          </div>
          {previewError && (
            <p role="alert" className="mt-4 text-red-700">
              {previewError}
            </p>
          )}
          {previewLoading && (
            <p role="status" className="mt-4">
              Loading assigned products…
            </p>
          )}
          <MakerProfile
            maker={{ ...draft, id: id || "unsaved-maker" }}
            products={previewProducts}
            preview
            previewLanguage={previewLanguage}
          />
        </section>
      )}
    </section>
  );
}
