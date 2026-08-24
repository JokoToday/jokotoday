import { supabase } from './supabase';

export interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  line_id: string | null;
  whatsapp: string | null;
  wechat_id: string | null;
  qr_token: string;
  short_code: string;
  loyalty_points: number;
}

type RawCustomerRecord = Omit<CustomerRecord, 'name' | 'email' | 'phone'> & {
  name: string | null;
  email: string | null;
  phone: string | null;
};

export class InvalidCustomerCodeError extends Error {
  constructor() {
    super('Invalid member code or unsupported QR code.');
    this.name = 'InvalidCustomerCodeError';
  }
}

export class CustomerLookupNetworkError extends Error {
  constructor() {
    super('Unable to reach customer lookup. Check your connection and try again.');
    this.name = 'CustomerLookupNetworkError';
  }
}

export class CustomerLookupServiceError extends Error {
  constructor(status: number) {
    super(`Customer lookup service failed (${status}). Please try again.`);
    this.name = 'CustomerLookupServiceError';
  }
}

const MEMBER_CODE_PATTERN = /^VIP\d+$/i;
const QR_TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,}$/;
const SUPPORTED_PATH_PATTERN = /\/(?:q|c|scan)\/([^/?#]+)\/?$/i;

function safelyDecode(value: string): string {
  let decoded = value;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      throw new InvalidCustomerCodeError();
    }
  }
  return decoded.trim();
}

function extractFromUrl(url: URL): string {
  const pathMatch = url.pathname.match(SUPPORTED_PATH_PATTERN);
  if (pathMatch) return safelyDecode(pathMatch[1]);

  for (const key of ['code', 'token']) {
    const queryValue = url.searchParams.get(key);
    if (queryValue) return safelyDecode(queryValue);
  }

  throw new InvalidCustomerCodeError();
}

export function extractCustomerLookupToken(raw: string): string {
  const value = raw.trim();
  if (!value) throw new InvalidCustomerCodeError();

  let token: string;

  if (/^https?:\/\//i.test(value) || value.startsWith('/') || value.startsWith('?')) {
    try {
      token = extractFromUrl(new URL(value, 'https://qr.local'));
    } catch (error) {
      if (error instanceof InvalidCustomerCodeError) throw error;
      throw new InvalidCustomerCodeError();
    }
  } else {
    const relativePathMatch = value.match(SUPPORTED_PATH_PATTERN);
    token = relativePathMatch ? safelyDecode(relativePathMatch[1]) : safelyDecode(value);
  }

  if (!MEMBER_CODE_PATTERN.test(token) && !QR_TOKEN_PATTERN.test(token)) {
    throw new InvalidCustomerCodeError();
  }

  return MEMBER_CODE_PATTERN.test(token) ? token.toUpperCase() : token;
}

function normalizeCustomer(record: RawCustomerRecord): CustomerRecord {
  return {
    ...record,
    name: record.name?.trim() || 'Customer',
    email: record.email?.trim() || '',
    phone: record.phone?.trim() || '',
    loyalty_points: Number(record.loyalty_points) || 0,
  };
}

async function fetchCustomerByToken(token: string): Promise<CustomerRecord | null> {
  try {
    const { data, error } = await supabase.functions.invoke<RawCustomerRecord | null>('customer-lookup', {
      method: 'POST',
      body: { token },
    });

    if (error) {
      const context = 'context' in error
        ? error.context as { status?: unknown } | undefined
        : undefined;
      const status = typeof context?.status === 'number' ? context.status : undefined;
      if (status === undefined) throw new CustomerLookupNetworkError();
      throw new CustomerLookupServiceError(status);
    }

    return data ? normalizeCustomer(data) : null;
  } catch (err) {
    if (err instanceof CustomerLookupNetworkError || err instanceof CustomerLookupServiceError) {
      throw err;
    }
    throw new CustomerLookupNetworkError();
  }
}

export async function lookupCustomerByQRToken(qrToken: string): Promise<CustomerRecord | null> {
  return fetchCustomerByToken(extractCustomerLookupToken(qrToken));
}

export async function lookupCustomerByShortCode(shortCode: string): Promise<CustomerRecord | null> {
  return lookupCustomerByQRToken(shortCode);
}
