import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Resend } from "npm:resend";
import {
  authenticateNotificationRequest,
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
  type TransactionalEmailLanguage,
} from "../_shared/transactional-email.ts";

type Language = TransactionalEmailLanguage;
const TYPE = "payment_confirmation" as const;
const MY_ORDERS_URL = "https://joko.today/my-orders";

type OrderItem = {
  product_id: string;
  product_name: string;
  product_name_th?: string;
  product_name_zh?: string;
  quantity: number;
  price_at_order: number;
};

type PickupLocation = {
  id: string;
  name_en: string;
  name_th: string;
  name_zh: string;
};

type Order = {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_email: string | null;
  total_amount: number;
  loyalty_discount_amount?: number | null;
  amount_paid?: number | null;
  payment_status: string;
  payment_method?: string | null;
  status: string;
  pickup_date: string | null;
  pickup_location_id: string | null;
  order_items: OrderItem[];
};

type Copy = {
  subject: string;
  eyebrow: string;
  heading: string;
  greetingPrefix: string;
  greetingSuffix: string;
  introStripe: string;
  introEasySlip: string;
  introGeneric: string;
  order: string;
  amount: string;
  status: string;
  statusPaid: string;
  pickup: string;
  pickupLocation: string;
  items: string;
  unitPrice: string;
  subtotal: string;
  discount: string;
  totalPaid: string;
  viewOrders: string;
  footer: string;
};

const COPY: Record<Language, Copy> = {
  en: {
    subject: "Payment confirmed",
    eyebrow: "Payment verified",
    heading: "Your order is confirmed.",
    greetingPrefix: "Hi ",
    greetingSuffix: ",",
    introStripe: "Your Stripe PromptPay payment has been confirmed automatically. No payment slip is required and no further payment action is needed.",
    introEasySlip: "Your PromptPay payment slip has been verified automatically. No further payment action is needed.",
    introGeneric: "Your PromptPay payment has been confirmed automatically. No further payment action is needed.",
    order: "Order",
    amount: "Payment received",
    status: "Order status",
    statusPaid: "Paid · Confirmed",
    pickup: "Pickup date",
    pickupLocation: "Pickup location",
    items: "Your order",
    unitPrice: "Unit price",
    subtotal: "Subtotal",
    discount: "Loyalty discount",
    totalPaid: "Total paid",
    viewOrders: "View my orders",
    footer: "Thank you for choosing JOKO TODAY",
  },
  th: {
    subject: "ยืนยันการชำระเงินแล้ว",
    eyebrow: "ตรวจสอบการชำระเงินแล้ว",
    heading: "คำสั่งซื้อของคุณได้รับการยืนยันแล้ว",
    greetingPrefix: "สวัสดีคุณ ",
    greetingSuffix: "",
    introStripe: "Stripe ยืนยันการชำระผ่านพร้อมเพย์ของคุณเรียบร้อยแล้วโดยอัตโนมัติ ไม่ต้องอัปโหลดสลิปและไม่ต้องดำเนินการชำระเงินเพิ่มเติม",
    introEasySlip: "ระบบตรวจสอบสลิปพร้อมเพย์ของคุณเรียบร้อยแล้วโดยอัตโนมัติ คุณไม่ต้องดำเนินการชำระเงินเพิ่มเติม",
    introGeneric: "ระบบยืนยันการชำระผ่านพร้อมเพย์ของคุณเรียบร้อยแล้วโดยอัตโนมัติ คุณไม่ต้องดำเนินการชำระเงินเพิ่มเติม",
    order: "คำสั่งซื้อ",
    amount: "ยอดชำระที่ได้รับ",
    status: "สถานะคำสั่งซื้อ",
    statusPaid: "ชำระแล้ว · ยืนยันแล้ว",
    pickup: "วันรับสินค้า",
    pickupLocation: "สถานที่รับสินค้า",
    items: "รายการของคุณ",
    unitPrice: "ราคาต่อชิ้น",
    subtotal: "ยอดก่อนส่วนลด",
    discount: "ส่วนลดสมาชิก",
    totalPaid: "ยอดชำระรวม",
    viewOrders: "ดูคำสั่งซื้อของฉัน",
    footer: "ขอบคุณที่เลือก JOKO TODAY",
  },
  zh: {
    subject: "付款已确认",
    eyebrow: "付款已验证",
    heading: "您的订单已确认。",
    greetingPrefix: "您好，",
    greetingSuffix: "",
    introStripe: "您的 Stripe PromptPay 付款已自动确认。无需上传付款回执，也无需进行其他付款操作。",
    introEasySlip: "您的 PromptPay 付款回执已自动验证成功。无需进行其他付款操作。",
    introGeneric: "您的 PromptPay 付款已自动确认。无需进行其他付款操作。",
    order: "订单",
    amount: "已收付款",
    status: "订单状态",
    statusPaid: "已付款 · 已确认",
    pickup: "取货日期",
    pickupLocation: "取货地点",
    items: "您的订单",
    unitPrice: "单价",
    subtotal: "优惠前金额",
    discount: "会员优惠",
    totalPaid: "实付总额",
    viewOrders: "查看我的订单",
    footer: "感谢您选择 JOKO TODAY",
  },
};

