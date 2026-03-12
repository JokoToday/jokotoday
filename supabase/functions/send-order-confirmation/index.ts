import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
  customer_name: string;
  customer_email: string;
  total_amount: number;
  pickup_day: string;
  pickup_location_id: string | null;
  order_items: OrderItem[];
  created_at: string;
  loyalty_points_earned?: number;
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

interface UserProfile {
  preferred_language?: string;
}

type Language = "en" | "th" | "zh";

function buildMapsLink(mapsUrl: string | null, locationName: string): string {
  if (mapsUrl) return mapsUrl;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationName)}`;
}

function getLocationName(location: PickupLocation | null, lang: Language): string {
  if (!location) return "—";
  if (lang === "th") return location.name_th || location.name_en;
  if (lang === "zh") return location.name_zh || location.name_en;
  return location.name_en;
}

function getPickupDayLabel(day: PickupDay | null, lang: Language): string {
  if (!day) return "—";
  if (lang === "th") return day.label_th || day.label_en || day.label;
  if (lang === "zh") return day.label_zh || day.label_en || day.label;
  return day.label_en || day.label;
}

function getProductName(item: OrderItem, lang: Language): string {
  if (lang === "th") return item.product_name_th || item.product_name || "—";
  if (lang === "zh") return item.product_name_zh || item.product_name || "—";
  return item.product_name || "—";
}

function buildItemsTableRows(items: OrderItem[], lang: Language): string {
  return items
    .map((item) => {
      const name = getProductName(item, lang);
      const lineTotal = (item.price_at_order * item.quantity).toFixed(2);
      return `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #fde68a;color:#1a1a1a;font-weight:500;">${name}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #fde68a;text-align:center;color:#4b5563;">${item.quantity}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #fde68a;text-align:right;color:#4b5563;">฿${Number(item.price_at_order).toFixed(2)}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #fde68a;text-align:right;font-weight:700;color:#92400e;">฿${lineTotal}</td>
        </tr>`;
    })
    .join("");
}

const APP_URL = "https://joko.today";

function buildLoyaltyBlockEn(points: number): string {
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
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#b45309;">Points Earned This Order</div>
                <div style="font-size:22px;font-weight:800;color:#92400e;margin-top:2px;">+${points} pts</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function buildLoyaltyBlockTh(points: number): string {
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
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#b45309;">แต้มที่ได้รับจากออเดอร์นี้</div>
                <div style="font-size:22px;font-weight:800;color:#92400e;margin-top:2px;">+${points} แต้ม</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function buildLoyaltyBlockZh(points: number): string {
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
                <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#b45309;">本单获得积分</div>
                <div style="font-size:22px;font-weight:800;color:#92400e;margin-top:2px;">+${points} 积分</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function buildEmailEn(
  order: Order,
  items: OrderItem[],
  location: PickupLocation | null,
  pickupDay: PickupDay | null
): { subject: string; html: string } {
  const subject = `Your JOKO TODAY Order Confirmation – #${order.order_number}`;
  const locationName = getLocationName(location, "en");
  const pickupLabel = getPickupDayLabel(pickupDay, "en");
  const mapsLink = buildMapsLink(location?.maps_url ?? null, locationName);
  const itemRows = buildItemsTableRows(items, "en");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#faf7f2;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td style="padding:40px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#92400e 0%,#b45309 100%);padding:36px 40px;text-align:center;">
            <div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">JOKO TODAY</div>
            <div style="font-size:13px;color:#fde68a;margin-top:6px;letter-spacing:2px;text-transform:uppercase;">Order Confirmed</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="font-size:17px;color:#1a1a1a;margin:0 0 8px;">Hi ${order.customer_name},</p>
            <p style="font-size:15px;color:#4b5563;line-height:1.6;margin:0 0 32px;">
              Thank you for your order! We've received it and it's being prepared with love.
              Please find your order details below.
            </p>

            <!-- Order Number -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#fffbf2;border:1px solid #fde68a;border-radius:10px;margin-bottom:32px;">
              <tr>
                <td style="padding:20px 24px;">
                  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#b45309;">Order Number</div>
                  <div style="font-size:22px;font-weight:800;color:#1a1a1a;font-family:monospace;margin-top:6px;">#${order.order_number}</div>
                </td>
              </tr>
            </table>

            <!-- Pickup Details -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:32px;">
              <tr>
                <td width="50%" style="padding-right:8px;">
                  <div style="background:#fffbf2;border:1px solid #fde68a;border-radius:10px;padding:16px 18px;">
                    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#b45309;">Pickup Day</div>
                    <div style="font-size:15px;font-weight:600;color:#1a1a1a;margin-top:5px;">${pickupLabel}</div>
                  </div>
                </td>
                <td width="50%" style="padding-left:8px;">
                  <div style="background:#fffbf2;border:1px solid #fde68a;border-radius:10px;padding:16px 18px;">
                    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#b45309;">Pickup Location</div>
                    <div style="font-size:15px;font-weight:600;color:#1a1a1a;margin-top:5px;">${locationName}</div>
                  </div>
                </td>
              </tr>
            </table>

            <!-- Maps Button -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:32px;">
              <tr>
                <td style="text-align:center;">
                  <a href="${mapsLink}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.3px;">
                    View Pickup Location on Maps
                  </a>
                </td>
              </tr>
            </table>

            <!-- Items Table -->
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;margin-bottom:12px;">Items Ordered</div>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
              <thead>
                <tr style="background:#fef3c7;">
                  <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#92400e;">Product</th>
                  <th style="padding:10px 16px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#92400e;">Qty</th>
                  <th style="padding:10px 16px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#92400e;">Price</th>
                  <th style="padding:10px 16px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#92400e;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemRows}
                <tr>
                  <td colspan="3" style="padding:16px;text-align:right;color:#6b7280;font-size:14px;border-top:2px solid #fde68a;">Grand Total</td>
                  <td style="padding:16px;text-align:right;font-size:20px;font-weight:800;color:#92400e;border-top:2px solid #fde68a;">฿${Number(order.total_amount).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            <!-- Payment Note -->
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 18px;margin-top:28px;">
              <div style="font-size:14px;color:#1e40af;font-weight:500;">
                Payment is due at pickup. Please bring exact change or arrange payment in advance.
              </div>
            </div>

            ${buildLoyaltyBlockEn(order.loyalty_points_earned ?? 0)}

            <!-- Cancel Order -->
            <div style="margin-top:28px;text-align:center;">
              <p style="font-size:12px;color:#9ca3af;margin:0 0 10px;">Need to cancel? You can cancel your order up to 24 hours before your pickup day.</p>
              <a href="${APP_URL}/?page=my-orders" style="display:inline-block;background:#fff;color:#dc2626;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:600;border:1.5px solid #fca5a5;">
                Cancel Order
              </a>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#faf7f2;padding:24px 40px;text-align:center;border-top:1px solid #fde68a;">
            <div style="font-size:13px;color:#9ca3af;">Thank you for choosing JOKO TODAY &nbsp;•&nbsp; joko.today</div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

function buildEmailTh(
  order: Order,
  items: OrderItem[],
  location: PickupLocation | null,
  pickupDay: PickupDay | null
): { subject: string; html: string } {
  const subject = `ยืนยันคำสั่งซื้อ JOKO TODAY ของคุณ – #${order.order_number}`;
  const locationName = getLocationName(location, "th");
  const pickupLabel = getPickupDayLabel(pickupDay, "th");
  const mapsLink = buildMapsLink(location?.maps_url ?? null, locationName);
  const itemRows = buildItemsTableRows(items, "th");

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#faf7f2;font-family:'Sarabun',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td style="padding:40px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <tr>
          <td style="background:linear-gradient(135deg,#92400e 0%,#b45309 100%);padding:36px 40px;text-align:center;">
            <div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">JOKO TODAY</div>
            <div style="font-size:13px;color:#fde68a;margin-top:6px;letter-spacing:2px;text-transform:uppercase;">ยืนยันคำสั่งซื้อ</div>
          </td>
        </tr>

        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="font-size:17px;color:#1a1a1a;margin:0 0 8px;">สวัสดีคุณ ${order.customer_name},</p>
            <p style="font-size:15px;color:#4b5563;line-height:1.8;margin:0 0 32px;">
              ขอบคุณสำหรับคำสั่งซื้อของคุณ! เราได้รับคำสั่งซื้อเรียบร้อยแล้ว
              กรุณาตรวจสอบรายละเอียดคำสั่งซื้อด้านล่าง
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#fffbf2;border:1px solid #fde68a;border-radius:10px;margin-bottom:32px;">
              <tr>
                <td style="padding:20px 24px;">
                  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#b45309;">หมายเลขคำสั่งซื้อ</div>
                  <div style="font-size:22px;font-weight:800;color:#1a1a1a;font-family:monospace;margin-top:6px;">#${order.order_number}</div>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:32px;">
              <tr>
                <td width="50%" style="padding-right:8px;">
                  <div style="background:#fffbf2;border:1px solid #fde68a;border-radius:10px;padding:16px 18px;">
                    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#b45309;">วันรับสินค้า</div>
                    <div style="font-size:15px;font-weight:600;color:#1a1a1a;margin-top:5px;">${pickupLabel}</div>
                  </div>
                </td>
                <td width="50%" style="padding-left:8px;">
                  <div style="background:#fffbf2;border:1px solid #fde68a;border-radius:10px;padding:16px 18px;">
                    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#b45309;">สถานที่รับสินค้า</div>
                    <div style="font-size:15px;font-weight:600;color:#1a1a1a;margin-top:5px;">${locationName}</div>
                  </div>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:32px;">
              <tr>
                <td style="text-align:center;">
                  <a href="${mapsLink}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
                    ดูสถานที่รับสินค้าบน Google Maps
                  </a>
                </td>
              </tr>
            </table>

            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;margin-bottom:12px;">รายการสินค้า</div>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
              <thead>
                <tr style="background:#fef3c7;">
                  <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#92400e;">สินค้า</th>
                  <th style="padding:10px 16px;text-align:center;font-size:11px;font-weight:700;color:#92400e;">จำนวน</th>
                  <th style="padding:10px 16px;text-align:right;font-size:11px;font-weight:700;color:#92400e;">ราคา/ชิ้น</th>
                  <th style="padding:10px 16px;text-align:right;font-size:11px;font-weight:700;color:#92400e;">รวม</th>
                </tr>
              </thead>
              <tbody>
                ${itemRows}
                <tr>
                  <td colspan="3" style="padding:16px;text-align:right;color:#6b7280;font-size:14px;border-top:2px solid #fde68a;">ยอดรวมทั้งหมด</td>
                  <td style="padding:16px;text-align:right;font-size:20px;font-weight:800;color:#92400e;border-top:2px solid #fde68a;">฿${Number(order.total_amount).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 18px;margin-top:28px;">
              <div style="font-size:14px;color:#1e40af;font-weight:500;">
                กรุณาชำระเงินเมื่อรับสินค้า
              </div>
            </div>

            ${buildLoyaltyBlockTh(order.loyalty_points_earned ?? 0)}

            <!-- Cancel Order -->
            <div style="margin-top:28px;text-align:center;">
              <p style="font-size:12px;color:#9ca3af;margin:0 0 10px;">ต้องการยกเลิก? คุณสามารถยกเลิกคำสั่งซื้อได้ก่อน 24 ชั่วโมงก่อนวันรับสินค้า</p>
              <a href="${APP_URL}/?page=my-orders" style="display:inline-block;background:#fff;color:#dc2626;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:600;border:1.5px solid #fca5a5;">
                ยกเลิกคำสั่งซื้อ
              </a>
            </div>
          </td>
        </tr>

        <tr>
          <td style="background:#faf7f2;padding:24px 40px;text-align:center;border-top:1px solid #fde68a;">
            <div style="font-size:13px;color:#9ca3af;">ขอบคุณที่ใช้บริการ JOKO TODAY &nbsp;•&nbsp; joko.today</div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

function buildEmailZh(
  order: Order,
  items: OrderItem[],
  location: PickupLocation | null,
  pickupDay: PickupDay | null
): { subject: string; html: string } {
  const subject = `您的 JOKO TODAY 订单确认 – #${order.order_number}`;
  const locationName = getLocationName(location, "zh");
  const pickupLabel = getPickupDayLabel(pickupDay, "zh");
  const mapsLink = buildMapsLink(location?.maps_url ?? null, locationName);
  const itemRows = buildItemsTableRows(items, "zh");

  const html = `<!DOCTYPE html>
<html lang="zh-Hans">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#faf7f2;font-family:'PingFang SC','Microsoft YaHei',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td style="padding:40px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <tr>
          <td style="background:linear-gradient(135deg,#92400e 0%,#b45309 100%);padding:36px 40px;text-align:center;">
            <div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">JOKO TODAY</div>
            <div style="font-size:13px;color:#fde68a;margin-top:6px;letter-spacing:2px;text-transform:uppercase;">订单已确认</div>
          </td>
        </tr>

        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="font-size:17px;color:#1a1a1a;margin:0 0 8px;">您好，${order.customer_name}，</p>
            <p style="font-size:15px;color:#4b5563;line-height:1.8;margin:0 0 32px;">
              感谢您的订购！我们已成功收到您的订单，正在用心为您准备。
              请查阅以下订单详情。
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#fffbf2;border:1px solid #fde68a;border-radius:10px;margin-bottom:32px;">
              <tr>
                <td style="padding:20px 24px;">
                  <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:#b45309;">订单编号</div>
                  <div style="font-size:22px;font-weight:800;color:#1a1a1a;font-family:monospace;margin-top:6px;">#${order.order_number}</div>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:32px;">
              <tr>
                <td width="50%" style="padding-right:8px;">
                  <div style="background:#fffbf2;border:1px solid #fde68a;border-radius:10px;padding:16px 18px;">
                    <div style="font-size:10px;font-weight:700;letter-spacing:1px;color:#b45309;">取货日期</div>
                    <div style="font-size:15px;font-weight:600;color:#1a1a1a;margin-top:5px;">${pickupLabel}</div>
                  </div>
                </td>
                <td width="50%" style="padding-left:8px;">
                  <div style="background:#fffbf2;border:1px solid #fde68a;border-radius:10px;padding:16px 18px;">
                    <div style="font-size:10px;font-weight:700;letter-spacing:1px;color:#b45309;">取货地点</div>
                    <div style="font-size:15px;font-weight:600;color:#1a1a1a;margin-top:5px;">${locationName}</div>
                  </div>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:32px;">
              <tr>
                <td style="text-align:center;">
                  <a href="${mapsLink}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
                    在 Google 地图查看取货地点
                  </a>
                </td>
              </tr>
            </table>

            <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:#9ca3af;margin-bottom:12px;">订购商品</div>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
              <thead>
                <tr style="background:#fef3c7;">
                  <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#92400e;">商品</th>
                  <th style="padding:10px 16px;text-align:center;font-size:11px;font-weight:700;color:#92400e;">数量</th>
                  <th style="padding:10px 16px;text-align:right;font-size:11px;font-weight:700;color:#92400e;">单价</th>
                  <th style="padding:10px 16px;text-align:right;font-size:11px;font-weight:700;color:#92400e;">小计</th>
                </tr>
              </thead>
              <tbody>
                ${itemRows}
                <tr>
                  <td colspan="3" style="padding:16px;text-align:right;color:#6b7280;font-size:14px;border-top:2px solid #fde68a;">总计</td>
                  <td style="padding:16px;text-align:right;font-size:20px;font-weight:800;color:#92400e;border-top:2px solid #fde68a;">฿${Number(order.total_amount).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 18px;margin-top:28px;">
              <div style="font-size:14px;color:#1e40af;font-weight:500;">
                请在取货时付款，感谢您的理解与配合。
              </div>
            </div>

            ${buildLoyaltyBlockZh(order.loyalty_points_earned ?? 0)}

            <!-- Cancel Order -->
            <div style="margin-top:28px;text-align:center;">
              <p style="font-size:12px;color:#9ca3af;margin:0 0 10px;">需要取消？您可以在取货日期前 24 小时内取消订单。</p>
              <a href="${APP_URL}/?page=my-orders" style="display:inline-block;background:#fff;color:#dc2626;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:600;border:1.5px solid #fca5a5;">
                取消订单
              </a>
            </div>
          </td>
        </tr>

        <tr>
          <td style="background:#faf7f2;padding:24px 40px;text-align:center;border-top:1px solid #fde68a;">
            <div style="font-size:13px;color:#9ca3af;">感谢您选择 JOKO TODAY &nbsp;•&nbsp; joko.today</div>
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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { order_id, language: bodyLanguage } = await req.json();

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: "order_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .maybeSingle();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: "Order not found", detail: orderError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!order.customer_email) {
      return new Response(
        JSON.stringify({ error: "Order has no customer email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let lang: Language = "en";
    if (bodyLanguage === "th" || bodyLanguage === "zh") {
      lang = bodyLanguage;
    } else if (order.customer_id) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("preferred_language")
        .eq("id", order.customer_id)
        .maybeSingle() as { data: UserProfile | null };

      if (profile?.preferred_language) {
        const pl = profile.preferred_language.toLowerCase();
        if (pl === "th") lang = "th";
        else if (pl === "zh") lang = "zh";
        else lang = "en";
      }
    }

    let location: PickupLocation | null = null;
    if (order.pickup_location_id) {
      const { data: loc } = await supabase
        .from("cms_pickup_locations")
        .select("id, name_en, name_th, name_zh, maps_url")
        .eq("id", order.pickup_location_id)
        .maybeSingle();
      location = loc;
    }

    let pickupDay: PickupDay | null = null;
    if (order.pickup_day) {
      const { data: pd } = await supabase
        .from("cms_pickup_days")
        .select("id, label, label_en, label_th, label_zh, location_id")
        .eq("label", order.pickup_day)
        .maybeSingle();
      pickupDay = pd;

      if (!location && pd?.location_id) {
        const { data: loc } = await supabase
          .from("cms_pickup_locations")
          .select("id, name_en, name_th, name_zh, maps_url")
          .eq("id", pd.location_id)
          .maybeSingle();
        location = loc;
      }
    }

    const items: OrderItem[] = Array.isArray(order.order_items) ? order.order_items : [];

    let emailContent: { subject: string; html: string };
    if (lang === "th") {
      emailContent = buildEmailTh(order, items, location, pickupDay);
    } else if (lang === "zh") {
      emailContent = buildEmailZh(order, items, location, pickupDay);
    } else {
      emailContent = buildEmailEn(order, items, location, pickupDay);
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendKey);
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "JOKO TODAY <orders@jokotoday.com>",
      to: order.customer_email,
      subject: emailContent.subject,
      html: emailContent.html,
    });

    if (emailError) {
      console.error("Resend error:", emailError);
      return new Response(
        JSON.stringify({ error: "Failed to send email", detail: emailError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, email_id: emailData?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
