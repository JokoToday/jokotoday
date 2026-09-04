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
  renderPrimaryButton,
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
  pickup_date: string | null;
  pickup_day: string | null;
  pickup_location_id: string | null;
  order_items: OrderItem[];
  status: string;
}

interface PickupLocation {
  id: string;
  name_en: string;
  name_th: string;
  name_zh: string | null;
}

type Language = TransactionalEmailLanguage;
const TYPE = "customer_cancellation" as const;
const MY_ORDERS_URL = "https://joko.today/?page=my-orders";

function normalizeLanguage(value: unknown): Language | null {
  return value === "en" || value === "th" || value === "zh" ? value : null;
}

function getProductName(item: OrderItem, lang: Language): string {
  if (lang === "th") return item.product_name_th || item.product_name || "—";
  if (lang === "zh") return item.product_name_zh || item.product_name || "—";
  return item.product_name || "—";
}

function getLocationName(location: PickupLocation | null, lang: Language): string {
  if (!location) return "—";
  if (lang === "th") return location.name_th || location.name_en;
  if (lang === "zh") return location.name_zh || location.name_en;
  return location.name_en;
}

function formatPickupDate(value: string | null, lang: Language): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return date.toLocaleDateString(
    lang === "th" ? "th-TH" : lang === "zh" ? "zh-CN" : "en-GB",
    { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" },
  );
}

type EmailCopy = {
  subject: string;
  eyebrow: string;
  heading: string;
  greetingPrefix: string;
  greetingSuffix: string;
  intro: string;
  order: string;
  pickup: string;
  location: string;
  items: string;
  total: string;
  noAction: string;
  newOrder: string;
  viewOrders: string;
  footer: string;
};

const COPY: Record<Language, EmailCopy> = {
  en: {
    subject: "Order cancelled",
    eyebrow: "Order cancelled",
    heading: "Your order has been cancelled.",
    greetingPrefix: "Hi ",
    greetingSuffix: ",",
    intro: "Your cancellation is confirmed. We have released the items from this order.",
    order: "Order",
    pickup: "Original pickup",
    location: "Location",
    items: "Cancelled items",
    total: "Order total",
    noAction: "You do not need to do anything else.",
    newOrder: "Changed your mind? You can place a new order anytime, subject to current availability.",
    viewOrders: "View my orders",
    footer: "JOKO TODAY · Life is worth noticing.",
  },
  th: {
    subject: "ยกเลิกคำสั่งซื้อแล้ว",
    eyebrow: "ยกเลิกคำสั่งซื้อแล้ว",
    heading: "คำสั่งซื้อของคุณถูกยกเลิกแล้ว",
    greetingPrefix: "สวัสดีคุณ ",
    greetingSuffix: "",
    intro: "เรายืนยันการยกเลิกคำสั่งซื้อแล้ว และได้คืนจำนวนสินค้าของออเดอร์นี้เข้าสู่ระบบเรียบร้อยแล้ว",
    order: "คำสั่งซื้อ",
    pickup: "วันรับสินค้าเดิม",
    location: "สถานที่",
    items: "รายการที่ยกเลิก",
    total: "ยอดรวมคำสั่งซื้อ",
    noAction: "คุณไม่จำเป็นต้องดำเนินการเพิ่มเติม",
    newOrder: "หากเปลี่ยนใจ คุณสามารถสั่งซื้อใหม่ได้ทุกเมื่อ โดยขึ้นอยู่กับสินค้าที่มีอยู่ในขณะนั้น",
    viewOrders: "ดูคำสั่งซื้อของฉัน",
    footer: "JOKO TODAY · Life is worth noticing.",
  },
  zh: {
    subject: "订单已取消",
    eyebrow: "订单已取消",
    heading: "您的订单已取消。",
    greetingPrefix: "您好，",
    greetingSuffix: "",
    intro: "您的取消操作已确认。该订单中的商品数量已释放。",
    order: "订单",
    pickup: "原取货日期",
    location: "地点",
    items: "已取消商品",
    total: "订单总额",
    noAction: "您无需进行其他操作。",
    newOrder: "如果改变主意，您可以随时重新下单，具体以当前供应情况为准。",
    viewOrders: "查看我的订单",
    footer: "JOKO TODAY · Life is worth noticing.",
  },
};

