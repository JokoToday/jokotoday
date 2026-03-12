import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { CMSProduct } from '../lib/cmsService';

interface RecommendedProduct extends CMSProduct {
  co_like_count: number;
}

interface UseProductRecommendationsResult {
  recommendations: RecommendedProduct[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useProductRecommendations(productId: string | null): UseProductRecommendationsResult {
  const [recommendations, setRecommendations] = useState<RecommendedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchRecommendations = useCallback(async () => {
    if (!productId) {
      setRecommendations([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('product_recommendations')
        .select('recommended_product_id, co_like_count')
        .eq('base_product_id', productId)
        .lte('rank', 6);

      if (queryError) throw queryError;

      if (!data || data.length === 0) {
        setRecommendations([]);
        setLoading(false);
        return;
      }

      const productIds = data.map(item => item.recommended_product_id);
      const coLikeCounts = new Map(
        data.map(item => [item.recommended_product_id, item.co_like_count])
      );

      const { data: products, error: productsError } = await supabase
        .from('cms_products')
        .select('*')
        .in('id', productIds)
        .eq('is_active', true);

      if (productsError) throw productsError;

      const recommendedProducts = (products || [])
        .map(product => ({
          ...product,
          co_like_count: coLikeCounts.get(product.id) || 0,
        }))
        .sort((a, b) => b.co_like_count - a.co_like_count);

      setRecommendations(recommendedProducts as RecommendedProduct[]);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch recommendations'));
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  return {
    recommendations,
    loading,
    error,
    refetch: fetchRecommendations,
  };
}
