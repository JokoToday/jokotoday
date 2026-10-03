import { supabase } from './supabase';
import type { CMSProduct } from './cmsService';

export async function getProductStaffProducts(): Promise<CMSProduct[]> {
  const { data, error } = await supabase.rpc('product_staff_list_products_v1');
  if (error) throw error;
  return (data || []) as CMSProduct[];
}