function buildItemRows(items: OrderItem[], lang: Language): string {
  return items.map((item) => {
    const quantity = Number(item.quantity);
    const lineTotal = Number(item.price_at_order) * quantity;
    return `
      <tr>
        <td valign="top" style="width:48px;padding:13px 8px 13px 0;border-bottom:1px solid ${JOKO_EMAIL_THEME.border};font-size:14px;line-height:1.5;font-weight:700;color:${JOKO_EMAIL_THEME.sageDark};">${quantity}×</td>
        <td valign="top" style="padding:13px 8px;border-bottom:1px solid ${JOKO_EMAIL_THEME.border};font-size:15px;line-height:${lang === "en" ? "1.5" : "1.75"};font-weight:600;color:${JOKO_EMAIL_THEME.charcoal};">${escapeHtml(getProductName(item, lang))}</td>
        <td valign="top" align="right" style="padding:13px 0 13px 8px;border-bottom:1px solid ${JOKO_EMAIL_THEME.border};font-size:15px;line-height:1.5;font-weight:700;white-space:nowrap;color:${JOKO_EMAIL_THEME.charcoal};">฿${lineTotal.toFixed(2)}</td>
      </tr>`;
  }).join("");
}

function buildEmail(order: Order, location: PickupLocation | null, lang: Language) {
  const copy = COPY[lang];
  const items = Array.isArray(order.order_items) ? order.order_items : [];
  const pickup = formatPickupDate(order.pickup_date, lang);
  const locationName = getLocationName(location, lang);
  const greeting = `${copy.greetingPrefix}${order.customer_name}${copy.greetingSuffix}`;
  const subject = `${copy.subject} · #${order.order_number}`;
  const preheader = `#${order.order_number} · ${copy.subject}`;

  const contentHtml = `
    <p style="margin:0 0 8px;font-size:16px;line-height:${lang === "en" ? "1.55" : "1.8"};font-weight:650;color:${JOKO_EMAIL_THEME.charcoal};">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:${lang === "en" ? "1.65" : "1.85"};color:${JOKO_EMAIL_THEME.muted};">${escapeHtml(copy.intro)}</p>

    <div style="margin:0 0 24px;padding:18px 20px;background:${JOKO_EMAIL_THEME.note};border:1px solid ${JOKO_EMAIL_THEME.border};border-radius:7px;">
      <div style="font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${JOKO_EMAIL_THEME.ochre};">${escapeHtml(copy.order)}</div>
      <div style="margin-top:5px;font-size:20px;line-height:1.3;font-weight:800;color:${JOKO_EMAIL_THEME.charcoal};font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">#${escapeHtml(order.order_number)}</div>
    </div>

    <div style="margin:0 0 26px;padding:18px 20px;background:${JOKO_EMAIL_THEME.successSoft};border-radius:9px;">
      <div style="font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:${JOKO_EMAIL_THEME.sageDark};">${escapeHtml(copy.pickup)}</div>
      <div style="margin-top:5px;font-size:16px;line-height:${lang === "en" ? "1.45" : "1.7"};font-weight:700;color:${JOKO_EMAIL_THEME.charcoal};">${escapeHtml(pickup)}</div>
      <div style="margin-top:14px;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:${JOKO_EMAIL_THEME.sageDark};">${escapeHtml(copy.location)}</div>
      <div style="margin-top:5px;font-size:15px;line-height:${lang === "en" ? "1.45" : "1.7"};font-weight:650;color:${JOKO_EMAIL_THEME.charcoal};">${escapeHtml(locationName)}</div>
    </div>

    <div style="margin-bottom:10px;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${JOKO_EMAIL_THEME.subtle};">${escapeHtml(copy.items)}</div>
    <table width="100%" role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
      <tbody>
        ${buildItemRows(items, lang)}
        <tr>
          <td colspan="2" style="padding:17px 8px 4px 0;text-align:right;font-size:14px;line-height:1.5;color:${JOKO_EMAIL_THEME.muted};">${escapeHtml(copy.total)}</td>
          <td align="right" style="padding:17px 0 4px 8px;font-size:20px;line-height:1.4;font-weight:800;white-space:nowrap;color:${JOKO_EMAIL_THEME.charcoal};">฿${Number(order.total_amount).toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <p style="margin:24px 0 6px;text-align:center;font-size:14px;line-height:${lang === "en" ? "1.6" : "1.8"};font-weight:650;color:${JOKO_EMAIL_THEME.charcoal};">${escapeHtml(copy.noAction)}</p>
    <p style="margin:0;text-align:center;font-size:13px;line-height:${lang === "en" ? "1.6" : "1.8"};color:${JOKO_EMAIL_THEME.muted};">${escapeHtml(copy.newOrder)}</p>
    <div style="margin-top:28px;text-align:center;">${renderPrimaryButton(MY_ORDERS_URL, copy.viewOrders)}</div>`;

  const html = buildTransactionalEmailShell({
    language: lang,
    title: subject,
    preheader,
    eyebrow: copy.eyebrow,
    heading: copy.heading,
    contentHtml,
    footerText: copy.footer,
  });

  const itemText = items.map((item) => {
    const quantity = Number(item.quantity);
    const lineTotal = Number(item.price_at_order) * quantity;
    return `${quantity} × ${getProductName(item, lang)} — ฿${lineTotal.toFixed(2)}`;
  });

  const text = [
    "JOKO TODAY",
    copy.heading,
    "",
    greeting,
    copy.intro,
    "",
    `${copy.order}: #${order.order_number}`,
    `${copy.pickup}: ${pickup}`,
    `${copy.location}: ${locationName}`,
    "",
    copy.items,
    ...itemText,
    `${copy.total}: ฿${Number(order.total_amount).toFixed(2)}`,
    "",
    copy.noAction,
    copy.newOrder,
    "",
    `${copy.viewOrders}: ${MY_ORDERS_URL}`,
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
    .select("id, order_number, customer_id, customer_name, customer_email, total_amount, pickup_date, pickup_day, pickup_location_id, order_items, status")
    .eq("id", orderId)
    .eq("customer_id", user.id)
    .eq("purchase_type", "online")
    .maybeSingle();

  if (orderError) {
    console.error("SEC-005: cancellation order lookup failed", orderError.message);
    return jsonResponse(req, 500, { error: "Notification service unavailable" });
  }
  if (!orderData) return jsonResponse(req, 404, { error: "Order not found" });

  const order = orderData as Order;
  if (order.status !== "cancelled") return jsonResponse(req, 409, { error: "Order is not cancelled" });
  if (!order.customer_email) return jsonResponse(req, 409, { error: "Order cannot receive email" });

  const claimMode = await claimNotification(supabase, order.id, TYPE);
  let eventId: string | null = null;
  let lang: Language = "en";

  if (claimMode.mode === "error") {
    console.error("SEC-005: cancellation notification claim failed", claimMode.error);
    return jsonResponse(req, 500, { error: "Notification service unavailable" });
  }
  if (claimMode.mode !== "outbox") {
    return jsonResponse(req, 409, { error: "Cancellation notification event unavailable" });
  }

  const claim = claimMode.claim;
  if (claim.outcome === "already_sent") return jsonResponse(req, 200, { success: true, status: "already_sent" });
  if (claim.outcome === "processing") return jsonResponse(req, 202, { success: true, status: "processing" });
  if (claim.outcome === "uncertain") return jsonResponse(req, 409, { error: "Notification delivery requires review" });
  if (claim.outcome === "unavailable") return jsonResponse(req, 409, { error: "Notification event unavailable" });
  if (claim.outcome !== "claimed" || !claim.event_id) return jsonResponse(req, 400, { error: "Notification request rejected" });

  eventId = claim.event_id;
  lang = normalizeLanguage(claim.language) ?? "en";

  let location: PickupLocation | null = null;
  if (order.pickup_location_id) {
    const { data } = await supabase
      .from("cms_pickup_locations")
      .select("id, name_en, name_th, name_zh")
      .eq("id", order.pickup_location_id)
      .maybeSingle();
    location = data as PickupLocation | null;
  }

  const email = buildEmail(order, location, lang);
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.error("SEC-005: RESEND_API_KEY is not configured");
    await finishNotification(supabase, eventId, "failed", null, "Email provider not configured");
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
    }, { idempotencyKey: notificationIdempotencyKey(TYPE, order.id) });

    if (error) {
      const summary = providerErrorSummary(error);
      console.error("SEC-005: cancellation provider rejected request", summary);
      await finishNotification(supabase, eventId, "failed", null, summary);
      return jsonResponse(req, 502, { error: "Email provider rejected notification" });
    }

    const persisted = await finishNotification(supabase, eventId, "sent", data?.id ?? null, null);
    if (!persisted) return jsonResponse(req, 503, { error: "Notification delivery state unavailable" });
    return jsonResponse(req, 200, { success: true, status: "sent" });
  } catch (error) {
    const summary = providerErrorSummary(error);
    console.error("SEC-005: cancellation delivery outcome uncertain", summary);
    await finishNotification(supabase, eventId, "uncertain", null, summary);
    return jsonResponse(req, 503, { error: "Notification delivery outcome unavailable" });
  }
});
