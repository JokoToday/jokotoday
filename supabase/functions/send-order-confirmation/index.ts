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
  langAttr: string;
  fontFamily: string;
  subjectPrefix: string;
  confirmed: string;
  greetingPrefix: string;
  greetingSuffix: string;
  intro: string;
  orderNumber: string;
  pickupDay: string;
  pickupLocation: string;
  mapButton: string;
  itemsOrdered: string;
  product: string;
  quantity: string;
  price: string;
  lineTotal: string;
  grandTotal: string;
  payment: string;
  points: string;
  pointsSuffix: string;
  cancelNote: string;
  cancelButton: string;
  footer: string;
};

const EMAIL_COPY: Record<Language, EmailCopy> = {
  en: {
    langAttr: "en",
    fontFamily: "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif",
    subjectPrefix: "Your JOKO TODAY Order Confirmation",
    confirmed: "Order Confirmed",
    greetingPrefix: "Hi ",
    greetingSuffix: ",",
    intro: "Thank you for your order! We've received it and it's being prepared with love. Please find your order details below.",
    orderNumber: "Order Number",
    pickupDay: "Pickup Day",
    pickupLocation: "Pickup Location",
    mapButton: "View Pickup Location on Maps",
    itemsOrdered: "Items Ordered",
    product: "Product",
    quantity: "Qty",
    price: "Price",
    lineTotal: "Total",
    grandTotal: "Grand Total",
    payment: "Payment is due at pickup. Please bring exact change or arrange payment in advance.",
    points: "Points Earned This Order",
    pointsSuffix: "pts",
    cancelNote: "Need to cancel? You can cancel your order up to 24 hours before your pickup day.",
    cancelButton: "Cancel Order",
    footer: "Thank you for choosing JOKO TODAY",
  },
  th: {
    langAttr: "th",
    fontFamily: "'Sarabun',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif",
    subjectPrefix: "ยืนยันคำสั่งซื้อ JOKO TODAY ของคุณ",
    confirmed: "ยืนยันคำสั่งซื้อ",
    greetingPrefix: "สวัสดีคุณ ",
    greetingSuffix: ",",
    intro: "ขอบคุณสำหรับคำสั่งซื้อของคุณ! เราได้รับคำสั่งซื้อเรียบร้อยแล้ว กรุณาตรวจสอบรายละเอียดคำสั่งซื้อด้านล่าง",
    orderNumber: "หมายเลขคำสั่งซื้อ",
    pickupDay: "วันรับสินค้า",
    pickupLocation: "สถานที่รับสินค้า",
    mapButton: "ดูสถานที่รับสินค้าบน Google Maps",
    itemsOrdered: "รายการสินค้า",
    product: "สินค้า",
    quantity: "จำนวน",
    price: "ราคา/ชิ้น",
    lineTotal: "รวม",
    grandTotal: "ยอดรวมทั้งหมด",
    payment: "กรุณาชำระเงินเมื่อรับสินค้า",
    points: "แต้มที่ได้รับจากออเดอร์นี้",
    pointsSuffix: "แต้ม",
    cancelNote: "ต้องการยกเลิก? คุณสามารถยกเลิกคำสั่งซื้อได้ก่อน 24 ชั่วโมงก่อนวันรับสินค้า",
    cancelButton: "ยกเลิกคำสั่งซื้อ",
    footer: "ขอบคุณที่ใช้บริการ JOKO TODAY",
  },
  zh: {
    langAttr: "zh-Hans",
    fontFamily: "'PingFang SC','Microsoft YaHei',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif",
    subjectPrefix: "您的 JOKO TODAY 订单确认",
    confirmed: "订单已确认",
    greetingPrefix: "您好，",
    greetingSuffix: "，",
    intro: "感谢您的订购！我们已成功收到您的订单，正在用心为您准备。 请查阅以下订单详情。",
    orderNumber: "订单编号",
    pickupDay: "取货日期",
    pickupLocation: "取货地点",
    mapButton: "在 Google 地图查看取货地点",
    itemsOrdered: "订购商品",
    product: "商品",
    quantity: "数量",
    price: "单价",
    lineTotal: "小计",
    grandTotal: "总计",
    payment: "请在取货时付款，感谢您的理解与配合。",
    points: "本单获得积分",
    pointsSuffix: "积分",
    cancelNote: "需要取消？您可以在取货日期前 24 小时内取消订单。",
    cancelButton: "取消订单",
    footer: "感谢您选择 JOKO TODAY",
  },
};

function buildItemsTableRows(items: OrderItem[], lang: Language): string {
  return items.map((item) => {
    const name = escapeHtml(getProductName(item, lang));
    const quantity = Number(item.quantity);
    const price = Number(item.price_at_order);
    const lineTotal = (price * quantity).toFixed(2);
    return `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #fde68a;color:#1a1a1a;font-weight:500;">${name}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #fde68a;text-align:center;color:#4b5563;">${quantity}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #fde68a;text-align:right;color:#4b5563;">฿${price.toFixed(2)}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #fde68a;text-align:right;font-weight:700;color:#92400e;">฿${lineTotal}</td>
        </tr>`;
  }).join("");
}

