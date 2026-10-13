export type AssistantLanguage = "en" | "th" | "zh";
export type AssistantSection = "faq" | "curious" | "guide" | "live";
export type Localized = Record<AssistantLanguage, string>;
export const assistantLanguages: AssistantLanguage[] = ["en", "th", "zh"];
export const assistantSections: AssistantSection[] = [
  "faq",
  "curious",
  "guide",
  "live",
];
export const blankText = (): Localized => ({ en: "", th: "", zh: "" });
export type QuestionCategory = {
  id: string;
  section: AssistantSection;
  name: Localized;
  enabled: boolean;
  order: number;
};
export type CuratedQuestion = {
  id: string;
  categoryId: string;
  question: Localized;
  answer: Localized;
  aliases: Record<AssistantLanguage, string[]>;
  links: { label: Localized; path: string }[];
  enabled: boolean;
  order: number;
  ingredientsConfirmed: boolean;
};
export type AssistantContent = {
  schemaVersion: 1;
  illustration: { url: string; alt: Localized };
  categories: QuestionCategory[];
  questions: CuratedQuestion[];
};
const identifier = /^[a-zA-Z0-9_-]{1,80}$/;
const record = (v: unknown): v is Record<string, unknown> =>
  Boolean(v && typeof v === "object" && !Array.isArray(v));
const text = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length <= max;
const localized = (v: unknown, max: number): v is Localized =>
  record(v) && assistantLanguages.every((l) => text(v[l], max));
const order = (v: unknown) =>
  Number.isSafeInteger(v) && Math.abs(v as number) <= 999999;
const aliases = (v: unknown): boolean =>
  record(v) &&
  assistantLanguages.every((l) => {
    const a = v[l];
    return (
      Array.isArray(a) && a.length <= 10 && a.every((item) => text(item, 300))
    );
  });
export function safeContentPath(path: string): boolean {
  return /^\/(?:products(?:\/[a-zA-Z0-9_-]+)?|makers(?:\/[a-zA-Z0-9_-]+)?|how-it-works|our-story|terms|privacy)$/.test(
    path,
  );
}
export function safeIllustrationUrl(value: string): boolean {
  if (!value) return true;
  if (
    /^\/assets\/[a-zA-Z0-9_./-]+\.(?:png|webp|jpg|jpeg)$/.test(value) &&
    !value.includes("..")
  )
    return true;
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash &&
      (u.hostname === "joko.today" ||
        u.hostname.endsWith(".joko.today") ||
        /^[a-z0-9]+\.supabase\.co$/.test(u.hostname) ||
        /^pub-[a-z0-9]+\.r2\.dev$/.test(u.hostname)) &&
      /\.(?:png|webp|jpg|jpeg)$/i.test(u.pathname)
    );
  } catch {
    return false;
  }
}
export function parseAssistantContent(value: unknown): AssistantContent {
  if (
    !record(value) ||
    value.schemaVersion !== 1 ||
    !record(value.illustration) ||
    !text(value.illustration.url, 1000) ||
    !safeIllustrationUrl(value.illustration.url) ||
    !localized(value.illustration.alt, 200) ||
    !Array.isArray(value.categories) ||
    value.categories.length > 20 ||
    !Array.isArray(value.questions) ||
    value.questions.length > 200
  )
    throw Error("Invalid Ask JOKO content.");
  const categoryIds = new Set<string>(),
    questionIds = new Set<string>();
  for (const c of value.categories) {
    if (
      !record(c) ||
      !text(c.id, 80) ||
      !identifier.test(c.id) ||
      categoryIds.has(c.id) ||
      !assistantSections.includes(c.section as AssistantSection) ||
      !localized(c.name, 100) ||
      typeof c.enabled !== "boolean" ||
      !order(c.order)
    )
      throw Error("Invalid question category.");
    categoryIds.add(c.id);
  }
  for (const q of value.questions) {
    if (
      !record(q) ||
      !text(q.id, 80) ||
      !identifier.test(q.id) ||
      questionIds.has(q.id) ||
      !text(q.categoryId, 80) ||
      !categoryIds.has(q.categoryId) ||
      !localized(q.question, 300) ||
      !localized(q.answer, 4000) ||
      !aliases(q.aliases) ||
      !Array.isArray(q.links) ||
      q.links.length > 6 ||
      !q.links.every(
        (link) =>
          record(link) &&
          localized(link.label, 100) &&
          text(link.path, 200) &&
          safeContentPath(link.path),
      ) ||
      typeof q.enabled !== "boolean" ||
      typeof q.ingredientsConfirmed !== "boolean" ||
      !order(q.order)
    )
      throw Error("Invalid curated question.");
    questionIds.add(q.id);
  }
  return value as AssistantContent;
}
export function visibleQuestions(
  content: AssistantContent,
  language: AssistantLanguage,
  section?: AssistantSection,
): CuratedQuestion[] {
  return content.questions
    .filter((q) => {
      const c = content.categories.find((c) => c.id === q.categoryId);
      return (
        c?.enabled &&
        c.name[language].trim() &&
        (!section || c.section === section) &&
        q.enabled &&
        q.question[language].trim() &&
        (c.section === "live" || q.answer[language].trim()) &&
        (c.section !== "guide" || q.ingredientsConfirmed)
      );
    })
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}
export const normalizeQuestion = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{Z}\s]+/gu, "")
    .trim();
