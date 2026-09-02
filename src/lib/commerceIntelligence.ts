import { CMSProduct, getSetting } from './cmsService';
import { supabase } from './supabase';

export const FITS_YOUR_PICKUP_CONFIG_KEY = 'fits_your_pickup_config_v1';

export type RecommendationSignal =
  | 'seasonal_priority'
  | 'complementary_category'
  | 'popularity'
  | 'catalogue_order';

export type RecommendationPlacement = 'cart' | 'checkout';

export interface SeasonalProductBoost {
  productId: string;
  priority: number;
  startsOn?: string | null;
  endsOn?: string | null;
}

export interface ComplementaryCategoryRule {
  sourceCategoryId: string;
  targetCategoryId: string;
  priority: number;
}

export interface RecommendationPlacementConfig {
  enabled: boolean;
  maxSuggestions: number;
}

export interface FitsYourPickupConfig {
  version: 2;
  /** Legacy compatibility fallback for configurations saved before placements existed. */
  maxSuggestions: number;
  placements: Record<RecommendationPlacement, RecommendationPlacementConfig>;
  rankingOrder: RecommendationSignal[];
  seasonalBoosts: SeasonalProductBoost[];
  complementaryCategoryRules: ComplementaryCategoryRule[];
}

export const DEFAULT_FITS_YOUR_PICKUP_CONFIG: FitsYourPickupConfig = {
  version: 2,
  maxSuggestions: 3,
  placements: {
    cart: { enabled: true, maxSuggestions: 3 },
    checkout: { enabled: true, maxSuggestions: 3 },
  },
  rankingOrder: [
    'seasonal_priority',
    'complementary_category',
    'popularity',
    'catalogue_order',
  ],
  seasonalBoosts: [],
  complementaryCategoryRules: [],
};

const VALID_SIGNALS = new Set<RecommendationSignal>([
  'seasonal_priority',
  'complementary_category',
  'popularity',
  'catalogue_order',
]);

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function parsePlacement(
  value: unknown,
  fallback: RecommendationPlacementConfig,
  legacyMax: number,
): RecommendationPlacementConfig {
  if (!value || typeof value !== 'object') {
    return { ...fallback, maxSuggestions: legacyMax };
  }
  const candidate = value as Partial<RecommendationPlacementConfig>;
  return {
    enabled: typeof candidate.enabled === 'boolean' ? candidate.enabled : fallback.enabled,
    maxSuggestions: clampInteger(candidate.maxSuggestions, legacyMax, 1, 12),
  };
}

export function parseFitsYourPickupConfig(value: string | null | undefined): FitsYourPickupConfig {
  if (!value) return DEFAULT_FITS_YOUR_PICKUP_CONFIG;

  try {
    const parsed = JSON.parse(value) as Partial<FitsYourPickupConfig> & {
      placements?: Partial<Record<RecommendationPlacement, RecommendationPlacementConfig>>;
    };
    const legacyMax = clampInteger(
      parsed.maxSuggestions,
      DEFAULT_FITS_YOUR_PICKUP_CONFIG.maxSuggestions,
      1,
      12,
    );
    const rankingOrder = Array.isArray(parsed.rankingOrder)
      ? parsed.rankingOrder.filter((signal): signal is RecommendationSignal => VALID_SIGNALS.has(signal as RecommendationSignal))
      : [];
    const dedupedRanking = Array.from(new Set(rankingOrder));
    if (!dedupedRanking.includes('catalogue_order')) dedupedRanking.push('catalogue_order');

    const seasonalBoosts = Array.isArray(parsed.seasonalBoosts)
      ? parsed.seasonalBoosts.flatMap((boost) => {
          if (!boost || typeof boost !== 'object') return [];
          const candidate = boost as Partial<SeasonalProductBoost>;
          if (typeof candidate.productId !== 'string' || !candidate.productId) return [];
          return [{
            productId: candidate.productId,
            priority: clampInteger(candidate.priority, 0, 0, 1000),
            startsOn: typeof candidate.startsOn === 'string' && candidate.startsOn ? candidate.startsOn : null,
            endsOn: typeof candidate.endsOn === 'string' && candidate.endsOn ? candidate.endsOn : null,
          }];
        })
      : [];

    const complementaryCategoryRules = Array.isArray(parsed.complementaryCategoryRules)
      ? parsed.complementaryCategoryRules.flatMap((rule) => {
          if (!rule || typeof rule !== 'object') return [];
          const candidate = rule as Partial<ComplementaryCategoryRule>;
          if (
            typeof candidate.sourceCategoryId !== 'string'
            || !candidate.sourceCategoryId
            || typeof candidate.targetCategoryId !== 'string'
            || !candidate.targetCategoryId
          ) return [];
          return [{
            sourceCategoryId: candidate.sourceCategoryId,
            targetCategoryId: candidate.targetCategoryId,
            priority: clampInteger(candidate.priority, 0, 0, 1000),
          }];
        })
      : [];

    return {
      version: 2,
      maxSuggestions: legacyMax,
      placements: {
        cart: parsePlacement(parsed.placements?.cart, DEFAULT_FITS_YOUR_PICKUP_CONFIG.placements.cart, legacyMax),
        checkout: parsePlacement(parsed.placements?.checkout, DEFAULT_FITS_YOUR_PICKUP_CONFIG.placements.checkout, legacyMax),
      },
      rankingOrder: dedupedRanking.length > 0 ? dedupedRanking : DEFAULT_FITS_YOUR_PICKUP_CONFIG.rankingOrder,
      seasonalBoosts,
      complementaryCategoryRules,
    };
  } catch {
    return DEFAULT_FITS_YOUR_PICKUP_CONFIG;
  }
}

