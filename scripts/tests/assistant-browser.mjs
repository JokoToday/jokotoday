// Isolated customer and Admin browser checks: no production data, credentials or paid AI.
import assert from "node:assert/strict";
import { createServer } from "vite";
import { contentFixture } from "./ask-joko-fixture.mjs";
const { chromium } = await import(
  process.env.JOKO_TEST_PLAYWRIGHT_MODULE || "playwright-core"
);
const server = await createServer({
  server: { host: "127.0.0.1", port: 5198, strictPort: true },
  plugins: [
    {
      name: "assistant-test-harness",
      resolveId(id) {
        if (
          id === "virtual:assistant-harness" ||
          id === "virtual:assistant-admin-harness"
        )
          return id;
      },
      load(id) {
        if (
          id !== "virtual:assistant-harness" &&
          id !== "virtual:assistant-admin-harness"
        )
          return;
        return `import React from 'react';import {createRoot} from 'react-dom/client';import {LanguageProvider} from '/src/context/LanguageContext.tsx';import AssistantWidget from '/src/app/joko-today/assistant/AssistantWidget.tsx';import {AskJokoManagement} from '/src/components/AskJokoManagement.tsx';import '/src/index.css';createRoot(document.getElementById('root')).render(React.createElement(LanguageProvider,null,${id.includes("admin") ? "React.createElement(AskJokoManagement)" : "React.createElement('main',null,React.createElement('h1',null,'JOKO widget fixture preview'),React.createElement('div',{id:'joko-contact'},'Contact JOKO'),React.createElement(AssistantWidget,{onNavigate:page=>window.__navigation=page}))"}));`;
      },
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          if (
            !["/__assistant_test", "/__assistant_admin_test"].includes(req.url)
          )
            return next();
          const module = req.url.includes("admin")
            ? "virtual:assistant-admin-harness"
            : "virtual:assistant-harness";
          const html = await vite.transformIndexHtml(
            req.url,
            `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@id/${module}"></script></body></html>`,
          );
          res.setHeader("Content-Type", "text/html");
          res.end(html);
        });
      },
    },
  ],
});
await server.listen();
const browser = await chromium.launch({
  executablePath: process.env.JOKO_TEST_CHROMIUM,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
  headless: true,
});
const base = "http://127.0.0.1:5198",
  id = "00000000-0000-4000-8000-000000000001";
let mode = "success",
  messages = 0,
  sessions = 0,
  adminVersion = 0,
  adminDraft = structuredClone(contentFixture),
  publishedAt = null,
  publishCount = 0;
