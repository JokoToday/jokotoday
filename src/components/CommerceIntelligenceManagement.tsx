import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, RefreshCw, Save, Sparkles, Trash2 } from 'lucide-react';
import { getCategories, getProducts, CMSCategory, CMSProduct } from '../lib/cmsService';
import {
  ComplementaryCategoryRule,
  FitsYourPickupConfig,
  getFitsYourPickupConfig,
  RecommendationPlacement,
  RecommendationSignal,
  saveFitsYourPickupConfig,
  SeasonalProductBoost,
} from '../lib/commerceIntelligence';

const SIGNAL_LABELS: Record<RecommendationSignal, { title: string; helper: string }> = {
  seasonal_priority: {
    title: 'Seasonal priority',
    helper: 'Boost products selected below while their optional date window is active.',
  },
  complementary_category: {
    title: 'Complementary category',
    helper: 'Prefer target categories when the basket already contains a configured source category.',
  },
  popularity: {
    title: 'Popularity / likes',
    helper: 'Use real product like counts as a ranking signal.',
  },
  catalogue_order: {
    title: 'Catalogue order',
    helper: 'Deterministic fallback based on the existing Admin product sort order.',
  },
};

const PLACEMENT_LABELS: Record<RecommendationPlacement, { title: string; helper: string }> = {
  cart: {
    title: 'Cart recommendations',
    helper: 'Shown inside Pickup tools after the customer has selected a compatible pickup date.',
  },
  checkout: {
    title: 'Checkout last-minute recommendations',
    helper: 'Shown after pickup is confirmed and immediately before the customer places the order.',
  },
};

function productName(product: CMSProduct): string {
  return product.name_en;
}

function categoryName(category: CMSCategory): string {
  return category.title_en;
}

