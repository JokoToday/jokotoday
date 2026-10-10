import { supabase } from './supabase';

export type PickupHandoverState = 'active' | 'completed' | 'expired' | 'cancelled' | 'bypassed';

export type PickupHandoverOrderItem = {
  product_id?: string;
  product_name?: string;
  product_name_en?: string;
  product_name_th?: string | null;
  product_name_zh?: string | null;
  name?: string;
  name_th?: string | null;
  name_zh?: string | null;
  quantity?: number;
  qty?: number;
  price_at_order?: number;
  price?: number;
};

export type PickupHandoverStatus = {
  state: PickupHandoverState;
  handoffId?: string;
  expiresAt?: string;
  customerConfirmedAt?: string | null;
  completedAt?: string | null;
  bypassed?: boolean;
  order?: {
    orderNumber: string;
    items: PickupHandoverOrderItem[];
    totalAmount: number;
    loyaltyDiscountAmount: number;
    amountPaid: number;
    paymentStatus: string;
    paymentMethod: string | null;
    status: string;
    pickupDate: string | null;
    pickupLocation: string | null;
  };
};

export type PickupHandover = {
  state: 'active' | 'completed';
  handoffId?: string;
  token?: string;
  orderNumber?: string;
  expiresAt?: string;
  confirmUrl?: string;
};

function functionUrl(name: string): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload?.error === 'string'
        ? payload.error
        : `Request failed with status ${response.status}`
    );
  }
  return payload as T;
}

export async function createPickupHandover(orderId: string): Promise<PickupHandover> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Staff session is required.');

  const response = await fetch(functionUrl('create-pickup-handover'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ orderId }),
  });
  return parseResponse<PickupHandover>(response);
}

export async function getPickupHandoverStatus(token: string): Promise<PickupHandoverStatus> {
  const response = await fetch(functionUrl('pickup-handover-status'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return parseResponse<PickupHandoverStatus>(response);
}

export async function confirmPickupReceipt(token: string): Promise<{ state: 'completed' }> {
  const response = await fetch(functionUrl('confirm-pickup-receipt'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return parseResponse<{ state: 'completed' }>(response);
}

export async function bypassPickupReceipt(
  handoffId: string,
  reason: string,
): Promise<{ state: 'completed'; bypassed: boolean }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Staff session is required.');

  const response = await fetch(functionUrl('bypass-pickup-receipt'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ handoffId, reason }),
  });
  return parseResponse<{ state: 'completed'; bypassed: boolean }>(response);
}