export async function getFitsYourPickupConfig(): Promise<FitsYourPickupConfig> {
  try {
    const setting = await getSetting(FITS_YOUR_PICKUP_CONFIG_KEY);
    return parseFitsYourPickupConfig(setting?.value);
  } catch (error) {
    console.error('Could not load Fits your pickup configuration:', error);
    return DEFAULT_FITS_YOUR_PICKUP_CONFIG;
  }
}

export async function saveFitsYourPickupConfig(config: FitsYourPickupConfig): Promise<void> {
  const normalized = parseFitsYourPickupConfig(JSON.stringify(config));
  const { error } = await supabase
    .from('cms_settings')
    .upsert(
      {
        setting_key: FITS_YOUR_PICKUP_CONFIG_KEY,
        value: JSON.stringify(normalized),
      },
      { onConflict: 'setting_key' },
    );

  if (error) throw error;
}

export function getRecommendationPlacementConfig(
  config: FitsYourPickupConfig,
  placement: RecommendationPlacement,
): RecommendationPlacementConfig {
  return config.placements[placement] || {
    enabled: true,
    maxSuggestions: config.maxSuggestions,
  };
}

function isDateWithinBoost(boost: SeasonalProductBoost, now: Date): boolean {
  const today = now.toISOString().slice(0, 10);
  if (boost.startsOn && today < boost.startsOn) return false;
  if (boost.endsOn && today > boost.endsOn) return false;
  return true;
}

function seasonalPriority(productId: string, config: FitsYourPickupConfig, now: Date): number {
  return config.seasonalBoosts.reduce((maximum, boost) => {
    if (boost.productId !== productId || !isDateWithinBoost(boost, now)) return maximum;
    return Math.max(maximum, boost.priority);
  }, 0);
}

function complementaryPriority(
  product: CMSProduct,
  cartCategoryIds: Set<string>,
  config: FitsYourPickupConfig,
): number {
  return config.complementaryCategoryRules.reduce((maximum, rule) => {
    if (!cartCategoryIds.has(rule.sourceCategoryId) || product.category_id !== rule.targetCategoryId) {
      return maximum;
    }
    return Math.max(maximum, rule.priority);
  }, 0);
}

export function rankFitsYourPickupProducts(
  products: CMSProduct[],
  cartCategoryIds: Set<string>,
  likeCounts: Map<string, number>,
  config: FitsYourPickupConfig,
  now = new Date(),
): CMSProduct[] {
  const signalValue = (product: CMSProduct, signal: RecommendationSignal): number => {
    switch (signal) {
      case 'seasonal_priority':
        return seasonalPriority(product.id, config, now);
      case 'complementary_category':
        return complementaryPriority(product, cartCategoryIds, config);
      case 'popularity':
        return likeCounts.get(product.id) || 0;
      case 'catalogue_order':
        return -Number(product.sort_order || 0);
      default:
        return 0;
    }
  };

  return [...products].sort((a, b) => {
    for (const signal of config.rankingOrder) {
      const difference = signalValue(b, signal) - signalValue(a, signal);
      if (difference !== 0) return difference;
    }
    return a.name_en.localeCompare(b.name_en);
  });
}
