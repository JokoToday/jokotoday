import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.111.0";
import { Resend } from "npm:resend";
import {
  claimNotification,
  finishNotification,
  handlePreflight,
  jsonResponse,
  notificationIdempotencyKey,
  providerErrorSummary,
  rejectDisallowedOrigin,
  customerNotificationChannelEnabled,
  resolveCustomerNotificationRecipient,
  type NotificationType,
} from "../_shared/order-notifications.ts";
import {
  buildTransactionalEmailShell,
  escapeHtml,
  JOKO_EMAIL_THEME,
  jokoEmailLogoAttachment,
  renderPrimaryButton,
} from "../_shared/transactional-email.ts";

type Language = "en" | "th" | "zh";
type DeliveryStatus = "sent" | "failed" | "unavailable" | "not_applicable" | "skipped_preference" | "paused";

type LabelRow = {
  key: string;
  text_en: string;
  text_th: string;
  text_zh?: string | null;
};

type OrderItem = {
  product_id?: string;
  product_name?: string;
  product_name_th?: string | null;
  product_name_zh?: string | null;
  maker_name_en?: string | null;
  maker_name_th?: string | null;
  maker_name_zh?: string | null;
  quantity?: number;
  price_at_order?: number;
};

type OrderRecord = {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  order_items: OrderItem[] | null;
  total_amount: number | string | null;
  loyalty_discount_amount: number | string | null;
  amount_paid: number | string | null;
  pickup_day: string | null;
  pickup_date: string | null;
  pickup_location_id: string | null;
  status: string | null;
  payment_status: string | null;
  payment_method: string | null;
  created_at: string | null;
  picked_up_at: string | null;
  customer_received_at: string | null;
  purchase_type: string | null;
  walk_in_amount: number | string | null;
  loyalty_points_earned: number | string | null;
};

type ReceiptRecord = {
  receipt_number: string;
  issued_at: string;
};

type PickupLocationRecord = {
  name_en: string | null;
  name_th: string | null;
  name_zh: string | null;
};

type PickupDayRecord = {
  label: string | null;
  label_en: string | null;
  label_th: string | null;
  label_zh: string | null;
  location_id: string | null;
};

