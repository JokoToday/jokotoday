from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


# ---------------------------------------------------------------------------
# Admin order notification: member code + protected deep links to staff desks.
# ---------------------------------------------------------------------------
admin_path = "supabase/functions/send-admin-order-notification/index.ts"
admin = read(admin_path)

admin = replace_once(
    admin,
    'const TYPE = "admin_new_order" as const;\n',
    'const TYPE = "admin_new_order" as const;\nconst APP_URL = "https://joko.today";\n',
    "admin APP_URL",
)

admin = replace_once(
    admin,
    'function buildEmail(order: Order, location: PickupLocation | null, pickupDay: PickupDay | null): { subject: string; html: string } {',
    'function buildEmail(order: Order, location: PickupLocation | null, pickupDay: PickupDay | null, memberCode: string | null): { subject: string; html: string } {',
    "admin buildEmail signature",
)

admin = replace_once(
    admin,
    '  const mapsButtonTh = mapsUrl ? `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:16px;"><tr><td style="text-align:center;"><a href="${escapeHtml(mapsUrl)}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:600;">ดูตำแหน่งรับสินค้าบน Google Maps</a></td></tr></table>` : "";\n',
    '''  const mapsButtonTh = mapsUrl ? `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:16px;"><tr><td style="text-align:center;"><a href="${escapeHtml(mapsUrl)}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:600;">ดูตำแหน่งรับสินค้าบน Google Maps</a></td></tr></table>` : "";
  const pickupReturnPath = memberCode ? `/pickup?member=${encodeURIComponent(memberCode)}` : null;
  const walkInReturnPath = memberCode ? `/walk-in?member=${encodeURIComponent(memberCode)}` : null;
  const pickupStaffUrl = pickupReturnPath ? `${APP_URL}/staff?return=${encodeURIComponent(pickupReturnPath)}` : null;
  const walkInStaffUrl = walkInReturnPath ? `${APP_URL}/staff?return=${encodeURIComponent(walkInReturnPath)}` : null;
  const memberCodeRowEn = memberCode ? `<tr><td style="padding:10px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;">Member Code</td><td style="padding:10px 16px;font-size:15px;font-weight:800;color:#92400e;border-top:1px solid #e5e7eb;font-family:monospace;">${escapeHtml(memberCode)}</td></tr>` : "";
  const memberCodeRowTh = memberCode ? `<tr><td style="padding:10px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;">รหัสสมาชิก</td><td style="padding:10px 16px;font-size:15px;font-weight:800;color:#92400e;border-top:1px solid #e5e7eb;font-family:monospace;">${escapeHtml(memberCode)}</td></tr>` : "";
  const staffButtonsEn = pickupStaffUrl && walkInStaffUrl ? `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:-8px 0 24px;"><tr><td style="text-align:center;padding:0 4px;"><a href="${escapeHtml(pickupStaffUrl)}" style="display:inline-block;background:#334155;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:8px;font-size:13px;font-weight:700;">Open in Pickup Desk</a></td><td style="text-align:center;padding:0 4px;"><a href="${escapeHtml(walkInStaffUrl)}" style="display:inline-block;background:#ffffff;color:#334155;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;border:1px solid #94a3b8;">Open in Walk-In Desk</a></td></tr></table>` : "";
  const staffButtonsTh = pickupStaffUrl && walkInStaffUrl ? `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:-8px 0 24px;"><tr><td style="text-align:center;padding:0 4px;"><a href="${escapeHtml(pickupStaffUrl)}" style="display:inline-block;background:#334155;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:8px;font-size:13px;font-weight:700;">เปิดในจุดรับสินค้า</a></td><td style="text-align:center;padding:0 4px;"><a href="${escapeHtml(walkInStaffUrl)}" style="display:inline-block;background:#ffffff;color:#334155;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;border:1px solid #94a3b8;">เปิดในเคาน์เตอร์ Walk-In</a></td></tr></table>` : "";
''',
    "admin staff link variables",
)

english_items_marker = '</td></tr></table>\n<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#9ca3af;margin-bottom:12px;">Items Ordered</div>'
admin = replace_once(
    admin,
    english_items_marker,
    '</td></tr>${memberCodeRowEn}</table>\n${staffButtonsEn}\n<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#9ca3af;margin-bottom:12px;">Items Ordered</div>',
    "admin English member row",
)

thai_items_marker = '</td></tr></table>\n<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#9ca3af;margin-bottom:12px;">รายการสินค้า</div>'
admin = replace_once(
    admin,
    thai_items_marker,
    '</td></tr>${memberCodeRowTh}</table>\n${staffButtonsTh}\n<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#9ca3af;margin-bottom:12px;">รายการสินค้า</div>',
    "admin Thai member row",
)

