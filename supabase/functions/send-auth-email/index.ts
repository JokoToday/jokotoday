import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Webhook } from "npm:standardwebhooks@1.0.0";
import { Resend } from "npm:resend";
import {
  recipientsForAuthEmail,
  type AuthEmailEvent,
  type AuthEmailRecipient,
} from "../_shared/auth-email-routing.ts";
import {
  buildTransactionalEmailShell,
  escapeHtml,
  JOKO_EMAIL_THEME,
  jokoEmailLogoAttachment,
  renderPrimaryButton,
  type TransactionalEmailLanguage,
} from "../_shared/transactional-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Language = TransactionalEmailLanguage;

const copy = {
  en: {
    welcome: "Welcome",
    signIn: "Sign in",
    secureAction: "Account security",
    otpSubject: "Your JOKO TODAY verification code",
    otpHeading: "Your verification code",
    otpBody: "Enter this one-time code on JOKO TODAY to continue.",
    verificationCode: "Verification code",
    codeOnlyOnSite: "Use this code only on joko.today.",
    genericHeading: "Your secure link is ready",
    genericBody: "Use the button below to continue with JOKO TODAY. The link expires in 1 hour and can only be used once.",
    genericButton: "Continue to JOKO TODAY",
    genericSubject: "Your JOKO TODAY secure link",
    emailChangeSubject: "Your JOKO TODAY email verification",
    emailChangeHeading: "Verify your email address",
    emailChangeBody: "Confirm this email address to receive JOKO TODAY order updates and receipts.",
    emailChangeCurrentBody: "Someone requested an email change for your JOKO TODAY account. Confirm this request only if it was you.",
    emailChangeButton: "Verify email address",
    copyLink: "Or copy this link:",
    ignore: "If you did not request this, you can ignore this email.",
    footer: "A secure message from JOKO TODAY",
  },
  th: {
    welcome: "ยินดีต้อนรับ",
    signIn: "เข้าสู่ระบบ",
    secureAction: "ความปลอดภัยของบัญชี",
    otpSubject: "รหัสยืนยัน JOKO TODAY ของคุณ",
    otpHeading: "รหัสยืนยันของคุณ",
    otpBody: "กรอกรหัสใช้ครั้งเดียวนี้บน JOKO TODAY เพื่อดำเนินการต่อ",
    verificationCode: "รหัสยืนยัน",
    codeOnlyOnSite: "ใช้รหัสนี้เฉพาะบน joko.today เท่านั้น",
    genericHeading: "ลิงก์ที่ปลอดภัยของคุณพร้อมแล้ว",
    genericBody: "ใช้ปุ่มด้านล่างเพื่อดำเนินการต่อกับ JOKO TODAY ลิงก์นี้จะหมดอายุภายใน 1 ชั่วโมงและใช้ได้เพียงครั้งเดียว",
    genericButton: "ดำเนินการต่อไปยัง JOKO TODAY",
    genericSubject: "ลิงก์ที่ปลอดภัยของ JOKO TODAY",
    emailChangeSubject: "ยืนยันอีเมล JOKO TODAY",
    emailChangeHeading: "ยืนยันที่อยู่อีเมลของคุณ",
    emailChangeBody: "ยืนยันอีเมลนี้เพื่อรับข้อมูลคำสั่งซื้อและใบเสร็จจาก JOKO TODAY",
    emailChangeCurrentBody: "มีคำขอเปลี่ยนอีเมลในบัญชี JOKO TODAY โปรดยืนยันเฉพาะเมื่อคุณเป็นผู้ขอ",
    emailChangeButton: "ยืนยันอีเมล",
    copyLink: "หรือคัดลอกลิงก์นี้:",
    ignore: "หากคุณไม่ได้ร้องขออีเมลนี้ คุณสามารถละเว้นข้อความนี้ได้",
    footer: "ข้อความที่ปลอดภัยจาก JOKO TODAY",
  },
  zh: {
    welcome: "欢迎",
    signIn: "登录",
    secureAction: "账户安全",
    otpSubject: "您的 JOKO TODAY 验证码",
    otpHeading: "您的验证码",
    otpBody: "请在 JOKO TODAY 输入此一次性验证码以继续。",
    verificationCode: "验证码",
    codeOnlyOnSite: "请仅在 joko.today 使用此验证码。",
    genericHeading: "您的安全链接已准备好",
    genericBody: "请使用下方按钮继续使用 JOKO TODAY。此链接将在 1 小时后过期，并且只能使用一次。",
    genericButton: "继续前往 JOKO TODAY",
    genericSubject: "您的 JOKO TODAY 安全链接",
    emailChangeSubject: "验证 JOKO TODAY 电子邮箱",
    emailChangeHeading: "验证您的邮箱地址",
    emailChangeBody: "请验证此邮箱地址，以接收 JOKO TODAY 订单更新和收据。",
    emailChangeCurrentBody: "有人请求更改您的 JOKO TODAY 邮箱。仅在您本人提出请求时确认。",
    emailChangeButton: "验证邮箱",
    copyLink: "或复制此链接：",
    ignore: "如果这不是您本人请求的，请忽略此邮件。",
    footer: "来自 JOKO TODAY 的安全邮件",
  },
} as const;

