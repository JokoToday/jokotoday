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
  product_name: string;
  product_name_th?: string;
  quantity: number;
  price_at_order: number;
}

interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  pickup_day: string | null;
  pickup_location_id: string | null;
  total_amount: number;
  order_items: OrderItem[];
  notes: string | null;
  created_at: string;
  loyalty_points_earned: number | null;
}

interface PickupLocation {
  id: string;
  name_en: string;
  name_th: string;
  maps_url: string | null;
}

interface PickupDay {
  id: string;
  label: string;
  label_en: string | null;
  label_th: string | null;
  location_id: string | null;
}

const TYPE = "admin_new_order" as const;

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatBangkokDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildRows(items: OrderItem[], thai = false): string {
  if (!items.length) return `<tr><td colspan="3" style="padding:12px;text-align:center;color:#9ca3af;">—</td></tr>`;
  return items.map((item) => {
    const name = thai ? item.product_name_th || item.product_name : item.product_name;
    return `<tr><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(name)}</td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${escapeHtml(item.quantity)}</td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;">฿${(Number(item.price_at_order) * Number(item.quantity)).toFixed(2)}</td></tr>`;
  }).join("");
}

function buildEmail(order: Order, location: PickupLocation | null, day: PickupDay | null): { subject: string; html: string } {
  const items = Array.isArray(order.order_items) ? order.order_items : [];
  const locEn = location?.name_en || "—";
  const locTh = location?.name_th || locEn;
  const dayEn = day?.label_en || day?.label || order.pickup_day || "—";
  const dayTh = day?.label_th || day?.label || order.pickup_day || "—";
  const mapUrl = location?.maps_url || (location?.name_en ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.name_en)}` : null);
  const notes = order.notes ? escapeHtml(order.notes) : "—";
  const points = Number(order.loyalty_points_earned ?? 0);
  const subject = `New Order Received – Order #${order.order_number}`;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#f3f4f6;font-family:-apple-system,'Segoe UI',Arial,sans-serif;color:#1f2937;"><table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="padding:30px 14px;"><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:660px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.09);">