function normalizeLanguage(value: unknown): Language | null {
  return value === "en" || value === "th" || value === "zh" ? value : null;
}

function formatPickupDate(value: string | null, lang: Language): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString(
    lang === "th" ? "th-TH" : lang === "zh" ? "zh-CN" : "en-GB",
    { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" },
  );
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

function money(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function buildItemRows(items: OrderItem[], lang: Language, copy: Copy): string {
  return items.map((item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.price_at_order);
    const lineTotal = quantity * unitPrice;
    return `
      <tr>
        <td valign="top" style="width:48px;padding:13px 8px 13px 0;border-bottom:1px solid ${JOKO_EMAIL_THEME.border};font-size:14px;line-height:1.5;font-weight:700;color:${JOKO_EMAIL_THEME.sageDark};">${quantity}×</td>
        <td valign="top" style="padding:13px 8px;border-bottom:1px solid ${JOKO_EMAIL_THEME.border};font-size:15px;line-height:${lang === "en" ? "1.5" : "1.75"};font-weight:600;color:${JOKO_EMAIL_THEME.charcoal};">
          ${escapeHtml(getProductName(item, lang))}
          <div style="margin-top:3px;font-size:12px;line-height:1.45;font-weight:500;color:${JOKO_EMAIL_THEME.subtle};">${escapeHtml(copy.unitPrice)}: ฿${unitPrice.toFixed(2)}</div>
        </td>
        <td valign="top" align="right" style="padding:13px 0 13px 8px;border-bottom:1px solid ${JOKO_EMAIL_THEME.border};font-size:15px;line-height:1.5;font-weight:700;white-space:nowrap;color:${JOKO_EMAIL_THEME.charcoal};">฿${lineTotal.toFixed(2)}</td>
      </tr>`;
  }).join("");
}

function buildPlainTextItems(items: OrderItem[], lang: Language, copy: Copy): string[] {
  return items.map((item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.price_at_order);
    return `${quantity} × ${getProductName(item, lang)} · ${copy.unitPrice}: ฿${unitPrice.toFixed(2)} — ฿${(quantity * unitPrice).toFixed(2)}`;
  });
}

