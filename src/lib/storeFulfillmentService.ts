import { supabase } from './supabase';

/** Store physical stock is separate from Bakery's date-by-date capacity. */
export interface StoreFulfillmentSettings {
  product_id: string;
  stock_on_hand: number;
  stock_reserved: number;
  pickup_today: boolean;
  pickup_preorder: boolean;
  delivery_today: boolean;
  delivery_preorder: boolean;
  delivery_provider: 'manual' | 'grab_express';
  delivery_fee_thb: number | null;
  ordering_enabled: false;
}

export const DEFAULT_STORE_FULFILLMENT = {
  stock_on_hand: 0,
  stock_reserved: 0,
  pickup_today: false,
  pickup_preorder: false,
  delivery_today: false,
  delivery_preorder: false,
  delivery_provider: 'manual' as const,
  delivery_fee_thb: null,
  ordering_enabled: false as const,
};

export async function getStoreFulfillmentSettings(productId: string): Promise<StoreFulfillmentSettings | null> {
  const { data, error } = await supabase.from('store_fulfillment_settings')
    .select('product_id,stock_on_hand,stock_reserved,pickup_today,pickup_preorder,delivery_today,delivery_preorder,delivery_provider,delivery_fee_thb,ordering_enabled')
    .eq('product_id', productId).maybeSingle();
  if (error) throw error;
  return data as StoreFulfillmentSettings | null;
}

/** Configuration only; never enables ordering or initiates payment. */
export async function saveStoreFulfillmentSettings(
  productId: string, settings: Pick<StoreFulfillmentSettings, 'stock_on_hand' | 'pickup_today' | 'pickup_preorder' | 'delivery_today' | 'delivery_preorder' | 'delivery_provider' | 'delivery_fee_thb'>,
): Promise<void> {
  const { error } = await supabase.from('store_fulfillment_settings').upsert({
    product_id: productId, ...settings, ordering_enabled: false,
  }, { onConflict: 'product_id' });
  if (error) throw error;
}