function buildLoyaltyBlock(points: number, copy: EmailCopy): string {
  if (!points || points <= 0) return "";
  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:20px;">
      <tr>
        <td style="background:linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%);border:1px solid #fde68a;border-radius:10px;padding:16px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td width="36">
                <div style="width:36px;height:36px;background:#c6a75e;border-radius:50%;text-align:center;line-height:36px;font-size:18px;color:#ffffff;">★</div>
              </td>
              <td style="padding-left:14px;">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#b45309;">${escapeHtml(copy.points)}</div>
                <div style="font-size:22px;font-weight:800;color:#92400e;margin-top:2px;">+${points} ${escapeHtml(copy.pointsSuffix)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function buildEmail(
  order: Order,
  items: OrderItem[],
  location: PickupLocation | null,
  pickupDay: PickupDay | null,
  lang: Language,
): { subject: string; html: string } {
  const copy = EMAIL_COPY[lang];
  const subject = `${copy.subjectPrefix} – #${order.order_number}`;
  const locationName = getLocationName(location, lang);
  const pickupLabel = getPickupDayLabel(pickupDay, order.pickup_day, lang);
  const mapsLink = buildMapsLink(location?.maps_url ?? null, locationName);
  const itemRows = buildItemsTableRows(items, lang);
  const loyaltyBlock = buildLoyaltyBlock(Number(order.loyalty_points_earned ?? 0), copy);
  const customerName = escapeHtml(order.customer_name);

  const html = `<!DOCTYPE html>
<html lang="${copy.langAttr}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#faf7f2;font-family:${copy.fontFamily};">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td style="padding:40px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <tr>
          <td style="background:linear-gradient(135deg,#92400e 0%,#b45309 100%);padding:36px 40px;text-align:center;">
            <div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">JOKO TODAY</div>
            <div style="font-size:13px;color:#fde68a;margin-top:6px;letter-spacing:2px;text-transform:uppercase;">${escapeHtml(copy.confirmed)}</div>
          </td>
        </tr>

        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="font-size:17px;color:#1a1a1a;margin:0 0 8px;">${escapeHtml(copy.greetingPrefix)}${customerName}${escapeHtml(copy.greetingSuffix)}</p>
            <p style="font-size:15px;color:#4b5563;line-height:${lang === "en" ? "1.6" : "1.8"};margin:0 0 32px;">
              ${escapeHtml(copy.intro)}
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#fffbf2;border:1px solid #fde68a;border-radius:10px;margin-bottom:32px;">
              <tr>
                <td style="padding:20px 24px;">
                  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#b45309;">${escapeHtml(copy.orderNumber)}</div>
                  <div style="font-size:22px;font-weight:800;color:#1a1a1a;font-family:monospace;margin-top:6px;">#${escapeHtml(order.order_number)}</div>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:32px;">
              <tr>
                <td width="50%" style="padding-right:8px;">
                  <div style="background:#fffbf2;border:1px solid #fde68a;border-radius:10px;padding:16px 18px;">
                    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#b45309;">${escapeHtml(copy.pickupDay)}</div>
                    <div style="font-size:15px;font-weight:600;color:#1a1a1a;margin-top:5px;">${escapeHtml(pickupLabel)}</div>
                  </div>
                </td>
                <td width="50%" style="padding-left:8px;">
                  <div style="background:#fffbf2;border:1px solid #fde68a;border-radius:10px;padding:16px 18px;">
                    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#b45309;">${escapeHtml(copy.pickupLocation)}</div>
                    <div style="font-size:15px;font-weight:600;color:#1a1a1a;margin-top:5px;">${escapeHtml(locationName)}</div>
                  </div>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:32px;">
              <tr>
                <td style="text-align:center;">
                  <a href="${escapeHtml(mapsLink)}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;${lang === "en" ? "letter-spacing:0.3px;" : ""}">
                    ${escapeHtml(copy.mapButton)}
                  </a>
                </td>
              </tr>
            </table>

            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;margin-bottom:12px;">${escapeHtml(copy.itemsOrdered)}</div>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
              <thead>
                <tr style="background:#fef3c7;">
                  <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;${lang === "en" ? "text-transform:uppercase;letter-spacing:0.8px;" : ""}color:#92400e;">${escapeHtml(copy.product)}</th>
                  <th style="padding:10px 16px;text-align:center;font-size:11px;font-weight:700;${lang === "en" ? "text-transform:uppercase;letter-spacing:0.8px;" : ""}color:#92400e;">${escapeHtml(copy.quantity)}</th>
                  <th style="padding:10px 16px;text-align:right;font-size:11px;font-weight:700;${lang === "en" ? "text-transform:uppercase;letter-spacing:0.8px;" : ""}color:#92400e;">${escapeHtml(copy.price)}</th>
                  <th style="padding:10px 16px;text-align:right;font-size:11px;font-weight:700;${lang === "en" ? "text-transform:uppercase;letter-spacing:0.8px;" : ""}color:#92400e;">${escapeHtml(copy.lineTotal)}</th>
                </tr>
              </thead>
              <tbody>
                ${itemRows}
                <tr>
                  <td colspan="3" style="padding:16px;text-align:right;color:#6b7280;font-size:14px;border-top:2px solid #fde68a;">${escapeHtml(copy.grandTotal)}</td>
                  <td style="padding:16px;text-align:right;font-size:20px;font-weight:800;color:#92400e;border-top:2px solid #fde68a;">฿${Number(order.total_amount).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 18px;margin-top:28px;">
              <div style="font-size:14px;color:#1e40af;font-weight:500;">
                ${escapeHtml(copy.payment)}
              </div>
            </div>

            ${loyaltyBlock}

            <div style="margin-top:28px;text-align:center;">
              <p style="font-size:12px;color:#9ca3af;margin:0 0 10px;">${escapeHtml(copy.cancelNote)}</p>
              <a href="${APP_URL}/?page=my-orders" style="display:inline-block;background:#fff;color:#dc2626;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:600;border:1.5px solid #fca5a5;">
                ${escapeHtml(copy.cancelButton)}
              </a>
            </div>
          </td>
        </tr>

        <tr>
          <td style="background:#faf7f2;padding:24px 40px;text-align:center;border-top:1px solid #fde68a;">
            <div style="font-size:13px;color:#9ca3af;">${escapeHtml(copy.footer)} &nbsp;•&nbsp; joko.today</div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

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
