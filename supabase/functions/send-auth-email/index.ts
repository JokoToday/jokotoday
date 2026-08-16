import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Webhook } from "npm:standardwebhooks@1.0.0";
import { Resend } from "npm:resend";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

function buildEmailHtml(
  actionType: string,
  token: string,
  confirmUrl: string
): { subject: string; html: string } {
  const isRecovery = actionType === "recovery";

  const headerLabel = isRecovery
    ? "Password Reset"
    : actionType === "signup"
    ? "Welcome"
    : "Sign In";

  const heading = isRecovery
    ? "Reset your password"
    : "Your JOKO TODAY verification code";

  const body = isRecovery
    ? "Click the button below to reset your password. This link expires in 1 hour."
    : "Enter this one-time code on JOKO TODAY to continue. During our transition to code-based sign-in, the secure sign-in link below remains available as a fallback.";

  const buttonText = isRecovery
    ? "Reset Password"
    : actionType === "signup"
    ? "Confirm Email with Link"
    : "Sign In with Link";

  const subject = isRecovery
    ? "Reset your JOKO TODAY password"
    : `${token} is your JOKO TODAY verification code`;

  const otpBlock = isRecovery
    ? ""
    : `
            <div style="background:#fffaf0;border:1px solid #fcd34d;border-radius:14px;padding:24px 18px;margin:0 0 28px;text-align:center;">
              <p style="font-size:12px;color:#92400e;margin:0 0 10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">Verification code</p>
              <div style="font-size:36px;line-height:1.1;font-weight:800;letter-spacing:8px;color:#1f2937;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;">${token}</div>
              <p style="font-size:12px;color:#9ca3af;margin:12px 0 0;">Use this code only on joko.today.</p>
            </div>`;

  const fallbackLabel = isRecovery ? "Or copy this link:" : "Prefer the link? You can still use it during this transition:";

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
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#92400e 0%,#b45309 100%);padding:36px 40px;text-align:center;">
            <div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">JOKO TODAY</div>
            <div style="font-size:12px;color:#fde68a;margin-top:6px;letter-spacing:2px;text-transform:uppercase;">${headerLabel}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="font-size:16px;color:#1a1a1a;margin:0 0 8px;font-weight:600;">${heading}</p>
            <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 28px;">${body}</p>
            ${otpBlock}
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
              <tr>
                <td style="text-align:center;">
                  <a href="${confirmUrl}" style="display:inline-block;background:linear-gradient(135deg,#92400e 0%,#b45309 100%);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.3px;">${buttonText}</a>
                </td>
              </tr>
            </table>
            <div style="background:#faf7f2;border:1px solid #fde68a;border-radius:10px;padding:16px 18px;margin-bottom:24px;">
              <p style="font-size:12px;color:#92400e;margin:0 0 6px;font-weight:600;">${fallbackLabel}</p>
              <p style="font-size:11px;color:#6b7280;margin:0;word-break:break-all;font-family:monospace;">${confirmUrl}</p>
            </div>
            <p style="font-size:12px;color:#9ca3af;margin:0;text-align:center;">If you did not request this, you can safely ignore this email.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#faf7f2;padding:20px 40px;text-align:center;border-top:1px solid #fde68a;">
            <div style="font-size:12px;color:#9ca3af;">JOKO TODAY &nbsp;•&nbsp; joko.today</div>
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
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: { http_code: 500, message: "RESEND_API_KEY not configured" } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
    if (!hookSecret) {
      console.error("SEND_EMAIL_HOOK_SECRET not configured");
      return new Response(
        JSON.stringify({ error: { http_code: 500, message: "SEND_EMAIL_HOOK_SECRET not configured" } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user, email_data } = payload;

    if (!user?.email || !email_data) {
      console.error("Missing user.email or email_data in payload");
      return new Response(
        JSON.stringify({ error: { http_code: 400, message: "Invalid payload structure" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email_action_type, token, token_hash, redirect_to, site_url } = email_data;

    if (!token || !token_hash) {
      console.error("Missing token or token_hash in auth email payload");
      return new Response(
        JSON.stringify({ error: { http_code: 400, message: "Invalid auth email payload" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Auth email request received", { actionType: email_action_type });

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://xvhualoeboobulwgmkla.supabase.co";
    const redirectUrl = redirect_to || site_url || supabaseUrl;

    if (!redirectUrl) {
      console.error("No redirect URL available");
      return new Response(
        JSON.stringify({ error: { http_code: 500, message: "No redirect URL configured" } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const confirmUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${encodeURIComponent(redirectUrl)}`;

    const { subject, html } = buildEmailHtml(email_action_type, token, confirmUrl);

    const resend = new Resend(resendKey);
    const { error: emailError } = await resend.emails.send({
      from: "JOKO TODAY <noreply@joko.today>",
      to: user.email,
      subject,
      html,
    });

    if (emailError) {
      console.error("Auth email delivery failed", {
        name: emailError.name,
        statusCode: emailError.statusCode,
      });
      return new Response(
        JSON.stringify({ error: { http_code: 500, message: "Failed to send email" } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Auth email sent successfully", { actionType: email_action_type });
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    console.error("Unhandled auth email error");
    return new Response(
      JSON.stringify({ error: { http_code: 500, message: "Unexpected auth email error" } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
