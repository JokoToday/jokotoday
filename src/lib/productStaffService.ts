import { supabase } from './supabase';
import type { CMSProduct } from './cmsService';

async function callProductStaffApi<T>(
  method: 'GET' | 'PATCH',
  body?: Record<string, unknown>,
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Your Product Staff session has expired. Please sign in again.');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('JOKO Product Staff is not configured for this environment.');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/product-staff-products`, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => null) as
    | ({ error?: string } & T)
    | null;

  if (!response.ok) {
    throw new Error(payload?.error || 'Product Staff request failed.');
  }
  if (!payload) {
    throw new Error('Product Staff service returned an invalid response.');
  }

  return payload;
}

export async function getProductStaffProducts(): Promise<CMSProduct[]> {
  const payload = await callProductStaffApi<{ products: CMSProduct[] }>('GET');
  return payload.products || [];
}

export async function updateProductStaffProduct(
  productId: string,
  patch: Record<string, unknown>,
): Promise<CMSProduct> {
  const payload = await callProductStaffApi<{ product: CMSProduct }>('PATCH', {
    productId,
    patch,
  });
  return payload.product;
}
