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
  confirmUrl: string
): { subject: string; html: string } {
  const headerLabel =
    actionType === "recovery"
      ? "Password Reset"
      : actionType === "signup"
      ? "Welcome"
      : "Sign In";

  const heading =
    actionType === "recovery"
      ? "Reset your password"
      : actionType === "signup"
      ? "Confirm your email address"
      : "Your magic link is ready";

  const body =
    actionType === "recovery"
      ? "Click the button below to reset your password. This link expires in 1 hour."
      : actionType === "signup"
      ? "Thanks for signing up! Click the button below to confirm your email address and activate your account."
      : "Click the button below to sign in to JOKO TODAY. This link expires in 1 hour and can only be used once.";

  const buttonText =
    actionType === "recovery"
      ? "Reset Password"
      : actionType === "signup"
      ? "Confirm Email"
      : "Sign In to JOKO TODAY";

  const subject =
    actionType === "recovery"
      ? "Reset your JOKO TODAY password"
      : actionType === "signup"
      ? "Confirm your JOKO TODAY account"
      : "Your JOKO TODAY sign-in link";

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
            <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 32px;">${body}</p>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:32px;">
              <tr>
                <td style="text-align:center;">
                  <a href="${confirmUrl}" style="display:inline-block;background:linear-gradient(135deg,#92400e 0%,#b45309 100%);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.3px;">${buttonText}</a>
                </td>
              </tr>
            </table>
            <div style="background:#faf7f2;border:1px solid #fde68a;border-radius:10px;padding:16px 18px;margin-bottom:24px;">
              <p style="font-size:12px;color:#92400e;margin:0 0 6px;font-weight:600;">Or copy this link:</p>
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

    const { email_action_type, token_hash, redirect_to, site_url } = email_data;

    console.log("Action type:", email_action_type, "| Email:", user.email);
    console.log("Redirect to (from payload):", redirect_to, "| Site URL:", site_url);

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

    const { subject, html } = buildEmailHtml(email_action_type, confirmUrl);

    const resend = new Resend(resendKey);
    const { error: emailError } = await resend.emails.send({
      from: "JOKO TODAY <noreply@jokotoday.com>",
      to: user.email,
      subject,
      html,
    });

    if (emailError) {
      console.error("Resend error:", JSON.stringify(emailError));
      return new Response(
        JSON.stringify({ error: { http_code: 500, message: "Failed to send email" } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Email sent successfully to:", user.email);
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unhandled error:", String(err));
    return new Response(
      JSON.stringify({ error: { http_code: 500, message: String(err) } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
