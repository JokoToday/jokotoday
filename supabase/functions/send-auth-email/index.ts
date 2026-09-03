import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Webhook } from "npm:standardwebhooks@1.0.0";
import { Resend } from "npm:resend";
import {
  buildTransactionalEmailShell,
  escapeHtml,
  JOKO_EMAIL_THEME,
  renderPrimaryButton,
  type TransactionalEmailLanguage,
} from "../_shared/transactional-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Language = TransactionalEmailLanguage;

interface AuthEmailPayload {
  user: {
    id: string;
    email: string;
    user_metadata?: Record<string, unknown>;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

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
      <div style="margin:0 0 24px;padding:24px 18px;text-align:center;background:${JOKO_EMAIL_THEME.paper};border:1px solid ${JOKO_EMAIL_THEME.border};border-radius:10px;">
        <div style="margin:0 0 10px;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${JOKO_EMAIL_THEME.sageDark};">${escapeHtml(c.verificationCode)}</div>
        <div style="font-size:38px;line-height:1.1;font-weight:800;letter-spacing:7px;color:${JOKO_EMAIL_THEME.charcoal};font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;">${escapeHtml(token)}</div>
        <div style="margin-top:12px;font-size:12px;line-height:1.55;color:${JOKO_EMAIL_THEME.subtle};">${escapeHtml(c.codeOnlyOnSite)}</div>
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

  const subject = c.genericSubject;
  const contentHtml = `
    <p style="margin:0 0 26px;font-size:15px;line-height:${language === "en" ? "1.65" : "1.85"};color:${JOKO_EMAIL_THEME.muted};">${escapeHtml(c.genericBody)}</p>
    <div style="margin:0 0 26px;text-align:center;">${renderPrimaryButton(confirmUrl, c.genericButton)}</div>
    <div style="margin:0 0 24px;padding:15px 16px;background:${JOKO_EMAIL_THEME.paper};border:1px solid ${JOKO_EMAIL_THEME.border};border-radius:8px;">
      <div style="margin:0 0 6px;font-size:12px;font-weight:700;color:${JOKO_EMAIL_THEME.sageDark};">${escapeHtml(c.copyLink)}</div>
      <div style="font-size:11px;line-height:1.55;color:${JOKO_EMAIL_THEME.muted};word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">${escapeHtml(confirmUrl)}</div>
    </div>
    <p style="margin:0;text-align:center;font-size:12px;line-height:${language === "en" ? "1.6" : "1.8"};color:${JOKO_EMAIL_THEME.subtle};">${escapeHtml(c.ignore)}</p>`;

  const html = buildTransactionalEmailShell({
    language,
    title: subject,
    preheader: c.genericBody,
    eyebrow,
    heading: c.genericHeading,
    contentHtml,
    footerText: c.footer,
    maxWidth: 520,
  });

  const text = [
    "JOKO TODAY",
    c.genericHeading,
    "",
    c.genericBody,
    "",
    c.genericButton,
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

    let payload: AuthEmailPayload;
    try {
      payload = wh.verify(rawBody, headers) as AuthEmailPayload;
    } catch (err) {
      console.error("Webhook verification failed:", String(err));
      return new Response(
        JSON.stringify({ error: { http_code: 401, message: "Webhook verification failed" } }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { user, email_data } = payload;
    if (!user?.email || !email_data) {
      console.error("Missing user.email or email_data in payload");
      return new Response(
        JSON.stringify({ error: { http_code: 400, message: "Invalid payload structure" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { email_action_type, token, token_hash, redirect_to, site_url } = email_data;

    if (email_action_type === "recovery") {
      console.warn("Password recovery email blocked because JOKO TODAY uses passwordless authentication");
      return new Response(
        JSON.stringify({ error: { http_code: 400, message: "Password recovery is not supported" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const isOtpFlow = email_action_type === "signup" || email_action_type === "magiclink";
    if (!token_hash || (isOtpFlow && !token)) {
      console.error("Missing required auth email token data");
      return new Response(
        JSON.stringify({ error: { http_code: 400, message: "Invalid auth email payload" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://xvhualoeboobulwgmkla.supabase.co";
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

    const confirmUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${encodeURIComponent(redirectUrl)}`;
    const email = buildAuthEmail(email_action_type, token, confirmUrl, language);

    const resend = new Resend(resendKey);
    const { error: emailError } = await resend.emails.send({
      from: "JOKO TODAY <noreply@joko.today>",
      to: user.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    if (emailError) {
      console.error("Auth email delivery failed", {
        name: emailError.name,
        statusCode: emailError.statusCode,
      });
      return new Response(
        JSON.stringify({ error: { http_code: 500, message: "Failed to send email" } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Auth email sent successfully", { actionType: email_action_type, language });
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
