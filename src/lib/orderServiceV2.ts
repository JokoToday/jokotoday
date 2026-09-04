import { supabase } from './supabase';

type SupportedLanguage = 'en' | 'th' | 'zh';

function getActiveLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return 'en';
  const value = window.localStorage.getItem('jt_language');
  return value === 'th' || value === 'zh' ? value : 'en';
}

async function syncPreferredLanguageForCurrentUser(): Promise<void> {
  const language = getActiveLanguage();
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return;

  const { error } = await supabase
    .from('user_profiles')
    .update({
      preferred_language: language,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('Preferred language could not be synced:', error);
  }
}

async function syncPreferredLanguageBestEffort(): Promise<void> {
  try {
    await syncPreferredLanguageForCurrentUser();
  } catch (error) {
    console.error('Preferred language sync failed:', error);
  }
}

export interface CreateOnlineOrderV2Item {
  product_id: string;
  quantity: number;
}

export interface CreateOnlineOrderV2Input {
  orderNumber: string;
  pickupDateId: string;
  pickupLocationId: string;
  items: CreateOnlineOrderV2Item[];
  notes?: string | null;
}

export interface OnlineOrderRpcResult {
  id: string;
  order_number: string;
  customer_id?: string | null;
  order_items?: unknown;
  total_amount?: number | string;
  pickup_day?: string | null;
  pickup_date?: string | null;
  pickup_date_id?: string | null;
  pickup_location_id?: string | null;
  status?: string;
  payment_status?: string;
  created_at?: string;
  loyalty_points_earned?: number | null;
}

export interface CancellableOnlineOrder {
  id: string;
  pickup_date_id?: string | null;
}

export async function createOnlineOrderV2(
  input: CreateOnlineOrderV2Input,
): Promise<OnlineOrderRpcResult> {
  // The durable notification event records preferred_language inside the order
  // transaction. Keep that server-side preference aligned with the language the
  // customer is actually using without ever blocking checkout on preference sync.
  await syncPreferredLanguageBestEffort();

  const { data, error } = await supabase.rpc('create_online_order_v2', {
    p_order_number: input.orderNumber,
    p_pickup_date_id: input.pickupDateId,
    p_pickup_location_id: input.pickupLocationId,
    p_items: input.items,
    p_notes: input.notes?.trim() || null,
  });

  if (error) throw new Error(error.message);

  const order = data as OnlineOrderRpcResult | null;
  if (!order?.id || !order.order_number) {
    throw new Error('Pickup v2 order creation returned an invalid order result.');
  }

  return order;
}

export async function requestOrderCancellationEmail(orderId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('send-order-cancellation', {
    body: { order_id: orderId },
  });

  if (error) throw error;
}

export async function cancelOnlineOrderCompatible<T extends CancellableOnlineOrder>(
  order: T,
): Promise<T & { status?: string }> {
  // Cancellation also creates its durable email event inside the transaction,
  // so sync the customer's active language immediately before the RPC.
  await syncPreferredLanguageBestEffort();

  const rpcName = order.pickup_date_id
    ? 'cancel_online_order_v2'
    : 'cancel_online_order';

  const { data, error } = await supabase.rpc(rpcName, {
    p_order_id: order.id,
  });

  if (error) throw new Error(error.message);

  const cancelledOrder = data as (T & { status?: string }) | null;
  if (!cancelledOrder?.id || cancelledOrder.status !== 'cancelled') {
    throw new Error('Cancellation returned an invalid order result.');
  }

  // Cancellation is authoritative and must not be rolled back in the UI just
  // because notification delivery is temporarily unavailable. The durable
  // outbox event can be retried independently.
  void requestOrderCancellationEmail(cancelledOrder.id).catch((notificationError) => {
    console.error('Cancellation email could not be requested:', notificationError);
  });

  return cancelledOrder;
}

export async function cancelOnlineOrderByVersion(
  orderId: string,
  pickupDateId?: string | null,
): Promise<{ id: string; status: string }> {
  const cancelledOrder = await cancelOnlineOrderCompatible({
    id: orderId,
    pickup_date_id: pickupDateId,
  });

  return {
    id: cancelledOrder.id,
    status: cancelledOrder.status || 'cancelled',
  };
}