<tr><td style="background:#92400e;padding:28px;text-align:center;color:#fff;"><div style="font-size:26px;font-weight:800;">JOKO TODAY</div><div style="margin-top:6px;color:#fde68a;letter-spacing:2px;">INTERNAL ORDER NOTIFICATION</div></td></tr>
<tr><td style="padding:30px 34px;"><h2 style="margin:0 0 20px;color:#92400e;">New Order Received · #${escapeHtml(order.order_number)}</h2>
<table width="100%" cellpadding="6" cellspacing="0" role="presentation" style="margin-bottom:20px;"><tr><td><strong>Order Date</strong></td><td>${escapeHtml(formatBangkokDate(order.created_at, "en-GB"))}</td></tr><tr><td><strong>Pickup</strong></td><td>${escapeHtml(dayEn)} · ${escapeHtml(locEn)}</td></tr><tr><td><strong>Customer</strong></td><td>${escapeHtml(order.customer_name)}</td></tr><tr><td><strong>Email</strong></td><td>${escapeHtml(order.customer_email || "—")}</td></tr><tr><td><strong>Phone</strong></td><td>${escapeHtml(order.customer_phone || "—")}</td></tr><tr><td><strong>Notes</strong></td><td>${notes}</td></tr></table>
${mapUrl ? `<div style="margin-bottom:22px;"><a href="${escapeHtml(mapUrl)}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;padding:10px 18px;font-weight:600;">View Pickup Location</a></div>` : ""}
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;"><thead><tr style="background:#fef3c7;color:#92400e;"><th style="padding:10px 12px;text-align:left;">Product</th><th style="padding:10px 12px;text-align:center;">Qty</th><th style="padding:10px 12px;text-align:right;">Total</th></tr></thead><tbody>${buildRows(items)}<tr><td colspan="2" style="padding:14px 12px;text-align:right;font-weight:700;">Order Total</td><td style="padding:14px 12px;text-align:right;font-size:20px;font-weight:800;color:#92400e;">฿${Number(order.total_amount).toFixed(2)}</td></tr></tbody></table>
${points > 0 ? `<div style="margin-top:16px;color:#92400e;"><strong>Points earned:</strong> +${points}</div>` : ""}
<hr style="border:0;border-top:2px dashed #fde68a;margin:28px 0;"><h2 style="margin:0 0 20px;color:#92400e;">มีคำสั่งซื้อใหม่ · #${escapeHtml(order.order_number)}</h2>
<table width="100%" cellpadding="6" cellspacing="0" role="presentation" style="margin-bottom:20px;"><tr><td><strong>วันที่สั่งซื้อ</strong></td><td>${escapeHtml(formatBangkokDate(order.created_at, "th-TH"))}</td></tr><tr><td><strong>รับสินค้า</strong></td><td>${escapeHtml(dayTh)} · ${escapeHtml(locTh)}</td></tr><tr><td><strong>ลูกค้า</strong></td><td>${escapeHtml(order.customer_name)}</td></tr><tr><td><strong>อีเมล</strong></td><td>${escapeHtml(order.customer_email || "—")}</td></tr><tr><td><strong>โทรศัพท์</strong></td><td>${escapeHtml(order.customer_phone || "—")}</td></tr><tr><td><strong>หมายเหตุ</strong></td><td>${notes}</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;"><thead><tr style="background:#fef3c7;color:#92400e;"><th style="padding:10px 12px;text-align:left;">สินค้า</th><th style="padding:10px 12px;text-align:center;">จำนวน</th><th style="padding:10px 12px;text-align:right;">รวม</th></tr></thead><tbody>${buildRows(items, true)}<tr><td colspan="2" style="padding:14px 12px;text-align:right;font-weight:700;">ยอดรวม</td><td style="padding:14px 12px;text-align:right;font-size:20px;font-weight:800;color:#92400e;">฿${Number(order.total_amount).toFixed(2)}</td></tr></tbody></table>
</td></tr><tr><td style="padding:20px;text-align:center;background:#faf7f2;color:#9ca3af;font-size:12px;">JOKO TODAY Internal Notification • joko.today</td></tr></table></td></tr></table></body></html>`;

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

  // Explicit customer_id filter is required even with RLS because staff have
  // broader order-read access. Notification authority remains with the owner.
  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .select("id, order_number, customer_id, customer_name, customer_email, customer_phone, pickup_day, pickup_location_id, total_amount, order_items, notes, created_at, loyalty_points_earned")
    .eq("id", orderId)
    .eq("customer_id", user.id)
    .eq("purchase_type", "online")
    .maybeSingle();

  if (orderError) {
    console.error("SEC-005: admin notification order lookup failed", orderError.message);
    return jsonResponse(req, 500, { error: "Notification service unavailable" });
  }
  if (!orderData) return jsonResponse(req, 404, { error: "Order not found" });
  const order = orderData as Order;

  const claimMode = await claimNotification(supabase, order.id, TYPE);
  let eventId: string | null = null;
  if (claimMode.mode === "error") {
    console.error("SEC-005: admin notification claim failed", claimMode.error);
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
  }

  let location: PickupLocation | null = null;
  if (order.pickup_location_id) {
    const { data } = await supabase
      .from("cms_pickup_locations")
      .select("id, name_en, name_th, maps_url")
      .eq("id", order.pickup_location_id)
      .maybeSingle();
    location = data as PickupLocation | null;
  }

  let day: PickupDay | null = null;
  if (order.pickup_day) {
    const { data } = await supabase
      .from("cms_pickup_days")
      .select("id, label, label_en, label_th, location_id")
      .eq("label", order.pickup_day)
      .maybeSingle();
    day = data as PickupDay | null;
    if (!location && day?.location_id) {
      const { data: fallbackLocation } = await supabase
        .from("cms_pickup_locations")
        .select("id, name_en, name_th, maps_url")
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

  const email = buildEmail(order, location, day);
  const resend = new Resend(resendKey);
  try {
    const { data, error } = await resend.emails.send({
      from: "JOKO TODAY <orders@jokotoday.com>",
      to: "jokotoday@gmail.com",
      subject: email.subject,
      html: email.html,
    }, { idempotencyKey: notificationIdempotencyKey(TYPE, order.id) });

    if (error) {
      const summary = providerErrorSummary(error);
      console.error("SEC-005: admin notification provider rejected request", summary);
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
    console.error("SEC-005: admin notification delivery outcome uncertain", summary);
    if (eventId) await finishNotification(supabase, eventId, "uncertain", null, summary);
    return jsonResponse(req, 503, { error: "Notification delivery outcome unavailable" });
  }
});
