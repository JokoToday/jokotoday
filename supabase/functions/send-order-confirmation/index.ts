import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Resend } from "npm:resend";
import {
  authenticateRequest,
  claimNotification,
  finishNotification,
  handlePreflight,
  isValidUuid,
  jsonResponse,
  notificationIdempotencyKey,
  providerErrorSummary,
  rejectDisallowedOrigin,
} from "../_shared/order-notifications.ts";
import {
  buildTransactionalEmailShell,
  escapeHtml,
  JOKO_EMAIL_THEME,
  jokoEmailLogoAttachment,
  renderPrimaryButton,
  renderSecondaryLink,
  type TransactionalEmailLanguage,
} from "../_shared/transactional-email.ts";

interface OrderItem {
  product_id: string;
  product_name: string;
  product_name_th?: string;
  product_name_zh?: string;
  quantity: number;
  price_at_order: number;
}

interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  total_amount: number;
  pickup_day: string | null;
  pickup_location_id: string | null;
  order_items: OrderItem[];
  loyalty_points_earned?: number | null;
}

interface PickupLocation {
  id: string;
  name_en: string;
  name_th: string;
  name_zh: string;
  maps_url: string | null;
}

interface PickupDay {
  id: string;
  label: string;
  label_en: string | null;
  label_th: string | null;
  label_zh: string | null;
  location_id: string | null;
}

type Language = TransactionalEmailLanguage;

const TYPE = "customer_confirmation" as const;
const APP_URL = "https://joko.today";
const MY_ORDERS_URL = `${APP_URL}/?page=my-orders`;

function normalizeLanguage(value: unknown): Language | null {
  return value === "en" || value === "th" || value === "zh" ? value : null;
}

function getLocationName(location: PickupLocation | null, lang: Language): string {
  if (!location) return "—";
  if (lang === "th") return location.name_th || location.name_en;
  if (lang === "zh") return location.name_zh || location.name_en;
  return location.name_en;
}

function getPickupDayLabel(day: PickupDay | null, fallback: string | null, lang: Language): string {
  if (!day) return fallback || "—";
  if (lang === "th") return day.label_th || day.label_en || day.label;
  if (lang === "zh") return day.label_zh || day.label_en || day.label;
  return day.label_en || day.label;
}

function getProductName(item: OrderItem, lang: Language): string {
  if (lang === "th") return item.product_name_th || item.product_name || "—";
  if (lang === "zh") return item.product_name_zh || item.product_name || "—";
  return item.product_name || "—";
}

