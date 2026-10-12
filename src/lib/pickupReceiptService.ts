import { supabase } from './supabase';

export type PickupReceiptLanguage = 'en' | 'th' | 'zh';

export type PickupReceiptItem = {
  product_id?: string;
  product_name?: string;
  product_name_th?: string | null;
  product_name_zh?: string | null;
  maker_name_en?: string | null;
  maker_name_th?: string | null;
  maker_name_zh?: string | null;
  quantity: number;
  price_at_order: number;
};

export type PickupReceiptHandoff = {
  state: 'active' | 'confirmed' | 'expired';
  orderNumber: string;
  items: PickupReceiptItem[];
  totalPaid: number;
  pickedUpAt: string | null;
  customerReceivedAt: string | null;
  receiptNumber?: string | null;
  preferredLanguage?: PickupReceiptLanguage | null;
};

export type CreatedPickupHandoff = {
  state: 'active' | 'completed';
  handoffToken?: string;
  orderNumber: string;
  expiresAt?: string;
  receiptNumber?: string | null;
};

export type ConfirmedPickupReceipt = {
  state: 'confirmed';
  orderNumber: string;
  receiptNumber: string;
  issuedAt: string;
  customerReceivedAt: string;
  delivery: {
    email: 'sent' | 'failed' | 'unavailable' | 'not_applicable';
    line: 'sent' | 'failed' | 'unavailable' | 'not_applicable';
  };
};

function edgeError(error: unknown, fallback: string): Error {
  if (!error || typeof error !== 'object') return new Error(fallback);
  const candidate = error as { message?: unknown };
  return new Error(typeof candidate.message === 'string' && candidate.message ? candidate.message : fallback);
}

export async function createPickupReceiptHandoff(orderId: string): Promise<CreatedPickupHandoff> {
  const { data, error } = await supabase.functions.invoke('create-pickup-handoff', {
    body: { orderId },
  });
  if (error) throw edgeError(error, 'Could not create customer receipt confirmation.');
  if (!data || typeof data !== 'object') throw new Error('Invalid pickup confirmation response.');
  return data as CreatedPickupHandoff;
}

export async function getPickupReceiptHandoffStatus(token: string): Promise<PickupReceiptHandoff> {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pickup-handoff-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ token }),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : 'Could not open pickup confirmation.');
  }
  return payload as unknown as PickupReceiptHandoff;
}

export async function confirmPickupReceipt(token: string): Promise<ConfirmedPickupReceipt> {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/confirm-pickup-receipt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ token }),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : 'Could not confirm product receipt.');
  }
  return payload as unknown as ConfirmedPickupReceipt;
}
