import { supabase } from './supabase';

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

export async function cancelOnlineOrderCompatible<T extends CancellableOnlineOrder>(
  order: T,
): Promise<T & { status?: string }> {
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