admin = replace_once(
    admin,
    '  const email = buildEmail(order, location, pickupDay);\n',
    '''  const { data: memberProfile, error: memberProfileError } = await supabase
    .from("user_profiles")
    .select("short_code")
    .eq("id", user.id)
    .maybeSingle();
  if (memberProfileError) {
    console.warn("SEC-005: admin notification member code lookup failed", memberProfileError.message);
  }
  const memberCode = typeof memberProfile?.short_code === "string" ? memberProfile.short_code : null;
  const email = buildEmail(order, location, pickupDay, memberCode);
''',
    "admin member lookup",
)

write(admin_path, admin)


# ---------------------------------------------------------------------------
# Customer confirmation: full preferred-language email + compact other-language
# summaries. Preferred language remains the durable outbox snapshot.
# ---------------------------------------------------------------------------
customer_path = "supabase/functions/send-order-confirmation/index.ts"
customer = read(customer_path)

customer = replace_once(
    customer,
    '  cancelButton: string;\n  footer: string;\n',
    '  cancelButton: string;\n  summaryHeading: string;\n  footer: string;\n',
    "customer EmailCopy summaryHeading",
)
customer = replace_once(
    customer,
    '    cancelButton: "Cancel Order",\n    footer: "Thank you for choosing JOKO TODAY",\n',
    '    cancelButton: "Cancel Order",\n    summaryHeading: "English summary",\n    footer: "Thank you for choosing JOKO TODAY",\n',
    "customer English summary heading",
)
customer = replace_once(
    customer,
    '    cancelButton: "ยกเลิกคำสั่งซื้อ",\n    footer: "ขอบคุณที่ใช้บริการ JOKO TODAY",\n',
    '    cancelButton: "ยกเลิกคำสั่งซื้อ",\n    summaryHeading: "สรุปภาษาไทย",\n    footer: "ขอบคุณที่ใช้บริการ JOKO TODAY",\n',
    "customer Thai summary heading",
)
customer = replace_once(
    customer,
    '    cancelButton: "取消订单",\n    footer: "感谢您选择 JOKO TODAY",\n',
    '    cancelButton: "取消订单",\n    summaryHeading: "中文摘要",\n    footer: "感谢您选择 JOKO TODAY",\n',
    "customer Chinese summary heading",
)

summary_function = r'''
function buildCompactLanguageSummary(
  order: Order,
  location: PickupLocation | null,
  pickupDay: PickupDay | null,
  lang: Language,
): string {
  const copy = EMAIL_COPY[lang];
  const pickupLabel = getPickupDayLabel(pickupDay, order.pickup_day, lang);
  const locationName = getLocationName(location, lang);

  return `
        <tr>
          <td style="padding:0 40px 24px;">
            <div style="border-top:1px solid #e5e7eb;padding-top:20px;">
              <div style="font-size:13px;font-weight:800;color:#92400e;margin-bottom:12px;">${escapeHtml(copy.summaryHeading)}</div>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="font-size:13px;color:#4b5563;">
                <tr><td style="padding:4px 0;font-weight:600;">${escapeHtml(copy.orderNumber)}</td><td style="padding:4px 0;text-align:right;font-family:monospace;">#${escapeHtml(order.order_number)}</td></tr>
                <tr><td style="padding:4px 0;font-weight:600;">${escapeHtml(copy.pickupDay)}</td><td style="padding:4px 0;text-align:right;">${escapeHtml(pickupLabel)}</td></tr>
                <tr><td style="padding:4px 0;font-weight:600;">${escapeHtml(copy.pickupLocation)}</td><td style="padding:4px 0;text-align:right;">${escapeHtml(locationName)}</td></tr>
                <tr><td style="padding:4px 0;font-weight:600;">${escapeHtml(copy.grandTotal)}</td><td style="padding:4px 0;text-align:right;font-weight:800;color:#92400e;">฿${Number(order.total_amount).toFixed(2)}</td></tr>
              </table>
              <p style="font-size:12px;line-height:${lang === "en" ? "1.6" : "1.8"};color:#6b7280;margin:12px 0 4px;">${escapeHtml(copy.payment)}</p>
              <p style="font-size:12px;line-height:${lang === "en" ? "1.6" : "1.8"};color:#9ca3af;margin:4px 0 0;">${escapeHtml(copy.cancelNote)}</p>
            </div>
          </td>
        </tr>`;
}

'''
customer = replace_once(
    customer,
    'function buildEmail(\n',
    summary_function + 'function buildEmail(\n',
    "customer compact summary function",
)