function buildEmail(
  order: Order,
  items: OrderItem[],
  location: PickupLocation | null,
  paymentMode: string | null,
  lang: Language,
) {
  const copy = COPY[lang];
  const subject = `${copy.subject} · #${order.order_number}`;
  const greeting = `${copy.greetingPrefix}${order.customer_name}${copy.greetingSuffix}`;
  const gross = money(order.total_amount);
  const discount = Math.max(0, money(order.loyalty_discount_amount));
  const netDue = Math.max(0, gross - discount);
  const amountPaid = order.amount_paid == null ? netDue : money(order.amount_paid);
  const pickupDate = formatPickupDate(order.pickup_date, lang);
  const locationName = getLocationName(location, lang);
  const introText = paymentMode === "stripe_promptpay"
    ? copy.introStripe
    : paymentMode === "kshop_master" || paymentMode === "kshop_easyslip"
      ? copy.introEasySlip
      : copy.introGeneric;
  const itemRows = buildItemRows(items, lang, copy);
  const totalsHtml = discount > 0
    ? `
      <tr>
        <td colspan="2" style="padding:17px 8px 4px 0;text-align:right;font-size:14px;line-height:1.5;color:${JOKO_EMAIL_THEME.muted};">${escapeHtml(copy.subtotal)}</td>
        <td align="right" style="padding:17px 0 4px 8px;font-size:15px;line-height:1.4;font-weight:700;white-space:nowrap;color:${JOKO_EMAIL_THEME.charcoal};">฿${gross.toFixed(2)}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:6px 8px 4px 0;text-align:right;font-size:14px;line-height:1.5;color:${JOKO_EMAIL_THEME.ochre};">${escapeHtml(copy.discount)}</td>
        <td align="right" style="padding:6px 0 4px 8px;font-size:15px;line-height:1.4;font-weight:700;white-space:nowrap;color:${JOKO_EMAIL_THEME.ochre};">−฿${discount.toFixed(2)}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:10px 8px 4px 0;text-align:right;font-size:14px;line-height:1.5;font-weight:700;color:${JOKO_EMAIL_THEME.muted};">${escapeHtml(copy.totalPaid)}</td>
        <td align="right" style="padding:10px 0 4px 8px;font-size:20px;line-height:1.4;font-weight:800;white-space:nowrap;color:${JOKO_EMAIL_THEME.charcoal};">฿${amountPaid.toFixed(2)}</td>
      </tr>`
    : `
      <tr>
        <td colspan="2" style="padding:17px 8px 4px 0;text-align:right;font-size:14px;line-height:1.5;font-weight:700;color:${JOKO_EMAIL_THEME.muted};">${escapeHtml(copy.totalPaid)}</td>
        <td align="right" style="padding:17px 0 4px 8px;font-size:20px;line-height:1.4;font-weight:800;white-space:nowrap;color:${JOKO_EMAIL_THEME.charcoal};">฿${amountPaid.toFixed(2)}</td>
      </tr>`;

  const contentHtml = `
    <p style="margin:0 0 8px;font-size:16px;line-height:${lang === "en" ? "1.55" : "1.8"};font-weight:650;color:${JOKO_EMAIL_THEME.charcoal};">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:${lang === "en" ? "1.65" : "1.85"};color:${JOKO_EMAIL_THEME.muted};">${escapeHtml(introText)}</p>

    <div style="padding:20px;background:${JOKO_EMAIL_THEME.successSoft};border-radius:9px;">
      <div style="font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:${JOKO_EMAIL_THEME.sageDark};">${escapeHtml(copy.order)}</div>
      <div style="margin-top:5px;font-size:20px;line-height:1.3;font-weight:800;color:${JOKO_EMAIL_THEME.charcoal};font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">#${escapeHtml(order.order_number)}</div>
      <div style="margin-top:18px;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:${JOKO_EMAIL_THEME.sageDark};">${escapeHtml(copy.amount)}</div>
      <div style="margin-top:4px;font-size:28px;line-height:1.25;font-weight:800;color:${JOKO_EMAIL_THEME.ochre};">฿${amountPaid.toFixed(2)}</div>
      <div style="margin-top:18px;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:${JOKO_EMAIL_THEME.sageDark};">${escapeHtml(copy.status)}</div>
      <div style="margin-top:4px;font-size:15px;line-height:1.5;font-weight:700;color:${JOKO_EMAIL_THEME.charcoal};">${escapeHtml(copy.statusPaid)}</div>
      <div style="margin-top:18px;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:${JOKO_EMAIL_THEME.sageDark};">${escapeHtml(copy.pickup)}</div>
      <div style="margin-top:4px;font-size:15px;line-height:1.5;font-weight:650;color:${JOKO_EMAIL_THEME.charcoal};">${escapeHtml(pickupDate)}</div>
      <div style="margin-top:18px;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:${JOKO_EMAIL_THEME.sageDark};">${escapeHtml(copy.pickupLocation)}</div>
      <div style="margin-top:4px;font-size:15px;line-height:1.5;font-weight:650;color:${JOKO_EMAIL_THEME.charcoal};">${escapeHtml(locationName)}</div>
    </div>

    <div style="margin-top:26px;margin-bottom:10px;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${JOKO_EMAIL_THEME.subtle};">${escapeHtml(copy.items)}</div>
    <table width="100%" role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
      <tbody>
        ${itemRows}
        ${totalsHtml}
      </tbody>
    </table>

    <div style="margin-top:28px;text-align:center;">${renderPrimaryButton(MY_ORDERS_URL, copy.viewOrders)}</div>`;

  const html = buildTransactionalEmailShell({
    language: lang,
    title: subject,
    preheader: `#${order.order_number} · ${copy.statusPaid}`,
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
    introText,
    "",
    `${copy.order}: #${order.order_number}`,
    `${copy.amount}: ฿${amountPaid.toFixed(2)}`,
    `${copy.status}: ${copy.statusPaid}`,
    `${copy.pickup}: ${pickupDate}`,
    `${copy.pickupLocation}: ${locationName}`,
    "",
    copy.items,
    ...buildPlainTextItems(items, lang, copy),
    ...(discount > 0 ? [
      `${copy.subtotal}: ฿${gross.toFixed(2)}`,
      `${copy.discount}: −฿${discount.toFixed(2)}`,
    ] : []),
    `${copy.totalPaid}: ฿${amountPaid.toFixed(2)}`,
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

  const auth = await authenticateNotificationRequest(req);
  if (!auth.ok) return auth.response;
  const { supabase, user, internal } = auth.value;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, 400, { error: "Invalid JSON body" });
  }

  const orderId = body.order_id;
  if (!isValidUuid(orderId)) return jsonResponse(req, 400, { error: "Invalid order_id" });

  let orderQuery = supabase
    .from("orders")
    .select("id, order_number, customer_id, customer_name, customer_email, total_amount, loyalty_discount_amount, amount_paid, payment_status, payment_method, status, pickup_date, pickup_location_id, order_items")
    .eq("id", orderId)
    .eq("purchase_type", "online");

  if (!internal && user) orderQuery = orderQuery.eq("customer_id", user.id);

  const { data: orderData, error: orderError } = await orderQuery.maybeSingle();

  if (orderError) {
    console.error("Payment confirmation order lookup failed", orderError.message);
    return jsonResponse(req, 500, { error: "Notification service unavailable" });
  }
  if (!orderData) return jsonResponse(req, 404, { error: "Order not found" });

  const order = orderData as Order;
  if (order.payment_status !== "paid" || order.payment_method !== "promptpay_online") {
    return jsonResponse(req, 409, { error: "Online payment is not confirmed" });
  }
  if (!order.customer_email) return jsonResponse(req, 409, { error: "Order cannot receive email" });

  const claimMode = await claimNotification(supabase, order.id, TYPE);
  if (claimMode.mode === "error") {
    console.error("Payment confirmation notification claim failed", claimMode.error);
    return jsonResponse(req, 500, { error: "Notification service unavailable" });
  }
  if (claimMode.mode !== "outbox") {
    return jsonResponse(req, 409, { error: "Payment notification event unavailable" });
  }

  const claim = claimMode.claim;
  if (claim.outcome === "already_sent") return jsonResponse(req, 200, { success: true, status: "already_sent" });
  if (claim.outcome === "processing") return jsonResponse(req, 202, { success: true, status: "processing" });
  if (claim.outcome === "uncertain") return jsonResponse(req, 409, { error: "Notification delivery requires review" });
  if (claim.outcome === "unavailable") return jsonResponse(req, 409, { error: "Notification event unavailable" });
  if (claim.outcome !== "claimed" || !claim.event_id) return jsonResponse(req, 400, { error: "Notification request rejected" });

  const eventId = claim.event_id;
  const lang = normalizeLanguage(claim.language) ?? "en";

  const { data: paymentTransaction } = await supabase
    .from("payment_transactions")
    .select("payment_mode")
    .eq("order_id", order.id)
    .maybeSingle();

  let location: PickupLocation | null = null;
  if (order.pickup_location_id) {
    const { data: locationData } = await supabase
      .from("cms_pickup_locations")
      .select("id, name_en, name_th, name_zh")
      .eq("id", order.pickup_location_id)
      .maybeSingle();
    location = locationData as PickupLocation | null;
  }

  const items: OrderItem[] = Array.isArray(order.order_items) ? order.order_items : [];
  const email = buildEmail(
    order,
    items,
    location,
    typeof paymentTransaction?.payment_mode === "string" ? paymentTransaction.payment_mode : null,
    lang,
  );

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
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
      attachments: [jokoEmailLogoAttachment()],
    }, { idempotencyKey: notificationIdempotencyKey(TYPE, order.id) });

    if (error) {
      const summary = providerErrorSummary(error);
      console.error("Payment confirmation provider rejected request", summary);
      await finishNotification(supabase, eventId, "failed", null, summary);
      return jsonResponse(req, 502, { error: "Email provider rejected notification" });
    }

    const persisted = await finishNotification(supabase, eventId, "sent", data?.id ?? null, null);
    if (!persisted) return jsonResponse(req, 503, { error: "Notification delivery state unavailable" });

    return jsonResponse(req, 200, { success: true, status: "sent" });
  } catch (error) {
    const summary = providerErrorSummary(error);
    console.error("Payment confirmation delivery outcome uncertain", summary);
    await finishNotification(supabase, eventId, "uncertain", null, summary);
    return jsonResponse(req, 503, { error: "Notification delivery outcome unavailable" });
  }
});
