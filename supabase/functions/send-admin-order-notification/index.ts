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
  product_id?: string;
  product_name: string;
  product_name_th?: string;
  quantity: number;
  price_at_order: number;
  product_options?: string;
}

interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  purchase_type: string | null;
  pickup_day: string | null;
  pickup_location_id: string | null;
  total_amount: number;
  walk_in_amount?: number | null;
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
  address?: string | null;
}

interface PickupDay {
  id: string;
  label: string;
  label_en: string | null;
  label_th: string | null;
  location_id: string | null;
}

const TYPE = "admin_new_order" as const;
const APP_URL = "https://joko.today";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
}

function formatDateTh(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
}

function buildItemRowsEn(items: OrderItem[]): string {
  return items.map((item) => {
    const lineTotal = (Number(item.price_at_order) * Number(item.quantity)).toFixed(2);
    const opts = item.product_options ? `<div style="font-size:11px;color:#59615D;margin-top:2px;">${escapeHtml(item.product_options)}</div>` : "";
    return `<tr>
      <td style="padding:10px 14px;border-bottom:1px solid #B9D1CC;color:#303532;font-weight:500;">${escapeHtml(item.product_name)}${opts}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #B9D1CC;text-align:center;color:#59615D;">${Number(item.quantity)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #B9D1CC;text-align:right;color:#59615D;">฿${Number(item.price_at_order).toFixed(2)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #B9D1CC;text-align:right;font-weight:700;color:#A44F1D;">฿${lineTotal}</td>
    </tr>`;
  }).join("");
}

function buildItemRowsTh(items: OrderItem[]): string {
  return items.map((item) => {
    const name = item.product_name_th || item.product_name;
    const lineTotal = (Number(item.price_at_order) * Number(item.quantity)).toFixed(2);
    const opts = item.product_options ? `<div style="font-size:11px;color:#59615D;margin-top:2px;">${escapeHtml(item.product_options)}</div>` : "";
    return `<tr>
      <td style="padding:10px 14px;border-bottom:1px solid #B9D1CC;color:#303532;font-weight:500;">${escapeHtml(name)}${opts}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #B9D1CC;text-align:center;color:#59615D;">${Number(item.quantity)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #B9D1CC;text-align:right;color:#59615D;">฿${Number(item.price_at_order).toFixed(2)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #B9D1CC;text-align:right;font-weight:700;color:#A44F1D;">฿${lineTotal}</td>
    </tr>`;
  }).join("");
}

function calcSubtotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + Number(item.price_at_order) * Number(item.quantity), 0);
}

