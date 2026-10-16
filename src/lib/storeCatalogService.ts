import { supabase } from './supabase';
export type StoreCategory = { id: string; slug: string; name_en: string; name_th: string; name_zh: string | null; is_active: boolean; sort_order: number };
export type StoreAssignment = { product_id: string; store_category_id: string | null; is_published: boolean };
export async function getPublicStoreCatalog(): Promise<{categories: StoreCategory[]; assignments: StoreAssignment[]}> {
  const [categories, assignments] = await Promise.all([
    supabase.from('store_categories').select('id,slug,name_en,name_th,name_zh,is_active,sort_order').eq('is_active', true).order('sort_order'),
    supabase.from('store_product_assignments').select('product_id,store_category_id,is_published').eq('is_published', true)
  ]);
  if (categories.error) throw categories.error;
  if (assignments.error) throw assignments.error;
  return { categories: categories.data || [], assignments: assignments.data || [] };
}
export async function getAdminStoreAssignment(productId: string): Promise<StoreAssignment | null> {
  const { data, error } = await supabase.from('store_product_assignments').select('product_id,store_category_id,is_published').eq('product_id', productId).maybeSingle();
  if (error) throw error;
  return data;
}
export async function saveAdminStoreAssignment(productId: string, categoryId: string | null, published: boolean): Promise<void> {
  const { error } = await supabase.from('store_product_assignments').upsert({ product_id: productId, store_category_id: categoryId, is_published: published }, { onConflict: 'product_id' });
  if (error) throw error;
}