const FALLBACK = {
  receipt: {
    title: { en: "Receipt", th: "ใบเสร็จรับเงิน", zh: "收据" },
    receiptNumber: { en: "Receipt", th: "เลขที่ใบเสร็จ", zh: "收据编号" },
    issued: { en: "Issued", th: "ออกเมื่อ", zh: "开具时间" },
    customer: { en: "Customer", th: "ลูกค้า", zh: "客户" },
    order: { en: "Order", th: "คำสั่งซื้อ", zh: "订单" },
    ordered: { en: "Ordered", th: "วันที่สั่งซื้อ", zh: "下单日期" },
    pickup: { en: "Scheduled pickup", th: "วันรับสินค้าที่กำหนด", zh: "计划取货" },
    pickedUp: { en: "Staff handover", th: "เวลาส่งมอบโดยพนักงาน", zh: "员工交付" },
    received: { en: "Customer confirmed receipt", th: "ลูกค้ายืนยันรับสินค้า", zh: "客户确认收货" },
    location: { en: "Pickup location", th: "สถานที่รับสินค้า", zh: "取货地点" },
    status: { en: "Status", th: "สถานะ", zh: "状态" },
    statusCompleted: { en: "Completed", th: "เสร็จสิ้น", zh: "已完成" },
    payment: { en: "Payment", th: "การชำระเงิน", zh: "付款" },
    paymentPaid: { en: "Paid · ฿{{amount}} · {{method}}", th: "ชำระแล้ว · ฿{{amount}} · {{method}}", zh: "已付款 · ฿{{amount}} · {{method}}" },
    items: { en: "Items", th: "รายการสินค้า", zh: "商品" },
    quantity: { en: "Qty", th: "จำนวน", zh: "数量" },
    unitPrice: { en: "Unit price", th: "ราคาต่อชิ้น", zh: "单价" },
    subtotal: { en: "Subtotal", th: "ยอดก่อนส่วนลด", zh: "小计" },
    discount: { en: "Discount", th: "ส่วนลด", zh: "折扣" },
    totalPaid: { en: "Total paid", th: "ยอดชำระแล้ว", zh: "实付金额" },
    pointsEarned: { en: "Points earned", th: "แต้มที่ได้รับ", zh: "获得积分" },
    disclaimer: {
      en: "This receipt records payment and product receipt confirmation. It is not a tax invoice.",
      th: "ใบเสร็จนี้บันทึกการชำระเงินและการยืนยันรับสินค้า ไม่ใช่ใบกำกับภาษี",
      zh: "本收据记录付款及收货确认，并非税务发票。",
    },
    footer: { en: "THANK YOU FOR CHOOSING JOKO TODAY.", th: "ขอบคุณที่เลือก JOKO TODAY", zh: "感谢您选择 JOKO TODAY。" },
    nextOrder: { en: "Your next order", th: "สั่งครั้งถัดไป", zh: "再次订购" },
    print: { en: "Print receipt", th: "พิมพ์ใบเสร็จ", zh: "打印收据" },
  },
  email: {
    subject: { en: "Your JOKO TODAY receipt", th: "ใบเสร็จ JOKO TODAY ของคุณ", zh: "您的 JOKO TODAY 收据" },
    heading: { en: "Thank you — your receipt is ready", th: "ขอบคุณ — ใบเสร็จของคุณพร้อมแล้ว", zh: "谢谢 — 您的收据已准备好" },
    intro: {
      en: "Your pickup is complete. We have attached the receipt details to your order history.",
      th: "การรับสินค้าของคุณเสร็จสมบูรณ์แล้ว เราได้บันทึกรายละเอียดใบเสร็จไว้ในประวัติคำสั่งซื้อของคุณ",
      zh: "您的取货已完成。收据详情已保存到您的订单记录中。",
    },
    view: { en: "View / print receipt", th: "ดู / พิมพ์ใบเสร็จ", zh: "查看 / 打印收据" },
    footer: { en: "Thank you for choosing JOKO TODAY.", th: "ขอบคุณที่เลือก JOKO TODAY", zh: "感谢您选择 JOKO TODAY。" },
  },
  line: {
    title: { en: "Your JOKO TODAY receipt is ready", th: "ใบเสร็จ JOKO TODAY ของคุณพร้อมแล้ว", zh: "您的 JOKO TODAY 收据已准备好" },
    body: {
      en: "Thank you! Your pickup is complete and your receipt is saved in My Orders.",
      th: "ขอบคุณ! การรับสินค้าของคุณเสร็จสมบูรณ์ และใบเสร็จถูกบันทึกไว้ใน My Orders แล้ว",
      zh: "谢谢！您的取货已完成，收据已保存到“我的订单”。",
    },
  },
} as const;

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
}