export function CommerceIntelligenceManagement() {
  const [config, setConfig] = useState<FitsYourPickupConfig | null>(null);
  const [products, setProducts] = useState<CMSProduct[]>([]);
  const [categories, setCategories] = useState<CMSCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [seasonalProductId, setSeasonalProductId] = useState('');
  const [seasonalPriority, setSeasonalPriority] = useState(100);
  const [seasonalStartsOn, setSeasonalStartsOn] = useState('');
  const [seasonalEndsOn, setSeasonalEndsOn] = useState('');

  const [sourceCategoryId, setSourceCategoryId] = useState('');
  const [targetCategoryId, setTargetCategoryId] = useState('');
  const [categoryPriority, setCategoryPriority] = useState(100);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [nextConfig, nextProducts, nextCategories] = await Promise.all([
        getFitsYourPickupConfig(),
        getProducts(),
        getCategories(),
      ]);
      setConfig(nextConfig);
      setProducts(nextProducts);
      setCategories(nextCategories);
      if (!seasonalProductId && nextProducts[0]) setSeasonalProductId(nextProducts[0].id);
      if (!sourceCategoryId && nextCategories[0]) setSourceCategoryId(nextCategories[0].id);
      if (!targetCategoryId && nextCategories[1]) setTargetCategoryId(nextCategories[1].id);
      else if (!targetCategoryId && nextCategories[0]) setTargetCategoryId(nextCategories[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Commerce Intelligence configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  const updatePlacement = (
    placement: RecommendationPlacement,
    patch: Partial<FitsYourPickupConfig['placements'][RecommendationPlacement]>,
  ) => {
    setConfig((current) => {
      if (!current) return current;
      const nextPlacement = { ...current.placements[placement], ...patch };
      return {
        ...current,
        maxSuggestions: placement === 'cart' ? nextPlacement.maxSuggestions : current.maxSuggestions,
        placements: {
          ...current.placements,
          [placement]: nextPlacement,
        },
      };
    });
  };

  const moveSignal = (signal: RecommendationSignal, direction: -1 | 1) => {
    setConfig((current) => {
      if (!current) return current;
      const index = current.rankingOrder.indexOf(signal);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.rankingOrder.length) return current;
      const rankingOrder = [...current.rankingOrder];
      [rankingOrder[index], rankingOrder[target]] = [rankingOrder[target], rankingOrder[index]];
      return { ...current, rankingOrder };
    });
  };

  const toggleSignal = (signal: RecommendationSignal) => {
    if (signal === 'catalogue_order') return;
    setConfig((current) => {
      if (!current) return current;
      const enabled = current.rankingOrder.includes(signal);
      const rankingOrder: RecommendationSignal[] = enabled
        ? current.rankingOrder.filter((candidate) => candidate !== signal)
        : [...current.rankingOrder.filter((candidate) => candidate !== 'catalogue_order'), signal, 'catalogue_order'];
      return { ...current, rankingOrder };
    });
  };

  const addSeasonalBoost = () => {
    if (!config || !seasonalProductId) return;
    const boost: SeasonalProductBoost = {
      productId: seasonalProductId,
      priority: Math.max(0, Math.round(seasonalPriority || 0)),
      startsOn: seasonalStartsOn || null,
      endsOn: seasonalEndsOn || null,
    };
    setConfig({
      ...config,
      seasonalBoosts: [
        ...config.seasonalBoosts.filter((candidate) => candidate.productId !== seasonalProductId),
        boost,
      ],
    });
  };

  const addCategoryRule = () => {
    if (!config || !sourceCategoryId || !targetCategoryId) return;
    const rule: ComplementaryCategoryRule = {
      sourceCategoryId,
      targetCategoryId,
      priority: Math.max(0, Math.round(categoryPriority || 0)),
    };
    setConfig({
      ...config,
      complementaryCategoryRules: [
        ...config.complementaryCategoryRules.filter((candidate) => !(
          candidate.sourceCategoryId === sourceCategoryId
          && candidate.targetCategoryId === targetCategoryId
        )),
        rule,
      ],
    });
  };

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await saveFitsYourPickupConfig(config);
      setNotice('Commerce Intelligence settings saved. New customer sessions will use the updated recommendation rules.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save Commerce Intelligence settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) {
    return <div className="py-16 text-center text-gray-500">Loading Commerce Intelligence…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-600" />
            Pickup-aware recommendations
          </h2>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl">
            Control where recommendations appear and how eligible products are ranked. Merchandising can rank only products that genuinely fit the customer’s selected pickup.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div>}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <h3 className="font-semibold text-gray-900">Recommendation placements</h3>
        <p className="text-xs text-gray-500 mt-1 mb-4">Each placement can be enabled independently and can show a different maximum number of products.</p>
        <div className="grid md:grid-cols-2 gap-4">
          {(['cart', 'checkout'] as RecommendationPlacement[]).map((placement) => {
            const placementConfig = config.placements[placement];
            return (
              <div key={placement} className={`rounded-xl border p-4 ${placementConfig.enabled ? 'border-amber-200 bg-amber-50/40' : 'border-gray-200 bg-gray-50'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={placementConfig.enabled}
                    onChange={(event) => updatePlacement(placement, { enabled: event.target.checked })}
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-gray-900">{PLACEMENT_LABELS[placement].title}</span>
                    <span className="block text-xs text-gray-500 mt-0.5">{PLACEMENT_LABELS[placement].helper}</span>
                  </span>
                </label>
                <div className="mt-4">
                  <label className="text-xs font-medium text-gray-600">Maximum suggestions</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={placementConfig.maxSuggestions}
                    onChange={(event) => updatePlacement(placement, {
                      maxSuggestions: Math.min(12, Math.max(1, Number(event.target.value) || 1)),
                    })}
                    className="mt-1 block w-28 rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <h3 className="font-semibold text-gray-900">Ranking recipe</h3>
        <p className="text-xs text-gray-500 mt-1 mb-4">Signals are applied in order. Catalogue order always remains as the final deterministic fallback.</p>
        <div className="space-y-2">
          {(Object.keys(SIGNAL_LABELS) as RecommendationSignal[]).map((signal) => {
            const enabled = config.rankingOrder.includes(signal);
            const index = config.rankingOrder.indexOf(signal);
            const fixed = signal === 'catalogue_order';
            return (
              <div key={signal} className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${enabled ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200 bg-gray-50'}`}>
                <input type="checkbox" checked={enabled} disabled={fixed} onChange={() => toggleSignal(signal)} className="h-4 w-4" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{SIGNAL_LABELS[signal].title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{SIGNAL_LABELS[signal].helper}</p>
                </div>
                {enabled && (
                  <div className="flex gap-1">
                    <button type="button" onClick={() => moveSignal(signal, -1)} disabled={index <= 0} className="p-2 rounded-lg border border-gray-200 bg-white disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                    <button type="button" onClick={() => moveSignal(signal, 1)} disabled={index < 0 || index >= config.rankingOrder.length - 1 || fixed} className="p-2 rounded-lg border border-gray-200 bg-white disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <h3 className="font-semibold text-gray-900">Seasonal product priority</h3>
        <p className="text-xs text-gray-500 mt-1 mb-4">Higher numbers rank first when Seasonal priority is enabled. Dates are optional.</p>
        <div className="grid lg:grid-cols-[1.5fr_0.7fr_1fr_1fr_auto] gap-2 items-end">
          <div>
            <label className="text-xs font-medium text-gray-600">Product</label>
            <select value={seasonalProductId} onChange={(event) => setSeasonalProductId(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
              {products.map((product) => <option key={product.id} value={product.id}>{productName(product)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Priority</label>
            <input type="number" min={0} max={1000} value={seasonalPriority} onChange={(event) => setSeasonalPriority(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Starts</label>
            <input type="date" value={seasonalStartsOn} onChange={(event) => setSeasonalStartsOn(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Ends</label>
            <input type="date" value={seasonalEndsOn} onChange={(event) => setSeasonalEndsOn(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </div>
          <button type="button" onClick={addSeasonalBoost} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"><Plus className="w-4 h-4" /> Add</button>
        </div>
        <div className="mt-4 space-y-2">
          {config.seasonalBoosts.map((boost) => (
            <div key={boost.productId} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <span className="font-medium text-gray-900 flex-1">{productById.get(boost.productId)?.name_en || boost.productId}</span>
              <span className="text-gray-500">Priority {boost.priority}</span>
              <span className="text-gray-500">{boost.startsOn || 'Any date'} → {boost.endsOn || 'Any date'}</span>
              <button type="button" onClick={() => setConfig({ ...config, seasonalBoosts: config.seasonalBoosts.filter((candidate) => candidate.productId !== boost.productId) })} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {config.seasonalBoosts.length === 0 && <p className="text-xs text-gray-400">No seasonal boosts configured.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <h3 className="font-semibold text-gray-900">Complementary categories</h3>
        <p className="text-xs text-gray-500 mt-1 mb-4">Example: if the basket contains Bread, prefer Cakes & Cookies as compatible add-ons.</p>
        <div className="grid md:grid-cols-[1fr_1fr_0.6fr_auto] gap-2 items-end">
          <div>
            <label className="text-xs font-medium text-gray-600">Basket contains</label>
            <select value={sourceCategoryId} onChange={(event) => setSourceCategoryId(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
              {categories.map((category) => <option key={category.id} value={category.id}>{categoryName(category)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Prefer category</label>
            <select value={targetCategoryId} onChange={(event) => setTargetCategoryId(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
              {categories.map((category) => <option key={category.id} value={category.id}>{categoryName(category)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Priority</label>
            <input type="number" min={0} max={1000} value={categoryPriority} onChange={(event) => setCategoryPriority(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </div>
          <button type="button" onClick={addCategoryRule} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"><Plus className="w-4 h-4" /> Add</button>
        </div>
        <div className="mt-4 space-y-2">
          {config.complementaryCategoryRules.map((rule) => (
            <div key={`${rule.sourceCategoryId}-${rule.targetCategoryId}`} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <span className="font-medium text-gray-900">{categoryById.get(rule.sourceCategoryId)?.title_en || rule.sourceCategoryId}</span>
              <span className="text-gray-400">→</span>
              <span className="font-medium text-gray-900 flex-1">{categoryById.get(rule.targetCategoryId)?.title_en || rule.targetCategoryId}</span>
              <span className="text-gray-500">Priority {rule.priority}</span>
              <button type="button" onClick={() => setConfig({ ...config, complementaryCategoryRules: config.complementaryCategoryRules.filter((candidate) => !(candidate.sourceCategoryId === rule.sourceCategoryId && candidate.targetCategoryId === rule.targetCategoryId)) })} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {config.complementaryCategoryRules.length === 0 && <p className="text-xs text-gray-400">No complementary category rules configured.</p>}
        </div>
      </section>
    </div>
  );
}
