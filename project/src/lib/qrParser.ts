// project/src/lib/qrParser.ts

export type ParsedQR =
  | { kind: "short_code"; short_code: string }
  | { kind: "qr_token"; qr_token: string }
  | { kind: "url"; url: string }
  | { kind: "unknown"; raw: string };

export function parseQRPayload(input: string): ParsedQR {
  const raw = (input || "").trim();

  if (!raw) return { kind: "unknown", raw };

  // Short code: e.g. ABC123
  if (/^[A-Z0-9]{4,10}$/i.test(raw)) {
    return { kind: "short_code", short_code: raw.toUpperCase() };
  }

  // Token style
  if (/^[a-f0-9-]{16,}$/i.test(raw)) {
    return { kind: "qr_token", qr_token: raw };
  }

  // URL
  try {
    const u = new URL(raw);
    return { kind: "url", url: u.toString() };
  } catch {
    // not a URL
  }

  return { kind: "unknown", raw };
}