function serviceKey(): string {
  const direct = Deno.env.get("SUPABASE_SECRET_KEY")?.trim()
    || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (direct) return direct;
  const mapped = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (mapped) {
    try {
      const parsed = JSON.parse(mapped) as Record<string, unknown>;
      if (typeof parsed.default === "string" && parsed.default.trim()) return parsed.default.trim();
    } catch {
      // Fall through.
    }
  }
  throw new Error("Supabase secret key is not configured");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeLanguage(value: unknown): Language {
  return value === "th" || value === "zh" ? value : "en";
}

function label(rows: LabelRow[], key: string, lang: Language, fallback: string): string {
  const row = rows.find((candidate) => candidate.key === key);
  if (!row) return fallback;
  if (lang === "th") return row.text_th || row.text_en || fallback;
  if (lang === "zh") return row.text_zh || row.text_en || fallback;
  return row.text_en || fallback;
}

function money(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function itemName(item: OrderItem, lang: Language): string {
  const product = lang === "th"
    ? item.product_name_th || item.product_name
    : lang === "zh"
      ? item.product_name_zh || item.product_name
      : item.product_name;
  const maker = lang === "th"
    ? item.maker_name_th || item.maker_name_en
    : lang === "zh"
      ? item.maker_name_zh || item.maker_name_en
      : item.maker_name_en;
  return (product || "—") + (maker ? " (" + maker + ")" : "");
}

function paymentMethod(method: string | null | undefined, lang: Language): string {
  if (method === "promptpay_online") return lang === "th" ? "พร้อมเพย์ออนไลน์" : lang === "zh" ? "PromptPay 在线" : "PromptPay Online";
  if (method === "qr_code" || method === "qr") return "Thai QR";
  if (method === "cash") return lang === "th" ? "เงินสด" : lang === "zh" ? "现金" : "Cash";
  return lang === "th" ? "ชำระเงินแล้ว" : lang === "zh" ? "已付款" : "Paid";
}

function formatDate(value: string | null | undefined, lang: Language): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(lang === "th" ? "th-TH" : lang === "zh" ? "zh-CN" : "en-GB", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildReceiptCopy(rows: LabelRow[], lang: Language) {
  const r = FALLBACK.receipt;
  return {
    title: label(rows, "receipt_document.title", lang, r.title[lang]),
    disclaimer: label(rows, "receipt_document.disclaimer", lang, r.disclaimer[lang]),
    receiptNumber: label(rows, "receipt_document.receipt_number", lang, r.receiptNumber[lang]),
    issued: label(rows, "receipt_document.issued", lang, r.issued[lang]),
    received: label(rows, "receipt_document.received", lang, r.received[lang]),
    nextOrder: label(rows, "receipt_document.next_order", lang, r.nextOrder[lang]),
    customer: label(rows, "receipt_document.customer", lang, r.customer[lang]),
    order: label(rows, "receipt_document.order", lang, r.order[lang]),
    ordered: label(rows, "receipt_document.ordered", lang, r.ordered[lang]),
    pickup: label(rows, "receipt_document.pickup", lang, r.pickup[lang]),
    pickedUp: label(rows, "receipt_document.picked_up", lang, r.pickedUp[lang]),
    location: label(rows, "receipt_document.location", lang, r.location[lang]),
    status: label(rows, "receipt_document.status", lang, r.status[lang]),
    payment: label(rows, "receipt_document.payment", lang, r.payment[lang]),
    items: label(rows, "receipt_document.items", lang, r.items[lang]),
    quantity: label(rows, "receipt_document.quantity", lang, r.quantity[lang]),
    unitPrice: label(rows, "receipt_document.unit_price", lang, r.unitPrice[lang]),
    gross: label(rows, "receipt_document.subtotal", lang, r.subtotal[lang]),
    discount: label(rows, "receipt_document.discount", lang, r.discount[lang]),
    totalPaid: label(rows, "receipt_document.total_paid", lang, r.totalPaid[lang]),
    amountDue: label(rows, "receipt_document.total_paid", lang, r.totalPaid[lang]),
    pointsEarned: label(rows, "receipt_document.points_earned", lang, r.pointsEarned[lang]),
    thanks: label(rows, "receipt_document.footer", lang, r.footer[lang]),
    print: label(rows, "receipt_document.print", lang, r.print[lang]),
  };
}

async function sendReceiptEmail(
  service: SupabaseClient,
  order: OrderRecord,
  receipt: ReceiptRecord,
  rows: LabelRow[],
  lang: Language,
  myOrdersUrl: string,
): Promise<DeliveryStatus> {
  if (!order.customer_email) return "not_applicable";

  try {
    if (!await customerNotificationChannelEnabled(order.customer_id, "email")) return "paused";
  } catch (error) {
    console.error("Could not check receipt email pause gate", error);
    return "unavailable";
  }

  const claim = await claimNotification(service, order.id, "customer_receipt_email");
  if (claim.mode !== "outbox") return "unavailable";
  if (claim.claim.outcome === "already_sent") return "sent";
  if (claim.claim.outcome !== "claimed" || !claim.claim.event_id) return "unavailable";

  const eventId = claim.claim.event_id;
  const resendKey = Deno.env.get("RESEND_API_KEY")?.trim();
  if (!resendKey) {
    await finishNotification(service, eventId, "failed", null, "Email provider not configured");
    return "unavailable";
  }

  const e = FALLBACK.email;
  const receiptCopy = buildReceiptCopy(rows, lang);
  const subject = label(rows, "receipt_email.subject", lang, e.subject[lang]) + " · #" + receipt.receipt_number;
  const heading = label(rows, "receipt_email.heading", lang, e.heading[lang]);
  const intro = label(rows, "receipt_email.intro", lang, e.intro[lang]);
  const view = label(rows, "receipt_email.view_receipt", lang, e.view[lang]);
  const footer = label(rows, "receipt_email.footer", lang, e.footer[lang]);
  const items = (Array.isArray(order.order_items) ? order.order_items : []) as OrderItem[];
  const gross = money(order.total_amount);
  const discount = Math.max(0, money(order.loyalty_discount_amount));
  const paid = order.amount_paid == null ? Math.max(0, gross - discount) : money(order.amount_paid);

  const itemRows = items.map((item) => {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const price = money(item.price_at_order);
    return '<tr>'
      + '<td style="padding:12px 8px 12px 0;border-bottom:1px solid ' + JOKO_EMAIL_THEME.border + ';font-weight:700;color:' + JOKO_EMAIL_THEME.sageDark + ';">' + qty + '×</td>'
      + '<td style="padding:12px 8px;border-bottom:1px solid ' + JOKO_EMAIL_THEME.border + ';color:' + JOKO_EMAIL_THEME.charcoal + ';">' + escapeHtml(itemName(item, lang)) + '</td>'
      + '<td align="right" style="padding:12px 0 12px 8px;border-bottom:1px solid ' + JOKO_EMAIL_THEME.border + ';font-weight:700;white-space:nowrap;">฿' + (qty * price).toFixed(2) + '</td>'
      + '</tr>';
  }).join("");

  const contentHtml =
    '<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:' + JOKO_EMAIL_THEME.muted + ';">' + escapeHtml(intro) + '</p>'
    + '<div style="padding:18px 20px;background:' + JOKO_EMAIL_THEME.successSoft + ';border-radius:9px;">'
    + '<div style="font-size:11px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:' + JOKO_EMAIL_THEME.sageDark + ';">' + escapeHtml(receiptCopy.receiptNumber) + '</div>'
    + '<div style="margin-top:5px;font-size:21px;font-weight:800;color:' + JOKO_EMAIL_THEME.charcoal + ';">#' + escapeHtml(receipt.receipt_number) + '</div>'
    + '<div style="margin-top:14px;font-size:13px;color:' + JOKO_EMAIL_THEME.muted + ';">' + escapeHtml(receiptCopy.order) + ' #' + escapeHtml(order.order_number) + ' · ' + escapeHtml(receiptCopy.issued) + ' ' + escapeHtml(formatDate(receipt.issued_at, lang)) + '</div>'
    + '</div>'
    + '<div style="margin-top:24px;font-size:11px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:' + JOKO_EMAIL_THEME.subtle + ';">' + escapeHtml(receiptCopy.items) + '</div>'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;border-collapse:collapse;"><tbody>' + itemRows + '</tbody></table>'
    + '<div style="margin-top:18px;text-align:right;font-size:20px;font-weight:800;color:' + JOKO_EMAIL_THEME.charcoal + ';">'
    + escapeHtml(receiptCopy.totalPaid) + ': ฿' + paid.toFixed(2) + '</div>'
    + '<div style="margin-top:28px;text-align:center;">' + renderPrimaryButton(myOrdersUrl, view) + '</div>';

  const html = buildTransactionalEmailShell({
    language: lang,
    title: subject,
    preheader: "#" + receipt.receipt_number + " · " + order.order_number,
    eyebrow: "JOKO TODAY",
    heading,
    contentHtml,
    footerText: footer,
  });

  const text = [
    "JOKO TODAY",
    heading,
    "",
    intro,
    "",
    receiptCopy.receiptNumber + ": #" + receipt.receipt_number,
    receiptCopy.order + ": #" + order.order_number,
    ...items.map((item) => {
      const qty = Math.max(0, Number(item.quantity) || 0);
      return qty + " × " + itemName(item, lang);
    }),
    receiptCopy.totalPaid + ": ฿" + paid.toFixed(2),
    "",
    view + ": " + myOrdersUrl,
    "",
    footer,
  ].join("\n");

  const resend = new Resend(resendKey);
  try {
    const { data, error } = await resend.emails.send({
      from: "JOKO TODAY <orders@joko.today>",
      to: order.customer_email,
      subject,
      html,
      text,
      attachments: [jokoEmailLogoAttachment()],
    }, { idempotencyKey: notificationIdempotencyKey("customer_receipt_email", order.id) });

    if (error) {
      const summary = providerErrorSummary(error);
      await finishNotification(service, eventId, "failed", null, summary);
      return "failed";
    }

    await finishNotification(service, eventId, "sent", data?.id ?? null, null);
    return "sent";
  } catch (error) {
    const summary = providerErrorSummary(error);
    await finishNotification(service, eventId, "uncertain", null, summary);
    return "failed";
  }
}

async function sendReceiptLine(
  service: SupabaseClient,
  order: OrderRecord,
  receipt: ReceiptRecord,
  rows: LabelRow[],
  lang: Language,
  myOrdersUrl: string,
): Promise<DeliveryStatus> {
  if (!order.customer_id) return "not_applicable";

  try {
    if (!await customerNotificationChannelEnabled(order.customer_id, "line")) return "paused";
  } catch (error) {
    console.error("Could not check receipt LINE pause gate", error);
    return "unavailable";
  }

  let lineUserId: string | null = null;
  try {
    lineUserId = await resolveCustomerNotificationRecipient(order.customer_id, "line");
  } catch (error) {
    console.error("Could not resolve receipt LINE recipient", error);
    return "unavailable";
  }
  if (!lineUserId) return "not_applicable";

  const channelToken = Deno.env.get("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN")?.trim()
    || Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN")?.trim();
  if (!channelToken) return "unavailable";

  const claim = await claimNotification(service, order.id, "customer_receipt_line");
  if (claim.mode !== "outbox") return "unavailable";
  if (claim.claim.outcome === "already_sent") return "sent";
  if (claim.claim.outcome !== "claimed" || !claim.claim.event_id) return "unavailable";

  const eventId = claim.claim.event_id;
  const l = FALLBACK.line;
  const title = label(rows, "receipt_line.title", lang, l.title[lang]);
  const body = label(rows, "receipt_line.body", lang, l.body[lang]);
  const message = title + "\n" + body + "\n#" + receipt.receipt_number + "\n" + myOrdersUrl;

  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + channelToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: "text", text: message }],
      }),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 800);
      await finishNotification(service, eventId, "failed", null, "LINE " + response.status + ": " + detail);
      return "failed";
    }

    await finishNotification(service, eventId, "sent", "line-push", null);
    return "sent";
  } catch (error) {
    await finishNotification(service, eventId, "uncertain", null, providerErrorSummary(error));
    return "failed";
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handlePreflight(req);
  if (req.method !== "POST") return jsonResponse(req, 405, { error: "Method not allowed" });

  const originRejection = rejectDisallowedOrigin(req);
  if (originRejection) return originRejection;

  try {
    const body = await req.json().catch(() => null) as { token?: unknown } | null;
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (token.length < 32 || token.length > 128) {
      return jsonResponse(req, 400, { error: "Invalid pickup confirmation" });
    }

    const service = createClient(requiredEnv("SUPABASE_URL"), serviceKey(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const tokenHash = await sha256Hex(token);
    const { data: handoff, error: handoffError } = await service
      .from("pickup_handoff_sessions")
      .select("order_id, status, expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (handoffError) throw handoffError;
    if (!handoff) return jsonResponse(req, 404, { error: "Receipt confirmation not found" });
    if (!["active", "confirmed"].includes(handoff.status)) {
      return jsonResponse(req, 410, { error: "Receipt confirmation is no longer active" });
    }
    if (handoff.status === "active" && new Date(handoff.expires_at).getTime() <= Date.now()) {
      await service
        .from("pickup_handoff_sessions")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("token_hash", tokenHash)
        .eq("status", "active");
      return jsonResponse(req, 410, { error: "Receipt confirmation has expired" });
    }

    const { data: order, error: orderError } = await service
      .from("orders")
      .select("id, order_number, customer_id, customer_name, customer_email, order_items, total_amount, loyalty_discount_amount, amount_paid, pickup_day, pickup_date, pickup_location_id, status, payment_status, payment_method, created_at, picked_up_at, customer_received_at, purchase_type, walk_in_amount, loyalty_points_earned")
      .eq("id", handoff.order_id)
      .single();

    if (orderError) throw orderError;

    const [{ data: profile }, { data: labelsData, error: labelsError }, { data: nextSetting }] = await Promise.all([
      order.customer_id
        ? service.from("user_profiles").select("preferred_language, notification_email_enabled, notification_line_enabled").eq("id", order.customer_id).maybeSingle()
        : Promise.resolve({ data: null }),
      service
        .from("cms_labels")
        .select("key, text_en, text_th, text_zh")
        .or("key.like.receipt_document.%,key.like.receipt_email.%,key.like.receipt_line.%"),
      service
        .from("cms_settings")
        .select("value")
        .eq("setting_key", "receipt_next_order_url")
        .maybeSingle(),
    ]);

    if (labelsError) throw labelsError;
    const rows = (labelsData || []) as LabelRow[];
    const lang = normalizeLanguage(profile?.preferred_language);
    const emailPreferenceEnabled = profile?.notification_email_enabled !== false;
    const linePreferenceEnabled = profile?.notification_line_enabled === true;
    let emailNotificationsEnabled = false;
    let lineNotificationsEnabled = false;
    let notificationGateUnavailable = false;
    try {
      const [emailAllowed, lineAllowed] = await Promise.all([
        customerNotificationChannelEnabled(order.customer_id, "email"),
        order.customer_id
          ? customerNotificationChannelEnabled(order.customer_id, "line")
          : Promise.resolve(false),
      ]);
      emailNotificationsEnabled = emailPreferenceEnabled && emailAllowed;
      lineNotificationsEnabled = linePreferenceEnabled && lineAllowed;
    } catch (gateError) {
      // Receipt completion is already committed. Fail closed for notification sends.
      notificationGateUnavailable = true;
      console.error("Could not check receipt notification pause gates", gateError);
    }

    let location: PickupLocationRecord | null = null;
    if (order.pickup_location_id) {
      const { data } = await service
        .from("cms_pickup_locations")
        .select("name_en, name_th, name_zh")
        .eq("id", order.pickup_location_id)
        .maybeSingle();
      location = data;
    }

    const { data: pickupRows } = await service
      .from("cms_pickup_days")
      .select("label, label_en, label_th, label_zh, location_id");
    const pickupDay = ((pickupRows || []) as PickupDayRecord[]).find((day) =>
      [day.label, day.label_en, day.label_th, day.label_zh].includes(order.pickup_day)
    ) || null;

    if (!location && pickupDay?.location_id) {
      const { data } = await service
        .from("cms_pickup_locations")
        .select("name_en, name_th, name_zh")
        .eq("id", pickupDay.location_id)
        .maybeSingle();
      location = data;
    }

    const languages: Language[] = ["en", "th", "zh"];
    const copyByLanguage = Object.fromEntries(languages.map((language) => [
      language,
      buildReceiptCopy(rows, language),
    ]));

    const pickupLabels = Object.fromEntries(languages.map((language) => {
      const value = language === "th"
        ? pickupDay?.label_th || pickupDay?.label_en || order.pickup_day
        : language === "zh"
          ? pickupDay?.label_zh || pickupDay?.label_en || order.pickup_day
          : pickupDay?.label_en || pickupDay?.label || order.pickup_day;
      return [language, value || "—"];
    }));

    const pickupLocationNames = Object.fromEntries(languages.map((language) => {
      const value = language === "th"
        ? location?.name_th || location?.name_en
        : language === "zh"
          ? location?.name_zh || location?.name_en
          : location?.name_en;
      return [language, value || "—"];
    }));

    const gross = money(order.total_amount);
    const discount = Math.max(0, money(order.loyalty_discount_amount));
    const amountPaid = order.amount_paid == null ? Math.max(0, gross - discount) : money(order.amount_paid);

    const statusLabels = Object.fromEntries(languages.map((language) => [
      language,
      label(rows, "receipt_document.status_completed", language, FALLBACK.receipt.statusCompleted[language]),
    ]));

    const paymentDescriptions = Object.fromEntries(languages.map((language) => {
      const template = label(rows, "receipt_document.payment_paid", language, FALLBACK.receipt.paymentPaid[language]);
      return [
        language,
        template
          .replace("{{amount}}", amountPaid.toFixed(2))
          .replace("{{method}}", paymentMethod(order.payment_method, language)),
      ];
    }));

    const receiptNumber = "JTR-" + order.order_number;
    const issuedAt = new Date().toISOString();
    const snapshot = {
      version: 1,
      receipt_number: receiptNumber,
      issued_at: issuedAt,
      customer_received_at: order.customer_received_at || issuedAt,
      order: {
        order_number: order.order_number,
        customer_name: order.customer_name,
        order_items: order.order_items || [],
        total_amount: order.total_amount,
        loyalty_discount_amount: order.loyalty_discount_amount,
        amount_paid: order.amount_paid,
        purchase_type: order.purchase_type,
        walk_in_amount: order.walk_in_amount,
        pickup_date: order.pickup_date,
        picked_up_at: order.picked_up_at,
        customer_received_at: order.customer_received_at || issuedAt,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        created_at: order.created_at,
        loyalty_points_earned: order.loyalty_points_earned,
        status: "completed",
      },
      pickup_labels: pickupLabels,
      pickup_location_names: pickupLocationNames,
      status_labels: statusLabels,
      payment_descriptions: paymentDescriptions,
      copy_by_language: copyByLanguage,
      next_order_url: nextSetting?.value || "/products?from=receipt",
    };

    const { data: completion, error: completionError } = await service.rpc(
      "complete_order_customer_receipt",
      {
        p_token_hash: tokenHash,
        p_receipt_number: receiptNumber,
        p_issued_at: issuedAt,
        p_snapshot: snapshot,
      },
    );

    if (completionError) {
      const message = completionError.message || "Could not confirm product receipt";
      const status = /expired|no longer active/i.test(message) ? 410 : /not found/i.test(message) ? 404 : 409;
      return jsonResponse(req, status, { error: message });
    }

    if (
      !completion
      || typeof completion.receipt_number !== "string"
      || typeof completion.issued_at !== "string"
    ) {
      throw new Error("Invalid receipt completion response");
    }

    const receipt: ReceiptRecord = {
      receipt_number: completion.receipt_number,
      issued_at: completion.issued_at,
    };
    const customerReceivedAt = typeof completion.customer_received_at === "string"
      ? completion.customer_received_at
      : order.customer_received_at || issuedAt;

    const notificationRows: Array<{ order_id: string; notification_type: NotificationType; language: Language }> = [];
    if (emailNotificationsEnabled && order.customer_email) {
      notificationRows.push({ order_id: order.id, notification_type: "customer_receipt_email", language: lang });
    }

    if (lineNotificationsEnabled && order.customer_id) {
      const { data: authUser } = await service.auth.admin.getUserById(order.customer_id);
      const hasLine = Boolean(authUser.user?.identities?.some((identity) =>
        identity.provider === "custom:line" && typeof identity.identity_data?.sub === "string"
      ));
      if (hasLine) {
        notificationRows.push({ order_id: order.id, notification_type: "customer_receipt_line", language: lang });
      }
    }

    if (notificationRows.length > 0) {
      const { error: eventError } = await service
        .from("order_notification_events")
        .upsert(notificationRows, { onConflict: "order_id,notification_type", ignoreDuplicates: true });
      if (eventError) console.error("Could not seed receipt notification events", eventError.message);
    }

    const appUrl = (Deno.env.get("APP_URL")?.trim() || "https://joko.today").replace(/\/$/, "");
    const myOrdersUrl = appUrl + "/my-orders";

    const [emailDelivery, lineDelivery] = await Promise.all([
      emailNotificationsEnabled
        ? sendReceiptEmail(service, order, receipt, rows, lang, myOrdersUrl)
        : Promise.resolve<DeliveryStatus>(!emailPreferenceEnabled ? "skipped_preference" : notificationGateUnavailable ? "unavailable" : "paused"),
      lineNotificationsEnabled
        ? sendReceiptLine(service, order, receipt, rows, lang, myOrdersUrl)
        : Promise.resolve<DeliveryStatus>(!linePreferenceEnabled ? "skipped_preference" : notificationGateUnavailable ? "unavailable" : "paused"),
    ]);

    return jsonResponse(req, 200, {
      state: "confirmed",
      orderNumber: order.order_number,
      receiptNumber: receipt.receipt_number,
      issuedAt: receipt.issued_at,
      customerReceivedAt,
      delivery: {
        email: emailDelivery,
        line: lineDelivery,
      },
    });
  } catch (error) {
    console.error("confirm-pickup-receipt failed", error);
    return jsonResponse(req, 500, { error: "Could not complete pickup receipt confirmation" });
  }
});
