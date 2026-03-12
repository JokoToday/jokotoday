import { supabase } from './supabase';

export interface ProductLike {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
}

export interface ProductLikeCount {
  product_id: string;
  like_count: number;
}

export async function fetchAllLikeCounts(): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('product_like_counts')
    .select('product_id, like_count');

  if (error) {
    console.error('Error fetching like counts:', error);
    return new Map();
  }

  const countMap = new Map<string, number>();
  data?.forEach((item) => {
    countMap.set(item.product_id, item.like_count);
  });

  return countMap;
}

export async function fetchUserLikes(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('product_likes')
    .select('product_id')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user likes:', error);
    return new Set();
  }

  return new Set(data?.map((item) => item.product_id) || []);
}

export async function likeProduct(userId: string, productId: string): Promise<boolean> {
  const { error } = await supabase
    .from('product_likes')
    .insert({ user_id: userId, product_id: productId });

  if (error) {
    if (error.code === '23505') {
      return true;
    }
    console.error('Error liking product:', error);
    return false;
  }

  return true;
}

export async function unlikeProduct(userId: string, productId: string): Promise<boolean> {
  const { error } = await supabase
    .from('product_likes')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId);

  if (error) {
    console.error('Error unliking product:', error);
    return false;
  }

  return true;
}

export async function toggleLike(
  userId: string,
  productId: string,
  currentlyLiked: boolean
): Promise<{ success: boolean; isLiked: boolean }> {
  if (currentlyLiked) {
    const success = await unlikeProduct(userId, productId);
    return { success, isLiked: success ? false : true };
  } else {
    const success = await likeProduct(userId, productId);
    return { success, isLiked: success ? true : false };
  }
}

export async function fetchLikedProducts(userId: string) {
  const { data, error } = await supabase
    .from('product_likes')
    .select(`
      product_id,
      created_at,
      cms_products (
        id,
        slug,
        name_en,
        name_th,
        name_zh,
        desc_en,
        desc_th,
        desc_zh,
        price,
        image,
        is_sold_out,
        is_active,
        stock_remaining,
        available_days,
        stock_by_day,
        category_id
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching liked products:', error);
    return [];
  }

  return data?.map((item) => item.cms_products).filter(Boolean) || [];
}

export function subscribeToLikes(
  callback: (payload: { eventType: string; new?: ProductLike; old?: ProductLike }) => void
) {
  return supabase
    .channel('product_likes_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'product_likes' },
      (payload) => {
        callback({
          eventType: payload.eventType,
          new: payload.new as ProductLike | undefined,
          old: payload.old as ProductLike | undefined,
        });
      }
    )
    .subscribe();
}