export function matchSavedQuestion(
  content: AssistantContent,
  language: AssistantLanguage,
  value: string,
): CuratedQuestion | undefined {
  const normalized = normalizeQuestion(value);
  if (!normalized) return;
  const matches = visibleQuestions(content, language).filter(
    (q) =>
      content.categories.find((c) => c.id === q.categoryId)?.section !==
        "live" &&
      [q.question[language], ...q.aliases[language]].some(
        (a) => normalizeQuestion(a) === normalized,
      ),
  );
  return matches.length === 1 ? matches[0] : undefined;
}
export function searchSavedQuestions(
  content: AssistantContent,
  language: AssistantLanguage,
  value: string,
): CuratedQuestion[] {
  const normalized = normalizeQuestion(value);
  if (!normalized) return [];
  return visibleQuestions(content, language)
    .filter(
      (q) =>
        content.categories.find((c) => c.id === q.categoryId)?.section !==
          "live" &&
        [q.question[language], ...q.aliases[language]].some((a) =>
          normalizeQuestion(a).includes(normalized),
        ),
    )
    .slice(0, 6);
}
export const fallbackAssistantContent: AssistantContent = {
  schemaVersion: 1,
  illustration: { url: "", alt: blankText() },
  categories: [
    {
      id: "availability",
      section: "live",
      enabled: true,
      order: 0,
      name: {
        en: "Products & pickup dates",
        th: "สินค้าและวันรับ",
        zh: "商品与取货日期",
      },
    },
  ],
  questions: [
    {
      id: "croissants",
      categoryId: "availability",
      enabled: true,
      order: 0,
      ingredientsConfirmed: false,
      question: {
        en: "What croissants can I preorder?",
        th: "มีครัวซองต์อะไรให้สั่งจองบ้าง?",
        zh: "有哪些可颂可以预订？",
      },
      answer: blankText(),
      aliases: { en: [], th: [], zh: [] },
      links: [],
    },
  ],
};

/** Editorial starter material stays private until Admin explicitly publishes it. */
export function starterAssistantContent(): AssistantContent {
  const content = structuredClone(fallbackAssistantContent);
  content.categories.unshift(
    {
      id: "ordering",
      section: "faq",
      enabled: true,
      order: 0,
      name: { en: "How to order", th: "วิธีสั่งซื้อ", zh: "如何下单" },
    },
    {
      id: "pastry",
      section: "curious",
      enabled: true,
      order: 1,
      name: {
        en: "Pastry little mysteries",
        th: "เรื่องน่ารู้ของขนมอบ",
        zh: "烘焙小奥秘",
      },
    },
    {
      id: "dietary",
      section: "guide",
      enabled: true,
      order: 2,
      name: {
        en: "Dietary preferences",
        th: "ความต้องการด้านอาหาร",
        zh: "饮食偏好",
      },
    },
  );
  const base = {
    enabled: true,
    order: 0,
    ingredientsConfirmed: false,
    aliases: { en: [], th: [], zh: [] },
    links: [],
  };
  content.questions.unshift(
    {
      ...base,
      id: "ordering-help",
      categoryId: "ordering",
      question: {
        en: "How do I place an order?",
        th: "สั่งซื้ออย่างไร?",
        zh: "如何下单？",
      },
      answer: {
        en: "Choose your products, select an available pickup date and location, then follow checkout to complete payment. Your order confirmation contains your collection details.",
        th: "เลือกสินค้า วันรับและจุดรับที่เปิดให้บริการ จากนั้นทำตามขั้นตอนชำระเงิน รายละเอียดการรับสินค้าจะอยู่ในคำยืนยันคำสั่งซื้อ",
        zh: "选择商品、可用的取货日期和地点，然后按照结账流程完成付款。订单确认中会包含取货详情。",
      },
    },
    {
      ...base,
      id: "croissant-layers",
      categoryId: "pastry",
      question: {
        en: "Why do croissants have so many layers?",
        th: "ทำไมครัวซองต์ถึงมีหลายชั้น?",
        zh: "可颂为什么有那么多层？",
      },
      answer: {
        en: "Dough and butter are folded together repeatedly. In the oven, steam helps separate the thin layers, creating that airy centre and flaky shell.",
        th: "แป้งและเนยถูกพับซ้อนกันหลายครั้ง เมื่ออบ ไอน้ำช่วยแยกชั้นบาง ๆ ออกจากกัน จึงได้เนื้อโปร่งด้านในและผิวกรอบเป็นชั้น ๆ",
        zh: "面团和黄油反复折叠形成薄层。烘烤时，蒸汽帮助薄层分开，形成蓬松的内部和酥脆的外皮。",
      },
    },
    {
      ...base,
      id: "gluten-free",
      categoryId: "dietary",
      enabled: false,
      question: {
        en: "Which products are gluten-free?",
        th: "มีสินค้าไม่มีกลูเตนอะไรบ้าง?",
        zh: "有哪些无麸质商品？",
      },
      answer: blankText(),
    },
    {
      ...base,
      id: "vegan",
      categoryId: "dietary",
      enabled: false,
      order: 1,
      question: {
        en: "Which products are vegan?",
        th: "มีสินค้าวีแกนอะไรบ้าง?",
        zh: "有哪些纯素商品？",
      },
      answer: blankText(),
    },
  );
  return parseAssistantContent(content);
}
