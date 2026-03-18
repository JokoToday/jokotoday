export interface CustomerRecord {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  line_id: string | null;
  whatsapp: string | null;
  wechat_id: string | null;
  qr_token: string;
  short_code: string;
  loyalty_points: number;
}

// 🔍 Extract token from QR / URL / raw string
function extractToken(raw: string): string {
  try {
    const url = new URL(raw);

    const scanMatch = url.pathname.match(/\/scan\/([A-Za-z0-9]+)/);
    if (scanMatch) return scanMatch[1];

    const cMatch = url.pathname.match(/\/c\/([^/]+)/);
    if (cMatch) return cMatch[1];
  } catch {
    // not a valid URL → fallback below
  }

  if (raw.includes('/scan/')) return raw.split('/scan/')[1].split('/')[0];
  if (raw.includes('/c/')) return raw.split('/c/')[1].split('/')[0];

  return raw.trim();
}

// 🌐 Call Supabase Edge Function
async function fetchCustomerByToken(token: string): Promise<CustomerRecord | null> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;

  if (!baseUrl) {
    throw new Error("Missing VITE_SUPABASE_URL in environment variables");
  }

  const url = `${baseUrl}/functions/v1/customer-lookup`;

  console.log("🔎 Calling customer lookup:", url);
  console.log("🔑 Token:", token);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    // ✅ Not found = valid case
    if (response.status === 404) {
      console.warn("⚠️ Customer not found for token:", token);
      return null;
    }

    // ❌ Other errors
    if (!response.ok) {
      const body = await response.text();
      let message = response.statusText;

      try {
        const json = JSON.parse(body);
        message = json?.message ?? message;
      } catch {}

      console.error("❌ Function error:", body);
      throw new Error(`Customer lookup failed: ${message}`);
    }

    const data = (await response.json()) as CustomerRecord | null;

    console.log("✅ LOOKUP RESPONSE:", data);

    return data;
  } catch (err) {
    console.error("❌ Network / fetch error:", err);
    throw err instanceof Error ? err : new Error("Network error during customer lookup");
  }
}

// 🧠 Main lookup (QR token)
export async function lookupCustomerByQRToken(qrToken: string): Promise<CustomerRecord | null> {
  const token = extractToken(qrToken);

  try {
    return await fetchCustomerByToken(token);
  } catch (error) {
    console.error("lookupCustomerByQRToken error:", error);
    throw error instanceof Error ? error : new Error("Customer lookup failed");
  }
}

// 🔁 Short code = same logic
export async function lookupCustomerByShortCode(shortCode: string): Promise<CustomerRecord | null> {
  return lookupCustomerByQRToken(shortCode);
}