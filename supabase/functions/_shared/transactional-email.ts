export type TransactionalEmailLanguage = "en" | "th" | "zh";

export const DEFAULT_JOKO_EMAIL_LOGO_URL = "https://joko.today/JOKO.TODAY_email_logo.png";

export const JOKO_EMAIL_THEME = {
  paper: "#F7EAD7",
  surface: "#FFF9EF",
  sage: "#C7C79A",
  sageDark: "#52603B",
  charcoal: "#24231F",
  muted: "#5A554A",
  subtle: "#8C8477",
  border: "#E0CBAA",
  ochre: "#C45A00",
  ochreSoft: "#F0DBBB",
  note: "#F0DBBB",
  successSoft: "#EEF0D9",
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
  return "'Avenir Next','Trebuchet MS',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";
}

export function emailDisplayFontFamily(language: TransactionalEmailLanguage): string {
  if (language === "th") return emailFontFamily(language);
  if (language === "zh") return emailFontFamily(language);
  return "'Avenir Next','Trebuchet MS','Segoe UI',Arial,sans-serif";
}

export function renderPrimaryButton(href: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr>
        <td bgcolor="${JOKO_EMAIL_THEME.ochre}" style="border-radius:7px;text-align:center;">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 24px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;line-height:1.2;">${escapeHtml(label)}</a>
        </td>
      </tr>
    </table>`;
}

export function renderSecondaryLink(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="color:${JOKO_EMAIL_THEME.ochre};font-weight:700;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px;">${escapeHtml(label)}</a>`;
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
  logoUrl?: string;
  logoAlt?: string;
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
    logoUrl = DEFAULT_JOKO_EMAIL_LOGO_URL,
    logoAlt = "JOKO TODAY",
  } = options;
  const theme = JOKO_EMAIL_THEME;
  const fontFamily = emailFontFamily(language);
  const displayFontFamily = emailDisplayFontFamily(language);

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
      <td align="center" style="padding:28px 16px;">
        <table width="100%" role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${maxWidth}px;background:${theme.surface};border:1px solid ${theme.border};border-radius:14px;overflow:hidden;">
          <tr>
            <td bgcolor="${theme.sage}" style="background:${theme.sage};padding:24px 30px 14px;text-align:center;">
              <img src="${escapeHtml(logoUrl)}" width="150" alt="${escapeHtml(logoAlt)}" style="display:block;width:150px;max-width:58%;height:auto;margin:0 auto;border:0;outline:none;text-decoration:none;" />
              <div style="margin-top:4px;font-size:12px;line-height:1.4;font-weight:700;letter-spacing:1.2px;color:${theme.ochre};font-family:${displayFontFamily};">${escapeHtml(eyebrow)}</div>
            </td>
          </tr>
          <tr>
            <td bgcolor="${theme.sage}" style="background:${theme.sage};padding:0;line-height:0;font-size:0;">
              <div style="height:30px;background:${theme.surface};border-radius:50% 50% 0 0 / 100% 100% 0 0;line-height:30px;font-size:0;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 34px 32px;">
              <h1 style="margin:0 0 24px;font-size:27px;line-height:1.28;font-weight:600;letter-spacing:0.1px;color:${theme.charcoal};font-family:${displayFontFamily};">${escapeHtml(heading)}</h1>
              ${contentHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;text-align:center;background:${theme.paper};border-top:1px solid ${theme.border};">
              <div style="font-size:12px;line-height:1.6;color:${theme.subtle};">${escapeHtml(footerText)}</div>
              <div style="margin-top:3px;font-size:12px;line-height:1.6;color:${theme.ochre};">joko.today</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