function getLanguage(redirectTo: string): Language {
  try {
    const lang = new URL(redirectTo).searchParams.get("lang");
    return lang === "th" || lang === "zh" ? lang : "en";
  } catch {
    return "en";
  }
}

function buildAuthEmail(
  actionType: string,
  token: string,
  confirmUrl: string,
  language: Language,
  audience: AuthEmailRecipient["audience"] = "standard",
): { subject: string; html: string; text: string } {
  const c = copy[language];
  const isOtpFlow = actionType === "signup" || actionType === "magiclink";
  const eyebrow = actionType === "signup"
    ? c.welcome
    : isOtpFlow
    ? c.signIn
    : c.secureAction;

  if (isOtpFlow) {
    const subject = c.otpSubject;
    const contentHtml = `
      <p style="margin:0 0 24px;font-size:15px;line-height:${language === "en" ? "1.65" : "1.85"};color:${JOKO_EMAIL_THEME.muted};">${escapeHtml(c.otpBody)}</p>
      <div style="margin:0 0 24px;padding:25px 18px 24px;text-align:center;background:${JOKO_EMAIL_THEME.note};border:1px solid ${JOKO_EMAIL_THEME.border};border-radius:6px;">
        <div style="margin:0 0 10px;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${JOKO_EMAIL_THEME.ochre};">${escapeHtml(c.verificationCode)}</div>
        <div style="font-size:38px;line-height:1.1;font-weight:800;letter-spacing:7px;color:${JOKO_EMAIL_THEME.charcoal};font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;">${escapeHtml(token)}</div>
        <div style="margin-top:12px;font-size:12px;line-height:1.55;color:${JOKO_EMAIL_THEME.muted};">${escapeHtml(c.codeOnlyOnSite)}</div>
      </div>
      <p style="margin:0;text-align:center;font-size:12px;line-height:${language === "en" ? "1.6" : "1.8"};color:${JOKO_EMAIL_THEME.subtle};">${escapeHtml(c.ignore)}</p>`;

    const html = buildTransactionalEmailShell({
      language,
      title: subject,
      preheader: `${c.verificationCode}: ${token}`,
      eyebrow,
      heading: c.otpHeading,
      contentHtml,
      footerText: c.footer,
      maxWidth: 520,
    });

    const text = [
      "JOKO TODAY",
      c.otpHeading,
      "",
      c.otpBody,
      "",
      `${c.verificationCode}: ${token}`,
      c.codeOnlyOnSite,
      "",
      c.ignore,
      "",
      "joko.today",
    ].join("\n");

    return { subject, html, text };
  }

  const isEmailChange = actionType === "email_change";
  const subject = isEmailChange ? c.emailChangeSubject : c.genericSubject;
  const heading = isEmailChange ? c.emailChangeHeading : c.genericHeading;
  const body = isEmailChange
    ? (audience === "email_change_current" ? c.emailChangeCurrentBody : c.emailChangeBody)
    : c.genericBody;
  const button = isEmailChange ? c.emailChangeButton : c.genericButton;
  const contentHtml = `
    <p style="margin:0 0 26px;font-size:15px;line-height:${language === "en" ? "1.65" : "1.85"};color:${JOKO_EMAIL_THEME.muted};">${escapeHtml(body)}</p>
    <div style="margin:0 0 26px;text-align:center;">${renderPrimaryButton(confirmUrl, button)}</div>
    <div style="margin:0 0 24px;padding:15px 16px;background:${JOKO_EMAIL_THEME.paper};border:1px solid ${JOKO_EMAIL_THEME.border};border-radius:8px;">
      <div style="margin:0 0 6px;font-size:12px;font-weight:700;color:${JOKO_EMAIL_THEME.sageDark};">${escapeHtml(c.copyLink)}</div>
      <div style="font-size:11px;line-height:1.55;color:${JOKO_EMAIL_THEME.muted};word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">${escapeHtml(confirmUrl)}</div>
    </div>
    <p style="margin:0;text-align:center;font-size:12px;line-height:${language === "en" ? "1.6" : "1.8"};color:${JOKO_EMAIL_THEME.subtle};">${escapeHtml(c.ignore)}</p>`;

  const html = buildTransactionalEmailShell({
    language,
    title: subject,
    preheader: body,
    eyebrow,
    heading,
    contentHtml,
    footerText: c.footer,
    maxWidth: 520,
  });

  const text = [
    "JOKO TODAY",
    heading,
    "",
    body,
    "",
    button,
    confirmUrl,
    "",
    c.ignore,
    "",
    "joko.today",
  ].join("\n");

  return { subject, html, text };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: { http_code: 500, message: "RESEND_API_KEY not configured" } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
    if (!hookSecret) {
      console.error("SEND_EMAIL_HOOK_SECRET not configured");
      return new Response(
        JSON.stringify({ error: { http_code: 500, message: "SEND_EMAIL_HOOK_SECRET not configured" } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rawBody = await req.text();
    const headers = Object.fromEntries(req.headers);
    const secret = hookSecret.replace("v1,whsec_", "");
    const wh = new Webhook(secret);

    let payload: AuthEmailEvent;
    try {
      payload = wh.verify(rawBody, headers) as AuthEmailEvent;
    } catch (err) {
      console.error("Webhook verification failed:", String(err));
      return new Response(
        JSON.stringify({ error: { http_code: 401, message: "Webhook verification failed" } }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { email_data } = payload;
    if (!payload.user || !email_data) {
      console.error("Auth email hook missing user or email_data");
      return new Response(
        JSON.stringify({ error: { http_code: 400, message: "Invalid payload structure" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { email_action_type, redirect_to, site_url } = email_data;
    if (email_action_type === "recovery") {
      console.warn("Password recovery email blocked because JOKO TODAY uses passwordless authentication");
      return new Response(
        JSON.stringify({ error: { http_code: 400, message: "Password recovery is not supported" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify webhook signature before selecting addresses. LINE users have
    // no current email, so email_change must use verified user.new_email.
    let recipients: AuthEmailRecipient[];
    try {
      recipients = recipientsForAuthEmail(payload);
    } catch {
      console.error("Invalid auth email routing fields", { actionType: email_action_type });
      return new Response(
        JSON.stringify({ error: { http_code: 400, message: "Invalid auth email payload" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) {
      console.error("SUPABASE_URL not configured");
      return new Response(
        JSON.stringify({ error: { http_code: 500, message: "SUPABASE_URL not configured" } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const redirectUrl = redirect_to || site_url || supabaseUrl;
    if (!redirectUrl) {
      console.error("No redirect URL available");
      return new Response(
        JSON.stringify({ error: { http_code: 500, message: "No redirect URL configured" } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const language = getLanguage(redirectUrl);
    console.log("Auth email request received", { actionType: email_action_type, language });

    const resend = new Resend(resendKey);
    for (const recipient of recipients) {
      // Supabase email-change fields are inverted for compatibility:
      // old email => token_hash_new; new email => token_hash.
      const confirmUrl = `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(recipient.tokenHash)}&type=${encodeURIComponent(email_action_type)}&redirect_to=${encodeURIComponent(redirectUrl)}`;
      const email = buildAuthEmail(
        email_action_type, recipient.token, confirmUrl, language, recipient.audience,
      );
      const { error: emailError } = await resend.emails.send({
        from: "JOKO TODAY <noreply@joko.today>",
        to: recipient.address,
        subject: email.subject,
        html: email.html,
        text: email.text,
        attachments: [jokoEmailLogoAttachment()],
      });
      if (emailError) {
        console.error("Auth email delivery failed", {
          actionType: email_action_type,
          audience: recipient.audience,
          name: emailError.name,
          statusCode: emailError.statusCode,
        });
        return new Response(
          JSON.stringify({ error: { http_code: 500, message: "Failed to send email" } }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    console.log("Auth email sent successfully", {
      actionType: email_action_type, language, recipientCount: recipients.length,
    });
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    console.error("Unhandled auth email error");
    return new Response(
      JSON.stringify({ error: { http_code: 500, message: "Unexpected auth email error" } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
