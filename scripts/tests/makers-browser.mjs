// Real Chromium interaction tests against intercepted backend responses.
// Never sends requests to Supabase, Stripe or email providers.
// JOKO_TEST_PLAYWRIGHT_MODULE=<absolute playwright-core/index.mjs> JOKO_TEST_CHROMIUM=<executable> node scripts/tests/makers-browser.mjs
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "vite";
const { chromium } = await import(
  process.env.JOKO_TEST_PLAYWRIGHT_MODULE || "playwright-core"
);
const server = await createServer({
  server: { host: "127.0.0.1", port: 5196, strictPort: true },
});
await server.listen();
const browser = await chromium.launch({
  executablePath: process.env.JOKO_TEST_CHROMIUM,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  headless: true,
});
const base = "http://127.0.0.1:5196";
const uid = "00000000-0000-0000-0000-000000000001";
const maker = {
  id: "00000000-0000-0000-0000-000000000010",
  slug: "morning-makers",
  name_en: "Morning Makers",
  name_th: "ผู้ผลิตยามเช้า",
  name_zh: "晨间制作人",
  intro_en: "Selected daily favourites",
  intro_th: "คัดสรรทุกวัน",
  story_en: "Made every morning.",
  joko_note_en: "We chose their cake.",
  location: "Chiang Mai",
  hero_image: `${base}/JOKO.TODAY_logo.transparent.png`,
  website_url: null,
  is_published: true,
  show_on_homepage: true,
  is_ordering_enabled: false,
  sort_order: 0,
};
const category = {
  id: "00000000-0000-0000-0000-000000000050",
  name_en: "Cake",
  name_th: "เค้ก",
  slug: "cake",
  is_active: true,
  sort_order: 0,
};
const products = ["joko", "beyond", "maker"].map((origin, i) => ({
  id: `00000000-0000-0000-0000-00000000002${i}`,
  slug: ["bread", "jam", "selected-cake"][i],
  name_en: ["House Bread", "Selected Jam", "Selected Cake"][i],
  name_th: ["ขนมปัง", "แยม", "เค้ก"][i],
  desc_en: "For your pickup",
  desc_th: "สำหรับรับสินค้า",
  image: `${base}/JOKO.TODAY_logo.transparent.png`,
  category_id: category.id,
  price: [80, 40, 150][i],
  product_origin: origin,
  maker_id: i === 2 ? maker.id : null,
  maker: i === 2 ? maker : null,
  is_active: true,
  is_sold_out: false,
  is_non_bakery: i === 1,
  sort_order: i,
  stock_total: 10,
  stock_remaining: 10,
  available_days: [],
  stock_by_day: {},
}));
const location = {
  id: "00000000-0000-0000-0000-000000000032",
  name_en: "Sunday pickup",
  name_th: "รับวันอาทิตย์",
  name_zh: "周日取货",
  sort_order: 0,
  is_active: true,
};
const availability = products.map((product) => ({
  product_id: product.id,
  pickup_date_id: "00000000-0000-0000-0000-000000000031",
  pickup_date: "2026-10-18",
  order_cutoff_at: "2026-10-16T10:00:00Z",
  schedule_id: "00000000-0000-0000-0000-000000000030",
  schedule_key: "sunday",
  schedule_label_en: "Sunday",
  remaining_quantity: 10,
  locations: [location],
}));
const user = {
  id: uid,
  email: "test@example.test",
  role: "authenticated",
  aud: "authenticated",
  email_confirmed_at: "2026-01-01T00:00:00Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
let savedMaker;
let productPatch;
let orderRequest;
async function setup({ admin = false, cart = false, mobile = false } = {}) {
  const context = await browser.newContext({
    viewport: mobile
      ? { width: 390, height: 844 }
      : { width: 1440, height: 1000 },
  });
  const errors = [];
  await context.routeWebSocket("wss://**", (socket) => socket.close());
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === base) return route.continue();
    if (!url.hostname.endsWith(".supabase.co")) return route.abort();
    const json = (data, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (url.pathname === "/auth/v1/user") return json(user);
    if (url.pathname.endsWith("/stripe-promptpay-intent"))
      return json({
        state: "pending",
        paymentTransactionId: "mock-payment",
        orderId: "mock-order",
        orderNumber: "T1000",
        amount: 270,
        currency: "THB",
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        promptPayPayload: "mock-promptpay",
        qrMode: "stripe_promptpay",
      });
    if (url.pathname.startsWith("/functions/")) return json({ success: true });
    const table = url.pathname.split("/").pop();
    const object = request.headers().accept?.includes("object+json");
    if (table === "cms_makers" && request.method() === "POST") {
      savedMaker = { ...request.postDataJSON(), id: "new-maker" };
      return json(savedMaker);
    }
    if (table === "cms_makers" && request.method() === "PATCH") {
      savedMaker = { ...maker, ...request.postDataJSON() };
      return json(savedMaker);
    }
    if (table === "cms_products" && request.method() === "PATCH") {
      productPatch = request.postDataJSON();
      return json(null);
    }
    if (table === "get_published_builder_page_v1")
      return json({ exists: false });
    if (table === "get_customer_pickup_availability_v2")
      return json(availability);
    if (table === "create_online_order_v2") {
      orderRequest = request.postDataJSON();
      return json({
        id: "mock-order",
        order_number: "T1000",
        pickup_date: "2026-10-18",
        pickup_date_id: availability[0].pickup_date_id,
        pickup_location_id: location.id,
        total_amount: 270,
        status: "pending",
        payment_status: "unpaid",
        order_items: products.map((p) => ({
          product_id: p.id,
          product_name: p.name_en,
          quantity: 1,
          price_at_order: p.price,
          ...(p.maker ? { maker_name_en: maker.name_en } : {}),
        })),
      });
    }
    if (table === "create_or_get_payment_transaction_v1")
      return json({
        id: "mock-payment",
        order_id: "mock-order",
        status: "pending",
        amount_due: 270,
        payment_mode: "stripe_promptpay",
        currency: "THB",
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        qr_mode: "stripe_promptpay",
      });
    if (url.pathname.includes("/rpc/")) return json(null);
    let rows = [];
    if (table === "cms_makers")
      rows = [
        maker,
        ...(savedMaker && savedMaker.id !== maker.id ? [savedMaker] : []),
      ];
    if (table === "cms_products") rows = products;
    if (table === "cms_categories") rows = [category];
    if (table === "cms_pickup_locations") rows = [location];
    if (table === "user_profiles")
      rows = [
        {
          id: uid,
          role: admin ? "admin" : "customer",
          name: "Test Customer",
          email: user.email,
          phone: "0800000000",
          line_id: "test",
          profile_completed: true,
          preferred_language: "en",
          qr_token: "test-token",
          short_code: "TEST",
          created_at: user.created_at,
        },
      ];
    if (table === "payment_settings")
      rows = [
        {
          id: true,
          online_promptpay_enabled: true,
          payment_window_minutes: 60,
          payment_qr_mode: "stripe_promptpay",
        },
      ];
    if (table === "cms_settings")
      rows = [{ setting_key: "pickup_v2_customer_enabled", value: "true" }];
    for (const [key, value] of url.searchParams)
      if (value.startsWith("eq."))
        rows = rows.filter((row) => String(row[key]) === value.slice(3));
    return json(object ? rows[0] || null : rows);
  });
  await context.addInitScript(
    ({ uid, user, admin, cart, products, availability, location }) => {
      localStorage.setItem("jt_language", "en");
      if (admin || cart) {
        const expires_at = Math.floor(Date.now() / 1000) + 3600;
        const payload = btoa(
          JSON.stringify({ sub: uid, role: "authenticated", exp: expires_at }),
        );
        localStorage.setItem(
          "sb-xvhualoeboobulwgmkla-auth-token",
          JSON.stringify({
            access_token: `e30.${payload}.test`,
            refresh_token: "fake-refresh",
            expires_at,
            expires_in: 3600,
            token_type: "bearer",
            user,
          }),
        );
      }
      if (cart) {
        localStorage.setItem(
          `joko-cart:${uid}`,
          JSON.stringify(products.map((product) => ({ product, quantity: 1 }))),
        );
        localStorage.setItem(
          `joko-pickup-v2-preferred-date:${uid}`,
          JSON.stringify({
            pickupDateId: availability[0].pickup_date_id,
            pickupDate: availability[0].pickup_date,
            pickupLocationId: location.id,
            scheduleId: availability[0].schedule_id,
            scheduleKey: "sunday",
            scheduleLabelEn: "Sunday",
          }),
        );
      }
    },
    { uid, user, admin, cart, products, availability, location },
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  return { context, page, errors };
}
const expectVisible = async (locator) => {
  await locator.first().waitFor({ state: "visible", timeout: 15000 });
};
try {
  const { context, page, errors } = await setup();
  await page.goto(`${base}/makers`);
  await expectVisible(
    page.getByRole("heading", { name: "Morning Makers", exact: true }),
  );
  await page.getByRole("link", { name: /Morning Makers/ }).click();
  await expectVisible(page.getByRole("heading", { name: "What we picked" }));
  await page.getByRole("link", { name: /Selected Cake/ }).click();
  await expectVisible(
    page.getByText("Preview only. Ordering is not open yet."),
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Add to Cart", exact: true })
      .count(),
    0,
  );
  await page.goto(`${base}/`);
  await expectVisible(
    page.locator("#makers").getByRole("heading", { name: "JOKO Makers" }),
  );
  if (process.env.JOKO_TEST_SCREENSHOTS) {
    await mkdir(process.env.JOKO_TEST_SCREENSHOTS, { recursive: true });
    await page.screenshot({
      path: `${process.env.JOKO_TEST_SCREENSHOTS}/makers-home.png`,
      fullPage: true,
    });
  }
  assert.deepEqual(errors, []);
  await context.close();
  console.log(
    "PASS public listing/profile/product links, homepage and preview-only purchase gate",
  );
  const mobile = await setup({ mobile: true });
  await mobile.page.goto(`${base}/makers/morning-makers`);
  await expectVisible(
    mobile.page.getByRole("heading", { name: "Morning Makers", exact: true }),
  );
  assert.ok(
    await mobile.page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  if (process.env.JOKO_TEST_SCREENSHOTS)
    await mobile.page.screenshot({
      path: `${process.env.JOKO_TEST_SCREENSHOTS}/makers-mobile.png`,
      fullPage: true,
    });
  await mobile.page.getByRole("button", { name: "Menu", exact: true }).click();
  await mobile.page
    .getByRole("navigation", { name: "JOKO TODAY mobile" })
    .getByRole("button", { name: "Makers", exact: true })
    .click();
  await expectVisible(
    mobile.page.getByRole("heading", { name: "JOKO Makers", exact: true }),
  );
  await mobile.context.close();
  console.log("PASS mobile profile width and Makers navigation");
  const admin = await setup({ admin: true });
  await admin.page.goto(`${base}/admin/makers`);
  await expectVisible(admin.page.getByRole("button", { name: "Save maker" }));
  await admin.page.getByLabel("Slug", { exact: true }).fill("new-shop");
  await admin.page.locator("textarea").nth(0).fill("New Shop");
  await admin.page.locator("textarea").nth(4).fill("ร้านใหม่");
  await admin.page.getByRole("button", { name: "Save maker" }).click();
  await expectVisible(admin.page.getByText("Maker saved.", { exact: true }));
  assert.equal(savedMaker.slug, "new-shop");
  assert.equal(savedMaker.is_ordering_enabled, false);
  await admin.page.getByRole("button", { name: /Morning Makers/ }).click();
  await admin.page.getByLabel("Location", { exact: true }).fill("Mae Rim");
  await admin.page.getByRole("button", { name: "Save maker" }).click();
  await expectVisible(admin.page.getByText("Maker saved.", { exact: true }));
  assert.equal(savedMaker.location, "Mae Rim");
  await admin.page.goto(`${base}/admin`);
  await expectVisible(admin.page.getByRole("button", { name: /^House Bread/ }));
  await admin.page.getByRole("button", { name: /^House Bread/ }).click();
  await admin.page.getByLabel("Product world").selectOption("maker");
  await admin.page
    .getByRole("button", { name: "Update Product", exact: true })
    .click();
  await expectVisible(
    admin.page.getByText("Choose a maker for Makers products.", {
      exact: true,
    }),
  );
  await admin.page
    .getByRole("combobox", { name: /^Maker/ })
    .selectOption(maker.id);
  await admin.page
    .getByRole("button", { name: "Update Product", exact: true })
    .click();
  await admin.page
    .getByRole("button", { name: "Update Product", exact: true })
    .waitFor({ state: "hidden" });
  assert.equal(productPatch.product_origin, "maker");
  assert.equal(productPatch.maker_id, maker.id);
  assert.deepEqual(admin.errors, []);
  await admin.context.close();
  console.log(
    "PASS Admin maker create/edit/save, preview-only defaults and product assignment validation",
  );
  maker.is_ordering_enabled = true;
  const checkout = await setup({ cart: true });
  await checkout.page.goto(`${base}/checkout`);
  await expectVisible(checkout.page.getByText(/JOKO purchases these products/));
  for (const product of products)
    await expectVisible(
      checkout.page.getByText(product.name_en, { exact: true }),
    );
  await expectVisible(
    checkout.page.getByText("Morning Makers", { exact: true }),
  );
  await checkout.page
    .getByRole("button", { name: "Place Order", exact: true })
    .click();
  await expectVisible(checkout.page.getByText("T1000", { exact: true }));
  assert.equal(orderRequest.p_items.length, 3);
  assert.equal(orderRequest.p_pickup_date_id, availability[0].pickup_date_id);
  await expectVisible(
    checkout.page.getByText("Morning Makers", { exact: true }),
  );
  if (process.env.JOKO_TEST_SCREENSHOTS)
    await checkout.page.screenshot({
      path: `${process.env.JOKO_TEST_SCREENSHOTS}/makers-checkout.png`,
      fullPage: true,
    });
  assert.deepEqual(checkout.errors, []);
  await checkout.context.close();
  console.log(
    "PASS mixed BAKED/BEYOND/MAKERS basket, sourcing disclosure, dated order submission and returned historical maker snapshot",
  );
  console.log(
    "All Makers browser checks passed. Backend responses were mocked; no provider or production writes.",
  );
} finally {
  await browser.close();
  await server.close();
}
