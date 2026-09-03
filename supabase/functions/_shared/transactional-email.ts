export type TransactionalEmailLanguage = "en" | "th" | "zh";

export const JOKO_EMAIL_THEME = {
  paper: "#F6F1E7",
  surface: "#FFFEFB",
  sage: "#74806A",
  sageDark: "#5F6B57",
  charcoal: "#2B2A26",
  muted: "#716F68",
  subtle: "#9A978E",
  border: "#DDD5C7",
  ochre: "#B77935",
  ochreSoft: "#F3E6D2",
  successSoft: "#EEF2E9",
} as const;

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function languageAttribute(language: TransactionalEmailLanguage): string {
  return language === "zh" ? "zh-Hans" : language;
}

export function emailFontFamily(language: TransactionalEmailLanguage): string {
  if (language === "th") {
    return "'Noto Sans Thai','Leelawadee UI',Tahoma,-apple-system,'Segoe UI',Arial,sans-serif";
  }
  if (language === "zh") {
    return "'PingFang SC','Microsoft YaHei','Noto Sans SC',-apple-system,'Segoe UI',Arial,sans-serif";
  }
  return "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";
}

export function renderPrimaryButton(href: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr>
        <td bgcolor="${JOKO_EMAIL_THEME.ochre}" style="border-radius:8px;text-align:center;">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 24px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;line-height:1.2;">${escapeHtml(label)}</a>
        </td>
      </tr>
    </table>`;
}

export function renderSecondaryLink(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="color:${JOKO_EMAIL_THEME.sageDark};font-weight:700;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px;">${escapeHtml(label)}</a>`;
}

interface TransactionalEmailShellOptions {
  language: TransactionalEmailLanguage;
  title: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  contentHtml: string;
  footerText: string;
  maxWidth?: number;
}

export function buildTransactionalEmailShell(options: TransactionalEmailShellOptions): string {
  const {
    language,
    title,
    preheader,
    eyebrow,
    heading,
    contentHtml,
    footerText,
    maxWidth = 600,
  } = options;
  const theme = JOKO_EMAIL_THEME;
  const fontFamily = emailFontFamily(language);

  return `<!DOCTYPE html>
<html lang="${languageAttribute(language)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${theme.paper};font-family:${fontFamily};color:${theme.charcoal};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table width="100%" role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:${theme.paper};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="100%" role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${maxWidth}px;background:${theme.surface};border:1px solid ${theme.border};border-radius:14px;overflow:hidden;">
          <tr>
            <td bgcolor="${theme.sage}" style="background:${theme.sage};padding:28px 32px 26px;text-align:center;">
              <div style="font-size:25px;line-height:1.15;font-weight:800;letter-spacing:0.2px;color:#ffffff;">JOKO TODAY</div>
              <div style="margin-top:7px;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:#F3F0E8;">${escapeHtml(eyebrow)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:34px 34px 32px;">
              <h1 style="margin:0 0 24px;font-size:25px;line-height:1.25;font-weight:750;letter-spacing:-0.2px;color:${theme.charcoal};">${escapeHtml(heading)}</h1>
              ${contentHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;text-align:center;background:${theme.paper};border-top:1px solid ${theme.border};">
              <div style="font-size:12px;line-height:1.6;color:${theme.subtle};">${escapeHtml(footerText)}</div>
              <div style="margin-top:3px;font-size:12px;line-height:1.6;color:${theme.subtle};">joko.today</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
