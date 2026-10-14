const localized = (en, th, zh) => ({ en, th, zh });
const question = (id, categoryId, labels, answer, extra = {}) => ({
  id,
  categoryId,
  question: labels,
  answer,
  aliases: { en: [], th: [], zh: [] },
  links: [],
  enabled: true,
  order: 0,
  ingredientsConfirmed: false,
  ...extra,
});
export const contentFixture = {
  schemaVersion: 1,
  illustration: { url: "", alt: localized("", "", "") },
  categories: [
    {
      id: "orders",
      section: "faq",
      name: localized("How to order", "วิธีสั่งซื้อ", "如何下单"),
      enabled: true,
      order: 0,
    },
    {
      id: "pastry",
      section: "curious",
      name: localized("Pastry mysteries", "เรื่องน่ารู้ของขนมอบ", "烘焙小奥秘"),
      enabled: true,
      order: 1,
    },
    {
      id: "diet",
      section: "guide",
      name: localized(
        "Dietary preferences",
        "ความต้องการด้านอาหาร",
        "饮食偏好",
      ),
      enabled: true,
      order: 2,
    },
    {
      id: "stock",
      section: "live",
      name: localized(
        "Croissants & pastries",
        "ครัวซองต์และขนมอบ",
        "可颂与糕点",
      ),
      enabled: true,
      order: 3,
    },
  ],
  questions: [
    question(
      "order",
      "orders",
      localized("How do I order?", "สั่งซื้ออย่างไร?", "如何下单？"),
      localized(
        "Approved ordering answer.",
        "คำตอบวิธีสั่งซื้อที่ยืนยันแล้ว",
        "已审核的下单说明。",
      ),
      {
        aliases: {
          en: ["How to place an order"],
          th: ["สั่งยังไง"],
          zh: ["怎样下单"],
        },
        links: [
          {
            path: "/products",
            label: localized("Browse products", "ดูสินค้า", "浏览商品"),
          },
        ],
      },
    ),
    question(
      "layers",
      "pastry",
      localized(
        "Why do croissants have layers?",
        "ทำไมครัวซองต์มีหลายชั้น?",
        "可颂为什么有很多层？",
      ),
      localized(
        "Dough and butter are folded together.",
        "แป้งและเนยถูกพับซ้อนกัน",
        "面团和黄油反复折叠。",
      ),
    ),
    question(
      "gluten",
      "diet",
      localized(
        "What is gluten-free?",
        "มีสินค้าไม่มีกลูเตนอะไรบ้าง?",
        "有哪些无麸质商品？",
      ),
      localized(
        "Maker-confirmed guidance.",
        "ข้อมูลที่ผู้ผลิตยืนยันแล้ว",
        "制作方已确认的信息。",
      ),
      { ingredientsConfirmed: true },
    ),
    question(
      "vegan-unverified",
      "diet",
      localized(
        "Unverified vegan products",
        "ข้อมูลวีแกนที่ยังไม่ยืนยัน",
        "未核实的纯素商品",
      ),
      localized("Do not expose this.", "ห้ามแสดง", "不应展示。"),
    ),
    question(
      "croissants",
      "stock",
      localized(
        "What croissants can I preorder?",
        "มีครัวซองต์อะไรให้สั่งจองบ้าง?",
        "有哪些可颂可以预订？",
      ),
      localized("", "", ""),
    ),
    question(
      "hidden",
      "orders",
      localized("PRIVATE_DRAFT", "", ""),
      localized("SECRET_DRAFT", "", ""),
      { enabled: false },
    ),
    question(
      "en-only",
      "orders",
      localized("English-only question", "", ""),
      localized("English-only answer", "", ""),
    ),
  ],
};
