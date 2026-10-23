import { useEffect, useState } from "react";
import { useLanguage } from "../../../context/LanguageContext";
import DiyPage from "./DiyPage";
import { loadDiyPageContent } from "./contentService";
import type { DiyPageContent } from "./content";
import { listRecipes } from "./recipe/service";
import type { StoredRecipe } from "./recipe/model";
import { diyCopy } from "./copy";

export default function DiyPageWithContent({
  onNavigate,
}: {
  onNavigate: (page: string) => void;
}) {
  const { language } = useLanguage();
  const [recipes, setRecipes] = useState<StoredRecipe[]>([]);
  useEffect(() => {
    let disposed = false;
    listRecipes()
      .then((r) => {
        if (!disposed) setRecipes(r);
      })
      .catch(() => {});
    return () => {
      disposed = true;
    };
  }, []);
  const [content, setContent] = useState<DiyPageContent | null>(null);
  useEffect(() => {
    let disposed = false;
    let request = 0;
    const refresh = async () => {
      const current = ++request;
      try {
        const next = await loadDiyPageContent();
        if (!disposed && current === request) setContent(next);
      } catch {
        /* Keep the last saved copy, or bundled defaults when offline. */
      }
    };
    void refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("joko-diy-content-updated", refresh);
    return () => {
      disposed = true;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("joko-diy-content-updated", refresh);
    };
  }, []);
  return (
    <DiyPage
      collection={recipes.map((r) => ({
        id: r.id,
        publishedSlug: r.slug,
        photoKind: r.payload.hero.kind,
        title: r.payload.title[language],
        description: r.payload.intro[language],
        category: r.payload.category,
        image: r.payload.hero.url,
        reviewStatus: "preview",
        source: {
          creator: r.payload.source.creator,
          platform: r.payload.source.platform,
          url: r.payload.source.url,
          youtubeId: "",
        },
      }))}
      onNavigate={onNavigate}
      content={
        content ? { ...diyCopy[language], ...content[language] } : undefined
      }
    />
  );
}