function buildEmail(order: Order, location: PickupLocation | null, pickupDay: PickupDay | null, memberCode: string | null): { subject: string; html: string } {
  const subject = `New Order Received – Order #${order.order_number}`;
  const orderDate = formatDate(order.created_at);
  const orderDateTh = formatDateTh(order.created_at);
  const locationNameEn = location?.name_en ?? "—";
  const locationNameTh = location?.name_th ?? "—";
  const pickupLabelEn = pickupDay?.label_en ?? pickupDay?.label ?? order.pickup_day ?? "—";
  const pickupLabelTh = pickupDay?.label_th ?? pickupDay?.label ?? order.pickup_day ?? "—";
  const mapsUrl = location?.maps_url ? location.maps_url : location?.name_en ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.name_en)}` : null;
  const orderTypeEn = order.purchase_type === "walk_in" ? "In-Store (Walk-In)" : "Online";
  const orderTypeTh = order.purchase_type === "walk_in" ? "หน้าร้าน (Walk-In)" : "ออนไลน์";
  const items: OrderItem[] = Array.isArray(order.order_items) ? order.order_items : [];
  const subtotal = calcSubtotal(items);
  const total = Number(order.total_amount);
  const discount = subtotal > total ? subtotal - total : 0;
  const itemRowsEn = items.length > 0 ? buildItemRowsEn(items) : `<tr><td colspan="4" style="padding:12px;color:#7B837F;text-align:center;">No item details (walk-in)</td></tr>`;
  const itemRowsTh = items.length > 0 ? buildItemRowsTh(items) : `<tr><td colspan="4" style="padding:12px;color:#7B837F;text-align:center;">ไม่มีรายการสินค้า (walk-in)</td></tr>`;
  const loyaltyPointsEn = (order.loyalty_points_earned ?? 0) > 0 ? `<tr><td style="padding:6px 0;color:#A44F1D;font-size:13px;">Points Earned</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#A44F1D;">+${Number(order.loyalty_points_earned)} pts</td></tr>` : "";
  const loyaltyPointsTh = (order.loyalty_points_earned ?? 0) > 0 ? `<tr><td style="padding:6px 0;color:#A44F1D;font-size:13px;">แต้มที่ได้รับ</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#A44F1D;">+${Number(order.loyalty_points_earned)} แต้ม</td></tr>` : "";
  const mapsButtonEn = mapsUrl ? `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:16px;"><tr><td style="text-align:center;"><a href="${escapeHtml(mapsUrl)}" style="display:inline-block;background:#55766F;color:#FFF9EE;text-decoration:none;padding:10px 22px;border-radius:14px;font-size:13px;font-weight:600;">View Pickup Location on Google Maps</a></td></tr></table>` : "";
  const mapsButtonTh = mapsUrl ? `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:16px;"><tr><td style="text-align:center;"><a href="${escapeHtml(mapsUrl)}" style="display:inline-block;background:#55766F;color:#FFF9EE;text-decoration:none;padding:10px 22px;border-radius:14px;font-size:13px;font-weight:600;">ดูตำแหน่งรับสินค้าบน Google Maps</a></td></tr></table>` : "";
  const pickupReturnPath = memberCode ? `/pickup?member=${encodeURIComponent(memberCode)}` : null;
  const walkInReturnPath = memberCode ? `/walk-in?member=${encodeURIComponent(memberCode)}` : null;
  const pickupStaffUrl = pickupReturnPath ? `${APP_URL}/staff?return=${encodeURIComponent(pickupReturnPath)}` : null;
  const walkInStaffUrl = walkInReturnPath ? `${APP_URL}/staff?return=${encodeURIComponent(walkInReturnPath)}` : null;
  const memberCodeRowEn = memberCode ? `<tr><td style="padding:10px 16px;font-size:13px;color:#59615D;border-top:1px solid #B9D1CC;">Member Code</td><td style="padding:10px 16px;font-size:15px;font-weight:800;color:#A44F1D;border-top:1px solid #B9D1CC;font-family:monospace;">${escapeHtml(memberCode)}</td></tr>` : "";
  const memberCodeRowTh = memberCode ? `<tr><td style="padding:10px 16px;font-size:13px;color:#59615D;border-top:1px solid #B9D1CC;">รหัสสมาชิก</td><td style="padding:10px 16px;font-size:15px;font-weight:800;color:#A44F1D;border-top:1px solid #B9D1CC;font-family:monospace;">${escapeHtml(memberCode)}</td></tr>` : "";
  const staffButtonsEn = pickupStaffUrl && walkInStaffUrl ? `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:-8px 0 24px;"><tr><td style="text-align:center;padding:0 4px;"><a href="${escapeHtml(pickupStaffUrl)}" style="display:inline-block;background:#304B45;color:#FFF9EE;text-decoration:none;padding:11px 18px;border-radius:14px;font-size:13px;font-weight:700;">Open in Pickup Desk</a></td><td style="text-align:center;padding:0 4px;"><a href="${escapeHtml(walkInStaffUrl)}" style="display:inline-block;background:#FFF9EE;color:#304B45;text-decoration:none;padding:10px 18px;border-radius:14px;font-size:13px;font-weight:700;border:1px solid #55766F;">Open in Walk-In Desk</a></td></tr></table>` : "";
  const staffButtonsTh = pickupStaffUrl && walkInStaffUrl ? `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:-8px 0 24px;"><tr><td style="text-align:center;padding:0 4px;"><a href="${escapeHtml(pickupStaffUrl)}" style="display:inline-block;background:#304B45;color:#FFF9EE;text-decoration:none;padding:11px 18px;border-radius:14px;font-size:13px;font-weight:700;">เปิดในจุดรับสินค้า</a></td><td style="text-align:center;padding:0 4px;"><a href="${escapeHtml(walkInStaffUrl)}" style="display:inline-block;background:#FFF9EE;color:#304B45;text-decoration:none;padding:10px 18px;border-radius:14px;font-size:13px;font-weight:700;border:1px solid #55766F;">เปิดในเคาน์เตอร์ Walk-In</a></td></tr></table>` : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#F4EFE5;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="padding:32px 16px;"><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:640px;margin:0 auto;background:#FFF9EE;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