const errors = [],
  requests = [];
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== base) {
      if (url.pathname.endsWith("/get_published_ask_joko_v1"))
        return route.fulfill({ json: contentFixture });
      if (url.pathname.endsWith("/get_admin_ask_joko_v1"))
        return route.fulfill({
          json: { version: adminVersion, draft: adminDraft, publishedAt },
        });
      if (url.pathname.endsWith("/save_ask_joko_draft_v1")) {
        const body = route.request().postDataJSON();
        assert.equal(body.p_expected_version, adminVersion);
        adminDraft = body.p_document;
        adminVersion++;
        return route.fulfill({
          json: { version: adminVersion, draft: adminDraft, publishedAt },
        });
      }
      if (url.pathname.endsWith("/publish_ask_joko_v1")) {
        assert.equal(
          route.request().postDataJSON().p_expected_version,
          adminVersion,
        );
        adminVersion++;
        publishCount++;
        publishedAt = new Date().toISOString();
        return route.fulfill({
          json: { version: adminVersion, draft: adminDraft, publishedAt },
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      });
    }
    if (!url.pathname.startsWith("/api/assistant/")) return route.continue();
    requests.push(url.pathname);
    if (route.request().method() === "DELETE")
      return route.fulfill({ json: { cleared: true } });
    if (url.pathname.endsWith("/session"))
      return route.fulfill({
        status: 201,
        json: { sessionId: `fixture-session-${++sessions}` },
      });
    messages++;
    const body = route.request().postDataJSON();
    assert.ok(body.clientRequestId);
    assert.match(body.sessionId, /^fixture-session-\d+$/);
    if (mode === "failure")
      return route.fulfill({
        status: 503,
        json: { error: "availability_unavailable" },
      });
    if (mode === "budget")
      return route.fulfill({
        status: 503,
        json: { error: "budget_exhausted" },
      });
    const names = {
        en: "Fixture Croissant",
        th: "ครัวซองต์ตัวอย่าง",
        zh: "示例可颂",
      },
      locations = { en: "Mae Rim", th: "แม่ริม", zh: "湄林" };
    return route.fulfill({
      json: {
        answer:
          body.language === "th"
            ? "ตัวอย่างคำตอบจากข้อมูลล่าสุด"
            : body.language === "zh"
              ? "这是实时库存示例。"
              : "Fixture preview: <img src=x onerror=alert(1)>",
        checked_at: new Date().toISOString(),
        products: [
          {
            id,
            name: names,
            price: 40,
            product_url: "https://joko.today/products/croissant",
            pickups: [
              {
                pickup_date: "2030-10-19",
                remaining_quantity: 8,
                order_cutoff_local: "2030-10-18 17:00",
                locations: [{ id, name: locations }],
              },
            ],
          },
          {
            id: "unsafe",
            name: { en: "Unsafe", th: "", zh: "" },
            price: 0,
            product_url: "javascript:alert(1)",
            pickups: [],
          },
        ],
      },
    });
  });
  await page.goto(`${base}/__assistant_test`);
  await page.getByRole("button", { name: "Ask JOKO", exact: true }).click();
  await page.getByText("How do I order?", { exact: true }).waitFor();
  await page.locator("summary").filter({ hasText: "How do I order?" }).click();
  await page.getByText("Approved ordering answer.", { exact: true }).waitFor();
  assert.equal(requests.length, 0);
  const input = page.getByRole("textbox");
  await input.fill("How to place an order");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page
    .locator(".joko-assistant-log")
    .getByText("Approved ordering answer.", { exact: true })
    .waitFor();
  assert.equal(
    requests.length,
    0,
    "Saved aliases do not call AI or create a session",
  );
  await page.getByRole("button", { name: /Curious Bites/ }).click();
  await page.locator("summary").first().click();
  await page
    .getByText("Dough and butter are folded together.", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: /Find your kind/ }).click();
  assert.equal(
    await page.getByText("Unverified vegan products", { exact: true }).count(),
    0,
  );
  await page.locator("summary").first().click();
  await page.getByText("Maker-confirmed guidance.", { exact: true }).waitFor();
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("th");
  assert.equal(
    await page.getByText("Approved ordering answer.", { exact: true }).count(),
    0,
  );
  await page.getByRole("button", { name: /เรื่องของ JOKO/ }).click();
  assert.equal(
    await page.getByText("English-only question", { exact: true }).count(),
    0,
  );
  await page.getByRole("button", { name: /มีอะไรให้จอง/ }).click();
  await page
    .getByRole("button", { name: /มีครัวซองต์อะไรให้สั่งจองบ้าง/ })
    .click();
  await page.getByText("ครัวซองต์ตัวอย่าง", { exact: true }).waitFor();
  await page
    .getByRole("combobox", { name: "ภาษา", exact: true })
    .selectOption("en");
  await page.getByRole("button", { name: /What’s available/ }).click();
  await page
    .getByRole("button", { name: /What croissants can I preorder/ })
    .click();
  await page.getByText("Fixture Croissant", { exact: true }).waitFor();
  assert.equal(await page.locator(".joko-assistant-log img").count(), 0);
  assert.equal(await page.getByText("Unsafe", { exact: true }).count(), 0);
  assert.equal(
    await page
      .getByRole("link", { name: "View product", exact: true })
      .getAttribute("href"),
    "/products/croissant",
  );
  assert.match(
    await page.locator(".joko-assistant-product").innerText(),
    /2030-10-18 17:00/,
  );
  const colors = await page
    .locator(".joko-assistant-top")
    .evaluate((el) => [
      getComputedStyle(el).backgroundColor,
      ...[...el.querySelectorAll("p,h2")].map((e) => getComputedStyle(e).color),
    ]);
  assert.deepEqual(colors, [
    "rgb(70, 104, 97)",
    "rgb(255, 255, 255)",
    "rgb(255, 255, 255)",
  ]);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 700 });
    const panel = await page.getByRole("dialog").boundingBox();
    assert.ok(
      panel.x >= 0 &&
        panel.x + panel.width <= width &&
        panel.y >= 0 &&
        panel.y + panel.height <= 700,
    );
  }
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => document.activeElement?.textContent === "Ask JOKO",
  );
  await page.getByRole("button", { name: "Ask JOKO", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("zh");
  await page.getByRole("button", { name: /有哪些可颂可以预订/ }).click();
  await page.getByText("示例可颂", { exact: true }).waitFor();
  assert.equal(sessions, 3);
  await page.getByRole("button", { name: "清空聊天", exact: true }).click();
  await page
    .getByText("示例可颂", { exact: true })
    .waitFor({ state: "hidden" });
  await page
    .getByRole("combobox", { name: "语言", exact: true })
    .selectOption("en");
  assert.equal(
    await page.getByText("Fixture Croissant", { exact: true }).count(),
    1,
    "Other language history is retained",
  );
  mode = "failure";
  await input.fill("Check again");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page
    .getByText(
      "I couldn’t check availability. Please browse products or contact JOKO.",
      { exact: true },
    )
    .waitFor();
  mode = "budget";
  await input.fill("One more");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page
    .getByText(
      "The assistant is taking a break. You can still browse and order normally.",
      { exact: true },
    )
    .waitFor();
  await page
    .getByRole("button", { name: "Browse products", exact: true })
    .click();
  assert.equal(await page.evaluate(() => window.__navigation), "products");
  assert.equal(
    await page.evaluate(() =>
      Object.keys(localStorage).some((key) =>
        /assistant|chat|session/i.test(key),
      ),
    ),
    false,
  );
  assert.equal(messages, 5);
  await page.setViewportSize({ width: 1100, height: 850 });
  await page.goto(`${base}/__assistant_admin_test`);
  await page
    .getByRole("combobox", { name: "Choose question", exact: true })
    .waitFor();
  await page
    .getByRole("combobox", { name: "Choose question", exact: true })
    .selectOption("order");
  await page
    .getByRole("textbox", { name: "Approved answer — English", exact: true })
    .fill("Edited draft answer");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page
    .getByText("Draft saved privately. The published widget has not changed.", {
      exact: true,
    })
    .waitFor();
  assert.equal(adminDraft.questions[0].answer.en, "Edited draft answer");
  assert.equal(publishCount, 0);
  await page
    .getByRole("button", { name: "Save & publish", exact: true })
    .click();
  await page
    .getByText(
      "Published. Customers see the complete translations of enabled questions.",
      { exact: true },
    )
    .waitFor();
  assert.equal(publishCount, 1);
  await page
    .getByRole("combobox", { name: "Choose question", exact: true })
    .selectOption("gluten");
  await page
    .getByRole("textbox", { name: "Approved answer — English", exact: true })
    .fill("Revised ingredient information");
  assert.equal(
    await page.getByRole("checkbox", { name: /I have confirmed/ }).isChecked(),
    false,
    "Editing ingredient guidance requires fresh maker confirmation",
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "PASS customer/Admin Chromium: curated zero-AI answers, categories, verified guidance, EN/TH/ZH isolation, exact branding, safe live cards, mobile bounds, errors, private save and explicit publication",
  );
} finally {
  await browser.close();
  await server.close();
}
