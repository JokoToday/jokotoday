import { supabase } from './supabase';

export type StorePaymentMode = 'kshop_master' | 'stripe_promptpay';
export type StoreOrderItem = { product_id: string; quantity: number };
export type StoreCheckoutResult = {
  order_id: string;
  payment_transaction_id: string;
  order_number?: string;
  amount_due?: number;
  expires_at?: string;
  state?: string;
  idempotent_replay: boolean;
};

/**
 * The RPC is authoritative: it validates customer, price, publication,
 * fulfillment and stock and creates the whole checkout in one transaction.
 * The caller only supplies SKU + quantity and the selected supported rail.
 * Server policy remains hard-disabled until acceptance tests and approval.
 */
export async function createStoreCustomerOrder(
  requestKey: string,
  items: StoreOrderItem[],
  paymentMode: StorePaymentMode,
): Promise<StoreCheckoutResult> {
  const { data, error } = await supabase.rpc('create_store_customer_order_v1', {
    p_request_key: requestKey,
    p_lines: items,
    p_payment_mode: paymentMode,
  });
  if (error) throw error;
  if (!data || typeof data !== 'object') throw new Error('Store order creation returned no result.');
  return data as StoreCheckoutResult;
}