<tr><td style="background:#DAEBE8;padding:30px 36px 20px;text-align:center;"><div style="font-size:26px;font-weight:800;color:#303532;letter-spacing:2px;">JOKO TODAY</div><div style="font-size:11px;color:#55766F;margin-top:7px;letter-spacing:2.5px;text-transform:uppercase;font-weight:700;">Internal Order Notification</div><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:15px;"><tr><td width="18%" style="height:8px;border-bottom:2px solid #55766F;font-size:0;">&nbsp;</td><td width="24%" style="height:12px;border-bottom:1px solid #55766F;font-size:0;">&nbsp;</td><td width="19%" style="height:7px;border-bottom:2px solid #55766F;font-size:0;">&nbsp;</td><td width="22%" style="height:11px;border-bottom:1px solid #55766F;font-size:0;">&nbsp;</td><td width="17%" style="height:8px;border-bottom:2px solid #55766F;font-size:0;">&nbsp;</td></tr></table></td></tr>
<tr><td style="background:#DAEBE8;padding:14px 36px;text-align:center;border-bottom:1px solid #B9D1CC;"><span style="font-size:16px;font-weight:700;color:#304B45;">New Order Received</span></td></tr>
<tr><td style="padding:32px 36px 24px;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#FFF9EE;border:1.5px solid #B9D1CC;border-radius:10px;margin-bottom:24px;"><tr><td style="padding:18px 22px;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#A44F1D;">Order Number</div><div style="font-size:24px;font-weight:800;color:#303532;font-family:monospace;margin-top:4px;">#${escapeHtml(order.order_number)}</div></td></tr></table>
<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#7B837F;margin-bottom:12px;">Order Information</div>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;border:1px solid #B9D1CC;border-radius:10px;overflow:hidden;"><tr style="background:#EEF5F2;"><td style="padding:10px 16px;font-size:13px;color:#59615D;width:44%;">Order Date</td><td style="padding:10px 16px;font-size:13px;font-weight:600;color:#303532;">${escapeHtml(orderDate)}</td></tr><tr><td style="padding:10px 16px;font-size:13px;color:#59615D;border-top:1px solid #B9D1CC;">Order Type</td><td style="padding:10px 16px;font-size:13px;font-weight:600;color:#303532;border-top:1px solid #B9D1CC;">${escapeHtml(orderTypeEn)}</td></tr><tr style="background:#EEF5F2;"><td style="padding:10px 16px;font-size:13px;color:#59615D;border-top:1px solid #B9D1CC;">Pickup Day</td><td style="padding:10px 16px;font-size:13px;font-weight:600;color:#303532;border-top:1px solid #B9D1CC;">${escapeHtml(pickupLabelEn)}</td></tr><tr><td style="padding:10px 16px;font-size:13px;color:#59615D;border-top:1px solid #B9D1CC;">Pickup Location</td><td style="padding:10px 16px;font-size:13px;font-weight:600;color:#303532;border-top:1px solid #B9D1CC;">${escapeHtml(locationNameEn)}</td></tr></table>
<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#7B837F;margin-bottom:12px;">Customer Information</div>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;border:1px solid #B9D1CC;border-radius:10px;overflow:hidden;"><tr style="background:#EEF5F2;"><td style="padding:10px 16px;font-size:13px;color:#59615D;width:44%;">Name</td><td style="padding:10px 16px;font-size:13px;font-weight:600;color:#303532;">${escapeHtml(order.customer_name || "—")}</td></tr><tr><td style="padding:10px 16px;font-size:13px;color:#59615D;border-top:1px solid #B9D1CC;">Email</td><td style="padding:10px 16px;font-size:13px;font-weight:600;color:#303532;border-top:1px solid #B9D1CC;">${escapeHtml(order.customer_email || "—")}</td></tr><tr style="background:#EEF5F2;"><td style="padding:10px 16px;font-size:13px;color:#59615D;border-top:1px solid #B9D1CC;">Phone</td><td style="padding:10px 16px;font-size:13px;font-weight:600;color:#303532;border-top:1px solid #B9D1CC;">${escapeHtml(order.customer_phone || "—")}</td></tr>${memberCodeRowEn}</table>
${staffButtonsEn}
<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#7B837F;margin-bottom:12px;">Items Ordered</div><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border:1px solid #B9D1CC;border-radius:10px;overflow:hidden;margin-bottom:16px;"><thead><tr style="background:#D9ECE9;"><th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#A44F1D;">Product</th><th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:#A44F1D;">Qty</th><th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#A44F1D;">Price</th><th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#A44F1D;">Total</th></tr></thead><tbody>${itemRowsEn}</tbody></table>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;"><tr><td style="text-align:right;"><table cellpadding="0" cellspacing="0" role="presentation" style="margin-left:auto;min-width:200px;"><tr><td style="padding:6px 0;color:#59615D;font-size:13px;">Subtotal</td><td style="padding:6px 0;padding-left:32px;text-align:right;color:#303532;font-size:13px;">฿${subtotal.toFixed(2)}</td></tr>${discount > 0 ? `<tr><td style="padding:6px 0;color:#55766F;font-size:13px;">Discount</td><td style="padding:6px 0;padding-left:32px;text-align:right;color:#55766F;font-size:13px;">–฿${discount.toFixed(2)}</td></tr>` : ""}${loyaltyPointsEn}<tr style="border-top:2px solid #B9D1CC;"><td style="padding:10px 0 0;color:#A44F1D;font-size:15px;font-weight:700;">Total Amount</td><td style="padding:10px 0 0;padding-left:32px;text-align:right;font-size:20px;font-weight:800;color:#A44F1D;">฿${total.toFixed(2)}</td></tr></table></td></tr></table>${mapsButtonEn}</td></tr>
<tr><td style="padding:0 36px;"><table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="border-top:2px dashed #B9D1CC;padding:24px 0 0;"></td></tr></table><div style="text-align:center;margin:-12px 0 0;"><span style="background:#FFF9EE;padding:0 12px;font-size:11px;color:#7B837F;letter-spacing:2px;text-transform:uppercase;">ภาษาไทย / Thai Section</span></div></td></tr>
<tr><td style="padding:24px 36px 32px;"><div style="background:#DAEBE8;border:1px solid #B9D1CC;border-radius:8px;padding:12px 16px;text-align:center;margin-bottom:24px;"><span style="font-size:16px;font-weight:700;color:#304B45;">มีคำสั่งซื้อใหม่เข้ามา</span></div><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#FFF9EE;border:1.5px solid #B9D1CC;border-radius:10px;margin-bottom:24px;"><tr><td style="padding:18px 22px;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#A44F1D;">หมายเลขคำสั่งซื้อ</div><div style="font-size:24px;font-weight:800;color:#303532;font-family:monospace;margin-top:4px;">#${escapeHtml(order.order_number)}</div></td></tr></table>
<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#7B837F;margin-bottom:12px;">ข้อมูลคำสั่งซื้อ</div><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;border:1px solid #B9D1CC;border-radius:10px;overflow:hidden;"><tr style="background:#EEF5F2;"><td style="padding:10px 16px;font-size:13px;color:#59615D;width:44%;">วันที่สั่งซื้อ</td><td style="padding:10px 16px;font-size:13px;font-weight:600;color:#303532;">${escapeHtml(orderDateTh)}</td></tr><tr><td style="padding:10px 16px;font-size:13px;color:#59615D;border-top:1px solid #B9D1CC;">ประเภทคำสั่งซื้อ</td><td style="padding:10px 16px;font-size:13px;font-weight:600;color:#303532;border-top:1px solid #B9D1CC;">${escapeHtml(orderTypeTh)}</td></tr><tr style="background:#EEF5F2;"><td style="padding:10px 16px;font-size:13px;color:#59615D;border-top:1px solid #B9D1CC;">วันที่รับสินค้า</td><td style="padding:10px 16px;font-size:13px;font-weight:600;color:#303532;border-top:1px solid #B9D1CC;">${escapeHtml(pickupLabelTh)}</td></tr><tr><td style="padding:10px 16px;font-size:13px;color:#59615D;border-top:1px solid #B9D1CC;">สถานที่รับสินค้า</td><td style="padding:10px 16px;font-size:13px;font-weight:600;color:#303532;border-top:1px solid #B9D1CC;">${escapeHtml(locationNameTh)}</td></tr></table>
<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#7B837F;margin-bottom:12px;">ข้อมูลลูกค้า</div><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;border:1px solid #B9D1CC;border-radius:10px;overflow:hidden;"><tr style="background:#EEF5F2;"><td style="padding:10px 16px;font-size:13px;color:#59615D;width:44%;">ชื่อ</td><td style="padding:10px 16px;font-size:13px;font-weight:600;color:#303532;">${escapeHtml(order.customer_name || "—")}</td></tr><tr><td style="padding:10px 16px;font-size:13px;color:#59615D;border-top:1px solid #B9D1CC;">อีเมล</td><td style="padding:10px 16px;font-size:13px;font-weight:600;color:#303532;border-top:1px solid #B9D1CC;">${escapeHtml(order.customer_email || "—")}</td></tr><tr style="background:#EEF5F2;"><td style="padding:10px 16px;font-size:13px;color:#59615D;border-top:1px solid #B9D1CC;">เบอร์โทร</td><td style="padding:10px 16px;font-size:13px;font-weight:600;color:#303532;border-top:1px solid #B9D1CC;">${escapeHtml(order.customer_phone || "—")}</td></tr>${memberCodeRowTh}</table>
${staffButtonsTh}
<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#7B837F;margin-bottom:12px;">รายการสินค้า</div><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border:1px solid #B9D1CC;border-radius:10px;overflow:hidden;margin-bottom:16px;"><thead><tr style="background:#D9ECE9;"><th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#A44F1D;">สินค้า</th><th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:#A44F1D;">จำนวน</th><th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#A44F1D;">ราคา/ชิ้น</th><th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#A44F1D;">รวม</th></tr></thead><tbody>${itemRowsTh}</tbody></table><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;"><tr><td style="text-align:right;"><table cellpadding="0" cellspacing="0" role="presentation" style="margin-left:auto;min-width:200px;"><tr><td style="padding:6px 0;color:#59615D;font-size:13px;">ยอดรวมสินค้า</td><td style="padding:6px 0;padding-left:32px;text-align:right;color:#303532;font-size:13px;">฿${subtotal.toFixed(2)}</td></tr>${discount > 0 ? `<tr><td style="padding:6px 0;color:#55766F;font-size:13px;">ส่วนลด</td><td style="padding:6px 0;padding-left:32px;text-align:right;color:#55766F;font-size:13px;">–฿${discount.toFixed(2)}</td></tr>` : ""}${loyaltyPointsTh}<tr style="border-top:2px solid #B9D1CC;"><td style="padding:10px 0 0;color:#A44F1D;font-size:15px;font-weight:700;">ยอดชำระทั้งหมด</td><td style="padding:10px 0 0;padding-left:32px;text-align:right;font-size:20px;font-weight:800;color:#A44F1D;">฿${total.toFixed(2)}</td></tr></table></td></tr></table>${mapsButtonTh}</td></tr>
<tr><td style="background:#F4EFE5;padding:20px 36px;text-align:center;border-top:1px solid #B9D1CC;"><div style="font-size:12px;color:#7B837F;">JOKO TODAY Internal Notification &nbsp;•&nbsp; joko.today</div></td></tr></table></td></tr></table></body></html>`;
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
  try { body = await req.json(); } catch { return jsonResponse(req, 400, { error: "Invalid JSON body" }); }
  const orderId = body.order_id;
  if (!isValidUuid(orderId)) return jsonResponse(req, 400, { error: "Invalid order_id" });
  const { data: orderData, error: orderError } = await supabase.from("orders").select("id, order_number, customer_id, customer_name, customer_email, customer_phone, purchase_type, pickup_day, pickup_location_id, total_amount, walk_in_amount, order_items, notes, created_at, loyalty_points_earned").eq("id", orderId).eq("customer_id", user.id).eq("purchase_type", "online").maybeSingle();
  if (orderError) { console.error("SEC-005: admin notification order lookup failed", orderError.message); return jsonResponse(req, 500, { error: "Notification service unavailable" }); }
  if (!orderData) return jsonResponse(req, 404, { error: "Order not found" });
  const order = orderData as Order;
  const claimMode = await claimNotification(supabase, order.id, TYPE);
  let eventId: string | null = null;
  if (claimMode.mode === "error") { console.error("SEC-005: admin notification claim failed", claimMode.error); return jsonResponse(req, 500, { error: "Notification service unavailable" }); }
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
  if (order.pickup_location_id) { const { data } = await supabase.from("cms_pickup_locations").select("id, name_en, name_th, maps_url").eq("id", order.pickup_location_id).maybeSingle(); location = data as PickupLocation | null; }
  let pickupDay: PickupDay | null = null;
  if (order.pickup_day) {
    const { data } = await supabase.from("cms_pickup_days").select("id, label, label_en, label_th, location_id").eq("label", order.pickup_day).maybeSingle(); pickupDay = data as PickupDay | null;
    if (!location && pickupDay?.location_id) { const { data: fallbackLocation } = await supabase.from("cms_pickup_locations").select("id, name_en, name_th, maps_url").eq("id", pickupDay.location_id).maybeSingle(); location = fallbackLocation as PickupLocation | null; }
  }
  const { data: memberProfile, error: memberProfileError } = await supabase
    .from("user_profiles")
    .select("short_code")
    .eq("id", user.id)
    .maybeSingle();
  if (memberProfileError) {
    console.warn("SEC-005: admin notification member code lookup failed", memberProfileError.message);
  }
  const memberCode = typeof memberProfile?.short_code === "string" ? memberProfile.short_code : null;
  const email = buildEmail(order, location, pickupDay, memberCode);
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) { console.error("SEC-005: RESEND_API_KEY is not configured"); if (eventId) await finishNotification(supabase, eventId, "failed", null, "Email provider not configured"); return jsonResponse(req, 500, { error: "Notification service unavailable" }); }
  const resend = new Resend(resendKey);
  try {
    const { data, error } = await resend.emails.send({ from: "JOKO TODAY <orders@joko.today>", to: "jokotoday@gmail.com", subject: email.subject, html: email.html }, { idempotencyKey: notificationIdempotencyKey(TYPE, order.id) });
    if (error) { const summary = providerErrorSummary(error); console.error("SEC-005: admin notification provider rejected request", summary); if (eventId) await finishNotification(supabase, eventId, "failed", null, summary); return jsonResponse(req, 502, { error: "Email provider rejected notification" }); }
    if (eventId) { const persisted = await finishNotification(supabase, eventId, "sent", data?.id ?? null, null); if (!persisted) return jsonResponse(req, 503, { error: "Notification delivery state unavailable" }); }
    return jsonResponse(req, 200, { success: true, status: "sent" });
  } catch (error) {
    const summary = providerErrorSummary(error); console.error("SEC-005: admin notification delivery outcome uncertain", summary); if (eventId) await finishNotification(supabase, eventId, "uncertain", null, summary); return jsonResponse(req, 503, { error: "Notification delivery outcome unavailable" });
  }
});