function buildMapsLink(mapsUrl: string | null, locationName: string): string {
  if (mapsUrl) return mapsUrl;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationName)}`;
}

type EmailCopy = {
  subjectPrefix: string;
  eyebrow: string;
  heading: string;
  greetingPrefix: string;
  greetingSuffix: string;
  intro: string;
  orderNumber: string;
  pickup: string;
  pickupLocation: string;
  viewMap: string;
  items: string;
  total: string;
  paymentHeading: string;
  payment: string;
  points: string;
  pointsSuffix: string;
  viewOrder: string;
  changePlans: string;
  footer: string;
};

const EMAIL_COPY: Record<Language, EmailCopy> = {
  en: {
    subjectPrefix: "Order confirmed",
    eyebrow: "Order confirmed",
    heading: "Your order is in.",
    greetingPrefix: "Hi ",
    greetingSuffix: ",",
    intro: "Thanks for your order. We have it and will have it ready for your selected pickup.",
    orderNumber: "Order",
    pickup: "Pickup",
    pickupLocation: "Location",
    viewMap: "View on Maps",
    items: "Your order",
    total: "Total",
    paymentHeading: "Payment",
    payment: "Pay when you pick up. Cash or Thai QR payment is available.",
    points: "JOKO points earned",
    pointsSuffix: "pts",
    viewOrder: "View my order",
    changePlans: "Need to change your plans? Open My Orders to see the options currently available.",
    footer: "Thank you for choosing JOKO TODAY",
  },
  th: {
    subjectPrefix: "ยืนยันคำสั่งซื้อแล้ว",
    eyebrow: "ยืนยันคำสั่งซื้อแล้ว",
    heading: "เราได้รับคำสั่งซื้อของคุณแล้ว",
    greetingPrefix: "สวัสดีคุณ ",
    greetingSuffix: "",
    intro: "ขอบคุณสำหรับคำสั่งซื้อ เราได้รับออเดอร์เรียบร้อยแล้วและจะเตรียมไว้สำหรับวันรับสินค้าที่คุณเลือก",
    orderNumber: "คำสั่งซื้อ",
    pickup: "รับสินค้า",
    pickupLocation: "สถานที่รับสินค้า",
    viewMap: "ดูแผนที่",
    items: "รายการของคุณ",
    total: "ยอดรวม",
    paymentHeading: "การชำระเงิน",
    payment: "ชำระเงินเมื่อรับสินค้า สามารถชำระด้วยเงินสดหรือ Thai QR ได้",
    points: "แต้ม JOKO ที่ได้รับ",
    pointsSuffix: "แต้ม",
    viewOrder: "ดูคำสั่งซื้อของฉัน",
    changePlans: "ต้องการเปลี่ยนแผน? เปิดคำสั่งซื้อของฉันเพื่อดูตัวเลือกที่สามารถใช้ได้ในขณะนี้",
    footer: "ขอบคุณที่เลือก JOKO TODAY",
  },
  zh: {
    subjectPrefix: "订单已确认",
    eyebrow: "订单已确认",
    heading: "我们已收到您的订单。",
    greetingPrefix: "您好，",
    greetingSuffix: "",
    intro: "感谢您的订购。我们已收到订单，并会在您选择的取货时间准备好。",
    orderNumber: "订单",
    pickup: "取货",
    pickupLocation: "取货地点",
    viewMap: "查看地图",
    items: "您的订单",
    total: "总计",
    paymentHeading: "付款",
    payment: "取货时付款。可使用现金或 Thai QR 付款。",
    points: "本单获得 JOKO 积分",
    pointsSuffix: "积分",
    viewOrder: "查看我的订单",
    changePlans: "计划有变？请打开“我的订单”查看目前可用的选项。",
    footer: "感谢您选择 JOKO TODAY",
  },
};

function buildItemRows(items: OrderItem[], lang: Language): string {
  return items.map((item) => {
    const name = getProductName(item, lang);
    const quantity = Number(item.quantity);
    const price = Number(item.price_at_order);
    const lineTotal = price * quantity;

    return `
      <tr>
        <td valign="top" style="width:48px;padding:13px 8px 13px 0;border-bottom:1px solid ${JOKO_EMAIL_THEME.border};font-size:14px;line-height:1.5;font-weight:700;color:${JOKO_EMAIL_THEME.sageDark};">${quantity}×</td>
        <td valign="top" style="padding:13px 8px;border-bottom:1px solid ${JOKO_EMAIL_THEME.border};font-size:15px;line-height:${lang === "en" ? "1.5" : "1.75"};font-weight:600;color:${JOKO_EMAIL_THEME.charcoal};">${escapeHtml(name)}</td>
        <td valign="top" align="right" style="padding:13px 0 13px 8px;border-bottom:1px solid ${JOKO_EMAIL_THEME.border};font-size:15px;line-height:1.5;font-weight:700;white-space:nowrap;color:${JOKO_EMAIL_THEME.charcoal};">฿${lineTotal.toFixed(2)}</td>
      </tr>`;
  }).join("");
}

function buildPlainTextItems(items: OrderItem[], lang: Language): string[] {
  return items.map((item) => {
    const quantity = Number(item.quantity);
    const lineTotal = Number(item.price_at_order) * quantity;
    return `${quantity} × ${getProductName(item, lang)} — ฿${lineTotal.toFixed(2)}`;
  });
}

function buildLoyaltyBlock(points: number, copy: EmailCopy): string {
  if (!points || points <= 0) return "";
  return `
    <div style="margin-top:20px;padding:15px 17px;background:${JOKO_EMAIL_THEME.ochreSoft};border-radius:8px;">
      <div style="font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${JOKO_EMAIL_THEME.ochre};">${escapeHtml(copy.points)}</div>
      <div style="margin-top:3px;font-size:20px;line-height:1.35;font-weight:800;color:${JOKO_EMAIL_THEME.charcoal};">+${points} ${escapeHtml(copy.pointsSuffix)}</div>
    </div>`;
}

function buildEmail(
  order: Order,
  items: OrderItem[],
  location: PickupLocation | null,
  pickupDay: PickupDay | null,
  lang: Language,
): { subject: string; html: string; text: string } {
  const copy = EMAIL_COPY[lang];
  const subject = `${copy.subjectPrefix} · #${order.order_number}`;
  const locationName = getLocationName(location, lang);
  const pickupLabel = getPickupDayLabel(pickupDay, order.pickup_day, lang);
  const mapsLink = buildMapsLink(location?.maps_url ?? null, locationName);
  const points = Number(order.loyalty_points_earned ?? 0);
  const itemRows = buildItemRows(items, lang);
  const loyaltyBlock = buildLoyaltyBlock(points, copy);
  const greeting = `${copy.greetingPrefix}${order.customer_name}${copy.greetingSuffix}`;
  const preheader = `#${order.order_number} · ${pickupLabel} · ${locationName}`;

  const contentHtml = `
    <p style="margin:0 0 8px;font-size:16px;line-height:${lang === "en" ? "1.55" : "1.8"};font-weight:650;color:${JOKO_EMAIL_THEME.charcoal};">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 26px;font-size:15px;line-height:${lang === "en" ? "1.65" : "1.85"};color:${JOKO_EMAIL_THEME.muted};">${escapeHtml(copy.intro)}</p>

    <div style="margin:0 0 24px;padding:18px 20px;background:${JOKO_EMAIL_THEME.paper};border:1px solid ${JOKO_EMAIL_THEME.border};border-radius:9px;">
      <div style="font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${JOKO_EMAIL_THEME.sageDark};">${escapeHtml(copy.orderNumber)}</div>
      <div style="margin-top:5px;font-size:20px;line-height:1.3;font-weight:800;color:${JOKO_EMAIL_THEME.charcoal};font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">#${escapeHtml(order.order_number)}</div>
    </div>

    <div style="margin:0 0 28px;padding:20px;background:${JOKO_EMAIL_THEME.successSoft};border-radius:9px;">
      <div style="font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:${JOKO_EMAIL_THEME.sageDark};">${escapeHtml(copy.pickup)}</div>
      <div style="margin-top:5px;font-size:17px;line-height:${lang === "en" ? "1.45" : "1.7"};font-weight:750;color:${JOKO_EMAIL_THEME.charcoal};">${escapeHtml(pickupLabel)}</div>
      <div style="margin-top:16px;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:${JOKO_EMAIL_THEME.sageDark};">${escapeHtml(copy.pickupLocation)}</div>
      <div style="margin-top:5px;font-size:16px;line-height:${lang === "en" ? "1.45" : "1.7"};font-weight:650;color:${JOKO_EMAIL_THEME.charcoal};">${escapeHtml(locationName)}</div>
      <div style="margin-top:10px;font-size:13px;line-height:1.5;">${renderSecondaryLink(mapsLink, copy.viewMap)}</div>
    </div>

    <div style="margin-bottom:10px;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${JOKO_EMAIL_THEME.subtle};">${escapeHtml(copy.items)}</div>
    <table width="100%" role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
      <tbody>
        ${itemRows}
        <tr>
          <td colspan="2" style="padding:17px 8px 4px 0;text-align:right;font-size:14px;line-height:1.5;color:${JOKO_EMAIL_THEME.muted};">${escapeHtml(copy.total)}</td>
          <td align="right" style="padding:17px 0 4px 8px;font-size:20px;line-height:1.4;font-weight:800;white-space:nowrap;color:${JOKO_EMAIL_THEME.charcoal};">฿${Number(order.total_amount).toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <div style="margin-top:24px;padding:17px 18px;background:${JOKO_EMAIL_THEME.paper};border-left:4px solid ${JOKO_EMAIL_THEME.ochre};">
      <div style="font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:${JOKO_EMAIL_THEME.ochre};">${escapeHtml(copy.paymentHeading)}</div>
      <div style="margin-top:6px;font-size:14px;line-height:${lang === "en" ? "1.6" : "1.8"};color:${JOKO_EMAIL_THEME.charcoal};">${escapeHtml(copy.payment)}</div>
    </div>

    ${loyaltyBlock}

    <div style="margin-top:30px;text-align:center;">${renderPrimaryButton(MY_ORDERS_URL, copy.viewOrder)}</div>
    <p style="margin:18px 0 0;text-align:center;font-size:12px;line-height:${lang === "en" ? "1.6" : "1.8"};color:${JOKO_EMAIL_THEME.subtle};">${escapeHtml(copy.changePlans)}</p>`;

  const html = buildTransactionalEmailShell({
    language: lang,
    title: subject,
    preheader,
    eyebrow: copy.eyebrow,
    heading: copy.heading,
    contentHtml,
    footerText: copy.footer,
  });

  const text = [
    "JOKO TODAY",
    copy.heading,
    "",
    greeting,
    copy.intro,
    "",
    `${copy.orderNumber}: #${order.order_number}`,
    `${copy.pickup}: ${pickupLabel}`,
    `${copy.pickupLocation}: ${locationName}`,
    `${copy.viewMap}: ${mapsLink}`,
    "",
    copy.items,
    ...buildPlainTextItems(items, lang),
    `${copy.total}: ฿${Number(order.total_amount).toFixed(2)}`,
    "",
    `${copy.paymentHeading}: ${copy.payment}`,
    ...(points > 0 ? [`${copy.points}: +${points} ${copy.pointsSuffix}`] : []),
    "",
    `${copy.viewOrder}: ${MY_ORDERS_URL}`,
    copy.changePlans,
    "",
    copy.footer,
    "joko.today",
  ].join("\n");

  return { subject, html, text };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handlePreflight(req);
  if (req.method !== "POST") return jsonResponse(req, 405, { error: "Method not allowed" });

  const originRejection = rejectDisallowedOrigin(req);
  if (originRejection) return originRejection;

  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.value;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, 400, { error: "Invalid JSON body" });
  }

  const orderId = body.order_id;
  if (!isValidUuid(orderId)) return jsonResponse(req, 400, { error: "Invalid order_id" });

  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .select("id, order_number, customer_id, customer_name, customer_email, total_amount, pickup_day, pickup_location_id, order_items, loyalty_points_earned")
    .eq("id", orderId)
    .eq("customer_id", user.id)
    .eq("purchase_type", "online")
    .maybeSingle();

  if (orderError) {
    console.error("SEC-005: customer confirmation order lookup failed", orderError.message);
    return jsonResponse(req, 500, { error: "Notification service unavailable" });
  }
  if (!orderData) return jsonResponse(req, 404, { error: "Order not found" });

  const order = orderData as Order;
  if (!order.customer_email) return jsonResponse(req, 409, { error: "Order cannot receive email" });

  const claimMode = await claimNotification(supabase, order.id, TYPE);
  let eventId: string | null = null;
  let lang = normalizeLanguage(body.language) ?? "en";

  if (claimMode.mode === "error") {
    console.error("SEC-005: customer notification claim failed", claimMode.error);
    return jsonResponse(req, 500, { error: "Notification service unavailable" });
  }
  if (claimMode.mode === "outbox") {
    const claim = claimMode.claim;
    if (claim.outcome === "already_sent") return jsonResponse(req, 200, { success: true, status: "already_sent" });
    if (claim.outcome === "processing") return jsonResponse(req, 202, { success: true, status: "processing" });
    if (claim.outcome === "uncertain") return jsonResponse(req, 409, { error: "Notification delivery requires review" });
    if (claim.outcome === "unavailable") return jsonResponse(req, 409, { error: "Notification event unavailable" });
    if (claim.outcome === "unauthorized") return jsonResponse(req, 404, { error: "Order not found" });
    if (claim.outcome !== "claimed" || !claim.event_id) return jsonResponse(req, 400, { error: "Notification request rejected" });
    eventId = claim.event_id;
    lang = normalizeLanguage(claim.language) ?? "en";
  } else if (!normalizeLanguage(body.language)) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("preferred_language")
      .eq("id", user.id)
      .maybeSingle();
    lang = normalizeLanguage(profile?.preferred_language) ?? "en";
  }

  let location: PickupLocation | null = null;
  if (order.pickup_location_id) {
    const { data } = await supabase
      .from("cms_pickup_locations")
      .select("id, name_en, name_th, name_zh, maps_url")
      .eq("id", order.pickup_location_id)
      .maybeSingle();
    location = data as PickupLocation | null;
  }

  let pickupDay: PickupDay | null = null;
  if (order.pickup_day) {
    const { data } = await supabase
      .from("cms_pickup_days")
      .select("id, label, label_en, label_th, label_zh, location_id")
      .eq("label", order.pickup_day)
      .maybeSingle();
    pickupDay = data as PickupDay | null;

    if (!location && pickupDay?.location_id) {
      const { data: fallbackLocation } = await supabase
        .from("cms_pickup_locations")
        .select("id, name_en, name_th, name_zh, maps_url")
        .eq("id", pickupDay.location_id)
        .maybeSingle();
      location = fallbackLocation as PickupLocation | null;
    }
  }

  const items: OrderItem[] = Array.isArray(order.order_items) ? order.order_items : [];
  const email = buildEmail(order, items, location, pickupDay, lang);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.error("SEC-005: RESEND_API_KEY is not configured");
    if (eventId) await finishNotification(supabase, eventId, "failed", null, "Email provider not configured");
    return jsonResponse(req, 500, { error: "Notification service unavailable" });
  }

  const resend = new Resend(resendKey);
  try {
    const { data, error } = await resend.emails.send({
      from: "JOKO TODAY <orders@joko.today>",
      to: order.customer_email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      attachments: [jokoEmailLogoAttachment()],
    }, { idempotencyKey: notificationIdempotencyKey(TYPE, order.id) });

    if (error) {
      const summary = providerErrorSummary(error);
      console.error("SEC-005: customer confirmation provider rejected request", summary);
      if (eventId) await finishNotification(supabase, eventId, "failed", null, summary);
      return jsonResponse(req, 502, { error: "Email provider rejected notification" });
    }

    if (eventId) {
      const persisted = await finishNotification(supabase, eventId, "sent", data?.id ?? null, null);
      if (!persisted) return jsonResponse(req, 503, { error: "Notification delivery state unavailable" });
    }

    return jsonResponse(req, 200, { success: true, status: "sent" });
  } catch (error) {
    const summary = providerErrorSummary(error);
    console.error("SEC-005: customer confirmation delivery outcome uncertain", summary);
    if (eventId) await finishNotification(supabase, eventId, "uncertain", null, summary);
    return jsonResponse(req, 503, { error: "Notification delivery outcome unavailable" });
  }
});