customer = replace_once(
    customer,
    '  const customerName = escapeHtml(order.customer_name);\n',
    '''  const customerName = escapeHtml(order.customer_name);
  const languageSummaries = (["en", "th", "zh"] as Language[])
    .filter((summaryLanguage) => summaryLanguage !== lang)
    .map((summaryLanguage) => buildCompactLanguageSummary(order, location, pickupDay, summaryLanguage))
    .join("");
''',
    "customer language summaries",
)

footer_marker = '''        <tr>
          <td style="background:#faf7f2;padding:24px 40px;text-align:center;border-top:1px solid #fde68a;">'''
customer = replace_once(
    customer,
    footer_marker,
    '''        ${languageSummaries}

        <tr>
          <td style="background:#faf7f2;padding:24px 40px;text-align:center;border-top:1px solid #fde68a;">''',
    "customer insert language summaries",
)

write(customer_path, customer)


# ---------------------------------------------------------------------------
# Staff login: allow only validated local return paths to pickup/walk-in desks.
# ---------------------------------------------------------------------------
staff_path = "src/pages/StaffLoginPage.tsx"
staff = read(staff_path)

staff = replace_once(
    staff,
    '} as const;\n\nexport function StaffLoginPage',
    '''} as const;

function getSafeReturnPath(): string | null {
  const returnPath = new URLSearchParams(window.location.search).get('return');
  if (!returnPath) return null;
  return /^\\/(?:pickup|walk-in)(?:\\?member=VIP\\d+)?$/i.test(returnPath)
    ? returnPath
    : null;
}

export function StaffLoginPage''',
    "staff safe return helper",
)

staff = replace_once(
    staff,
    '''  useEffect(() => {
    if (user?.email && !email) setEmail(user.email);
  }, [user, email]);
''',
    '''  useEffect(() => {
    if (user?.email && !email) setEmail(user.email);
  }, [user, email]);

  useEffect(() => {
    if (!hasStaffAccess) return;
    const returnPath = getSafeReturnPath();
    if (!returnPath) return;
    window.location.replace(returnPath);
  }, [hasStaffAccess]);
''',
    "staff return effect",
)

write(staff_path, staff)


# ---------------------------------------------------------------------------
# Pickup and Walk-In desks: after staff authorization, auto-load ?member=VIPxxx.
# The existing customer-lookup service performs the member-code validation.
# ---------------------------------------------------------------------------
for desk_path in ["src/pages/PickupDeskPage.tsx", "src/pages/WalkInDeskPage.tsx"]:
    desk = read(desk_path)
    desk = replace_once(
        desk,
        "import { useRef, useState } from 'react';",
        "import { useEffect, useRef, useState } from 'react';",
        f"{desk_path} useEffect import",
    )
    desk = replace_once(
        desk,
        '  const uploadInputRef = useRef<HTMLInputElement>(null);\n',
        '  const uploadInputRef = useRef<HTMLInputElement>(null);\n  const deepLinkHandledRef = useRef(false);\n',
        f"{desk_path} deep-link ref",
    )
    desk = replace_once(
        desk,
        '  const handleScan = async (decodedText: string) => {\n',
        '''  useEffect(() => {
    if (!hasStaffAccess || deepLinkHandledRef.current) return;
    const memberCode = new URLSearchParams(window.location.search).get('member');
    if (!memberCode) return;
    deepLinkHandledRef.current = true;
    void findCustomer(memberCode, 'manual');
  }, [hasStaffAccess]);

  const handleScan = async (decodedText: string) => {
''',
        f"{desk_path} deep-link effect",
    )
    write(desk_path, desk)


# Final source-level assertions.
assert 'orders@jokotoday.com' not in read(admin_path)
assert 'orders@jokotoday.com' not in read(customer_path)
assert 'Member Code' in read(admin_path)
assert 'Open in Pickup Desk' in read(admin_path)
assert 'Open in Walk-In Desk' in read(admin_path)
assert 'English summary' in read(customer_path)
assert 'สรุปภาษาไทย' in read(customer_path)
assert '中文摘要' in read(customer_path)
assert 'getSafeReturnPath' in read(staff_path)
for desk_path in ["src/pages/PickupDeskPage.tsx", "src/pages/WalkInDeskPage.tsx"]:
    assert "deepLinkHandledRef" in read(desk_path)

print("Order email/staff deep-link patch applied successfully.")
