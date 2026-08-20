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

type Language = "en" | "th" | "zh";
const TYPE = "customer_confirmation" as const;
const APP_URL = "https://joko.today";

function normalizeLanguage(value: unknown): Language | null {
  return value === "en" || value === "th" || value === "zh" ? value : null;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function locationName(location: PickupLocation | null, lang: Language): string {
  if (!location) return "—";
  if (lang === "th") return location.name_th || location.name_en;
  if (lang === "zh") return location.name_zh || location.name_en;
  return location.name_en;
}

function pickupLabel(day: PickupDay | null, fallback: string | null, lang: Language): string {
  if (!day) return fallback || "—";
  if (lang === "th") return day.label_th || day.label_en || day.label;
  if (lang === "zh") return day.label_zh || day.label_en || day.label;
  return day.label_en || day.label;
}

function itemName(item: OrderItem, lang: Language): string {
  if (lang === "th") return item.product_name_th || item.product_name || "—";
  if (lang === "zh") return item.product_name_zh || item.product_name || "—";
  return item.product_name || "—";
}

function copy(lang: Language) {
  if (lang === "th") {
    return {
      subject: "ยืนยันคำสั่งซื้อ JOKO TODAY ของคุณ",
      confirmed: "ยืนยันคำสั่งซื้อ",
      greeting: "สวัสดีคุณ",
      intro: "ขอบคุณสำหรับคำสั่งซื้อของคุณ เราได้รับคำสั่งซื้อเรียบร้อยแล้ว",
      orderNo: "หมายเลขคำสั่งซื้อ",
      pickup: "วันรับสินค้า",
      location: "สถานที่รับสินค้า",
      map: "ดูสถานที่รับสินค้าบน Google Maps",
      product: "สินค้า",
      qty: "จำนวน",
      total: "รวม",
      grandTotal: "ยอดรวมทั้งหมด",
      payment: "กรุณาชำระเงินเมื่อรับสินค้า",
      points: "แต้มที่ได้รับจากออเดอร์นี้",
      cancelNote: "ต้องการยกเลิก? คุณสามารถจัดการคำสั่งซื้อได้จากหน้า My Orders",
      cancel: "ดูคำสั่งซื้อของฉัน",
      thanks: "ขอบคุณที่ใช้บริการ JOKO TODAY",
    };
  }
  if (lang === "zh") {
    return {
      subject: "您的 JOKO TODAY 订单确认",
      confirmed: "订单已确认",
      greeting: "您好，",
      intro: "感谢您的订购！我们已成功收到您的订单。",
      orderNo: "订单编号",
      pickup: "取货日期",
      location: "取货地点",
      map: "在 Google 地图查看取货地点",
      product: "商品",
      qty: "数量",
      total: "小计",
      grandTotal: "总计",
      payment: "请在取货时付款，感谢您的理解与配合。",
      points: "本单获得积分",
      cancelNote: "需要管理订单？请前往 My Orders。",
      cancel: "查看我的订单",
      thanks: "感谢您选择 JOKO TODAY",
    };
  }
  return {
    subject: "Your JOKO TODAY Order Confirmation",
    confirmed: "Order Confirmed",
    greeting: "Hi",
    intro: "Thank you for your order! We have received it and will prepare it with care.",
    orderNo: "Order Number",
    pickup: "Pickup Day",
    location: "Pickup Location",
    map: "View Pickup Location on Google Maps",
    product: "Product",
    qty: "Qty",
    total: "Total",
    grandTotal: "Grand Total",
    payment: "Payment is due at pickup.",
    points: "Points Earned This Order",
    cancelNote: "Need to manage your order? Open My Orders.",
    cancel: "View My Orders",
    thanks: "Thank you for choosing JOKO TODAY",
  };
}

function buildEmail(
  order: Order,
  items: OrderItem[],
  location: PickupLocation | null,
  day: PickupDay | null,
  lang: Language,
): { subject: string; html: string } {
  const t = copy(lang);
  const locName = locationName(location, lang);
  const dayLabel = pickupLabel(day, order.pickup_day, lang);
  const mapsLink = location?.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locName)}`;
  const rows = items.map((item) => {
    const lineTotal = Number(item.price_at_order) * Number(item.quantity);
    return `<tr>
      <td style="padding:12px 14px;border-bottom:1px solid #fde68a;">${escapeHtml(itemName(item, lang))}</td>
      <td style="padding:12px 14px;border-bottom:1px solid #fde68a;text-align:center;">${escapeHtml(item.quantity)}</td>
      <td style="padding:12px 14px;border-bottom:1px solid #fde68a;text-align:right;font-weight:700;">฿${lineTotal.toFixed(2)}</td>
    </tr>`;
  }).join("");

  const points = Number(order.loyalty_points_earned ?? 0);
  const pointsBlock = points > 0
    ? `<div style="margin-top:20px;padding:14px 18px;border:1px solid #fde68a;border-radius:10px;background:#fffbeb;color:#92400e;"><strong>${escapeHtml(t.points)}:</strong> +${points}</div>`
    : "";

  const greeting = lang === "zh"
    ? `${t.greeting}${escapeHtml(order.customer_name)}，`
    : `${t.greeting} ${escapeHtml(order.customer_name)},`;

  const subject = `${t.subject} – #${order.order_number}`;
  const html = `<!doctype html>
<html lang="${lang === "zh" ? "zh-Hans" : lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#faf7f2;font-family:-apple-system,'Segoe UI',Arial,sans-serif;color:#1f2937;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="padding:32px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:620px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
<tr><td style="background:#92400e;padding:30px;text-align:center;color:#fff;"><div style="font-size:28px;font-weight:800;">JOKO TODAY</div><div style="margin-top:6px;color:#fde68a;letter-spacing:2px;">${escapeHtml(t.confirmed)}</div></td></tr>
<tr><td style="padding:34px;">
<p style="font-size:17px;margin:0 0 8px;">${greeting}</p><p style="line-height:1.7;color:#4b5563;margin:0 0 26px;">${escapeHtml(t.intro)}</p>
<div style="padding:16px 18px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;margin-bottom:22px;"><small style="color:#b45309;font-weight:700;">${escapeHtml(t.orderNo)}</small><div style="font-size:22px;font-weight:800;margin-top:4px;">#${escapeHtml(order.order_number)}</div></div>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;"><tr><td style="padding:12px;background:#f9fafb;border-radius:8px;"><small>${escapeHtml(t.pickup)}</small><div style="font-weight:700;margin-top:4px;">${escapeHtml(dayLabel)}</div></td><td width="12"></td><td style="padding:12px;background:#f9fafb;border-radius:8px;"><small>${escapeHtml(t.location)}</small><div style="font-weight:700;margin-top:4px;">${escapeHtml(locName)}</div></td></tr></table>
<div style="text-align:center;margin:0 0 24px;"><a href="${escapeHtml(mapsLink)}" style="display:inline-block;padding:11px 20px;border-radius:8px;background:#16a34a;color:#fff;text-decoration:none;font-weight:600;">${escapeHtml(t.map)}</a></div>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;"><thead><tr style="background:#fef3c7;color:#92400e;"><th style="padding:10px 14px;text-align:left;">${escapeHtml(t.product)}</th><th style="padding:10px 14px;text-align:center;">${escapeHtml(t.qty)}</th><th style="padding:10px 14px;text-align:right;">${escapeHtml(t.total)}</th></tr></thead><tbody>${rows}<tr><td colspan="2" style="padding:16px 14px;text-align:right;font-weight:700;">${escapeHtml(t.grandTotal)}</td><td style="padding:16px 14px;text-align:right;font-size:20px;font-weight:800;color:#92400e;">฿${Number(order.total_amount).toFixed(2)}</td></tr></tbody></table>
<div style="margin-top:22px;padding:14px 18px;border-radius:10px;background:#eff6ff;color:#1e40af;">${escapeHtml(t.payment)}</div>
${pointsBlock}
<div style="text-align:center;margin-top:28px;"><p style="font-size:12px;color:#9ca3af;">${escapeHtml(t.cancelNote)}</p><a href="${APP_URL}/?page=my-orders" style="display:inline-block;padding:10px 18px;border:1px solid #d1d5db;border-radius:8px;color:#374151;text-decoration:none;font-weight:600;">${escapeHtml(t.cancel)}</a></div>
</td></tr><tr><td style="padding:20px;text-align:center;background:#faf7f2;color:#9ca3af;font-size:12px;">${escapeHtml(t.thanks)} • joko.today</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html };
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

  let day: PickupDay | null = null;
  if (order.pickup_day) {
    const { data } = await supabase
      .from("cms_pickup_days")
      .select("id, label, label_en, label_th, label_zh, location_id")
      .eq("label", order.pickup_day)
      .maybeSingle();
    day = data as PickupDay | null;
    if (!location && day?.location_id) {
      const { data: fallbackLocation } = await supabase
        .from("cms_pickup_locations")
        .select("id, name_en, name_th, name_zh, maps_url")
        .eq("id", day.location_id)
        .maybeSingle();
      location = fallbackLocation as PickupLocation | null;
    }
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.error("SEC-005: RESEND_API_KEY is not configured");
    if (eventId) await finishNotification(supabase, eventId, "failed", null, "Email provider not configured");
    return jsonResponse(req, 500, { error: "Notification service unavailable" });
  }

  const items: OrderItem[] = Array.isArray(order.order_items) ? order.order_items : [];
  const email = buildEmail(order, items, location, day, lang);
  const resend = new Resend(resendKey);

  try {
    const { data, error } = await resend.emails.send({
      from: "JOKO TODAY <orders@jokotoday.com>",
      to: order.customer_email,
      subject: email.subject,
      html: email.html,
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
