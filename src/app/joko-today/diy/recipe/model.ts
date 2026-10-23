export const languages = ["en", "th", "zh"] as const;
export type RecipeLanguage = (typeof languages)[number];
export type Localized = Record<RecipeLanguage, string>;
export interface Ingredient {
  id: string;
  name: Localized;
  amount: string | null;
  unit: string | null;
  group: Localized;
}
export interface RecipeStep {
  id: string;
  title: Localized;
  instruction: Localized;
}
export interface RecipeRecord {
  schema_version: "joko.recipe.v1";
  slug: string;
  title: Localized;
  intro: Localized;
  category: "bread" | "buns" | "cakes" | "cookies" | "pastries";
  source: {
    creator: string;
    platform: "YouTube" | "TikTok" | "RedNote" | "Other";
    url: string;
    original_title: string;
    language: string;
  };
  hero: {
    url: string;
    alt: Localized;
    credit: string;
    permission: "pending" | "permitted";
    kind: "source-frame" | "photo" | "illustration";
  };
  yield: Localized;
  times: {
    prep_minutes: number | null;
    cook_minutes: number | null;
    rest_minutes: number | null;
    total_minutes: number | null;
  };
  difficulty: "easy" | "intermediate" | "advanced" | null;
  ingredients: Ingredient[];
  equipment: Localized[];
  method: RecipeStep[];
  notes: Localized[];
  joko_notes: Localized[];
  issues: {
    id: string;
    message: Localized;
    blocking: boolean;
    resolved: boolean;
  }[];
  evidence: {
    field: string;
    source_text: string;
    timecode: string | null;
    type: "spoken" | "onscreen" | "visual" | "editorial";
  }[];
}
export interface StoredRecipe {
  id: string;
  slug: string;
  payload: RecipeRecord;
  revision: number;
  updated_at: string;
}
const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
export function safeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
export function parseRecipe(input: unknown): RecipeRecord {
  const errors: string[] = [];
  function fields(
    x: unknown,
    keys: string[],
    path: string,
  ): x is Record<string, unknown> {
    if (!object(x)) {
      errors.push(`${path}: expected an object`);
      return false;
    }
    for (const key of Object.keys(x))
      if (!keys.includes(key)) errors.push(`${path}.${key}: unknown field`);
    for (const key of keys)
      if (!(key in x)) errors.push(`${path}.${key}: missing field`);
    return true;
  }
  function str(x: unknown, path: string, max = 4000) {
    if (typeof x !== "string" || x.length > max)
      errors.push(`${path}: expected text (up to ${max} characters)`);
  }
  function localized(x: unknown, path: string) {
    if (fields(x, [...languages], path))
      for (const lang of languages) str(x[lang], `${path}.${lang}`);
  }
  function choices(x: unknown, values: unknown[], path: string) {
    if (!values.includes(x)) errors.push(`${path}: unsupported value`);
  }
  function array(
    x: unknown,
    path: string,
    check: (v: unknown, p: string) => void,
    max = 100,
  ) {
    if (!Array.isArray(x) || x.length > max)
      errors.push(`${path}: expected array with at most ${max} entries`);
    else x.forEach((v, i) => check(v, `${path}[${i}]`));
  }
  const keys = [
    "schema_version",
    "slug",
    "title",
    "intro",
    "category",
    "source",
    "hero",
    "yield",
    "times",
    "difficulty",
    "ingredients",
    "equipment",
    "method",
    "notes",
    "joko_notes",
    "issues",
    "evidence",
  ];
  if (fields(input, keys, "recipe")) {
    choices(input.schema_version, ["joko.recipe.v1"], "schema_version");
    str(input.slug, "slug", 120);
    if (
      typeof input.slug === "string" &&
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)
    )
      errors.push("slug: use lowercase words separated by hyphens");
    for (const key of ["title", "intro", "yield"]) localized(input[key], key);
    choices(
      input.category,
      ["bread", "buns", "cakes", "cookies", "pastries"],
      "category",
    );
    choices(
      input.difficulty,
      ["easy", "intermediate", "advanced", null],
      "difficulty",
    );
    if (
      fields(
        input.source,
        ["creator", "platform", "url", "original_title", "language"],
        "source",
      )
    ) {
      for (const key of ["creator", "url", "original_title", "language"])
        str(input.source[key], `source.${key}`);
      choices(
        input.source.platform,
        ["YouTube", "TikTok", "RedNote", "Other"],
        "source.platform",
      );
      if (!safeHttpUrl(String(input.source.url)))
        errors.push("source.url: HTTPS source link required");
    }
    if (
      fields(input.hero, ["url", "alt", "credit", "permission", "kind"], "hero")
    ) {
      str(input.hero.url, "hero.url");
      str(input.hero.credit, "hero.credit");
      localized(input.hero.alt, "hero.alt");
      if (input.hero.url !== "" && !safeHttpUrl(String(input.hero.url)))
        errors.push("hero.url: use an HTTPS image URL");
      choices(
        input.hero.permission,
        ["pending", "permitted"],
        "hero.permission",
      );
      choices(
        input.hero.kind,
        ["source-frame", "photo", "illustration"],
        "hero.kind",
      );
    }
    if (
      fields(
        input.times,
        ["prep_minutes", "cook_minutes", "rest_minutes", "total_minutes"],
        "times",
      )
    )
      for (const [key, v] of Object.entries(input.times)) {
        if (
          v !== null &&
          (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100000)
        )
          errors.push(`times.${key}: expected minutes or null`);
      }
    array(input.ingredients, "ingredients", (v, p) => {
      if (fields(v, ["id", "name", "amount", "unit", "group"], p)) {
        str(v.id, `${p}.id`, 120);
        localized(v.name, `${p}.name`);
        localized(v.group, `${p}.group`);
        for (const key of ["amount", "unit"])
          if (v[key] !== null) str(v[key], `${p}.${key}`, 120);
      }
    });
    array(input.method, "method", (v, p) => {
      if (fields(v, ["id", "title", "instruction"], p)) {
        str(v.id, `${p}.id`, 120);
        localized(v.title, `${p}.title`);
        localized(v.instruction, `${p}.instruction`);
      }
    });
    for (const key of ["equipment", "notes", "joko_notes"])
      array(input[key], key, localized);
    array(input.issues, "issues", (v, p) => {
      if (fields(v, ["id", "message", "blocking", "resolved"], p)) {
        str(v.id, `${p}.id`, 120);
        localized(v.message, `${p}.message`);
        for (const k of ["blocking", "resolved"])
          if (typeof v[k] !== "boolean")
            errors.push(`${p}.${k}: expected true or false`);
      }
    });
    array(
      input.evidence,
      "evidence",
      (v, p) => {
        if (fields(v, ["field", "source_text", "timecode", "type"], p)) {
          str(v.field, `${p}.field`);
          str(v.source_text, `${p}.source_text`);
          if (v.timecode !== null) str(v.timecode, `${p}.timecode`);
          choices(
            v.type,
            ["spoken", "onscreen", "visual", "editorial"],
            `${p}.type`,
          );
        }
      },
      500,
    );
    for (const k of ["ingredients", "method", "issues"])
      if (Array.isArray(input[k])) {
        const ids = input[k].filter(object).map((v) => v.id);
        if (
          ids.some((id) => typeof id !== "string" || !id.trim()) ||
          new Set(ids).size !== ids.length
        )
          errors.push(`${k}: IDs must be nonempty and unique`);
      }
  }
  if (errors.length) throw new Error(errors.slice(0, 20).join("\n"));
  return input as RecipeRecord;
}
export function publishProblems(r: RecipeRecord): string[] {
  const problems: string[] = [];
  if (!r.ingredients.length || !r.method.length)
    problems.push("Ingredients and method are required.");
  for (const lang of languages) {
    if (
      ![r.title[lang], r.intro[lang], r.hero.alt[lang]].every((v) => v.trim())
    )
      problems.push(`Complete title, intro and image description (${lang}).`);
    if (
      r.ingredients.some((i) => !i.name[lang].trim()) ||
      r.method.some((s) => !s.title[lang].trim() || !s.instruction[lang].trim())
    )
      problems.push(`Complete ingredients and steps (${lang}).`);
  }
  if (!r.hero.url || r.hero.permission !== "permitted" || !r.hero.credit.trim())
    problems.push("Add an approved hero image and image credit.");
  if (!r.source.creator.trim()) problems.push("Original creator is required.");
  if (r.issues.some((i) => i.blocking && !i.resolved))
    problems.push("Resolve blocking source issues before publishing.");
  return problems;
}
export function youtubeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const id =
      host === "youtu.be"
        ? u.pathname.slice(1)
        : ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)
          ? u.searchParams.get("v") ||
            u.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1]
          : null;
    return id && /^[\w-]{11}$/.test(id)
      ? `https://www.youtube-nocookie.com/embed/${id}?playsinline=1`
      : null;
  } catch {
    return null;
  }
}
