import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Plus, Sparkles } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import { CMSProduct, getProducts } from '../lib/cmsService';
import {
  FitsYourPickupConfig,
  getFitsYourPickupConfig,
  getRecommendationPlacementConfig,
  rankFitsYourPickupProducts,
  RecommendationPlacement,
} from '../lib/commerceIntelligence';
import { fetchAllLikeCounts } from '../lib/likesService';
import { getCustomerPickupAvailabilityV2, PickupAvailabilityRow } from '../lib/pickupAvailabilityV2';
import { getPublicImageUrl } from '../lib/storage';

interface FitsYourPickupV2Props {
  pickupDateId: string;
  placement?: RecommendationPlacement;
  onProductClick?: (product: CMSProduct) => void;
}

function formatPickupDate(value: string, language: 'en' | 'th' | 'zh'): string {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  const locale = language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-GB';
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function productImage(product: CMSProduct): string {
  if (product.image) {
    if (product.image.startsWith('http')) return product.image;
    return getPublicImageUrl(`products/${product.image}`);
  }
  return 'https://images.pexels.com/photos/821365/pexels-photo-821365.jpeg';
}

export function FitsYourPickupV2({ pickupDateId, placement = 'cart', onProductClick }: FitsYourPickupV2Props) {
  const { items, addToCart } = useCart();
  const { language } = useLanguage();
  const { getLabel } = useCMSLabels();
  const [products, setProducts] = useState<CMSProduct[]>([]);
  const [rows, setRows] = useState<PickupAvailabilityRow[]>([]);
  const [config, setConfig] = useState<FitsYourPickupConfig | null>(null);
  const [likeCounts, setLikeCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  const cartProductIds = useMemo(
    () => new Set(items.map((item) => item.product.id)),
    [items],
  );
  const cartCategoryIds = useMemo(
    () => new Set(items
      .map((item) => item.product.category_id)
      .filter((categoryId): categoryId is string => Boolean(categoryId))),
    [items],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [catalog, nextConfig, nextLikeCounts] = await Promise.all([
          getProducts(),
          getFitsYourPickupConfig(),
          fetchAllLikeCounts(),
        ]);
        if (cancelled) return;
        setProducts(catalog);
        setConfig(nextConfig);
        setLikeCounts(nextLikeCounts);

        if (catalog.length === 0) {
          setRows([]);
          return;
        }

        const availability = await getCustomerPickupAvailabilityV2(
          catalog.map((product) => product.id),
        );
        if (!cancelled) setRows(availability);
      } catch (error) {
        console.error('Could not load pickup recommendations:', error);
        if (!cancelled) {
          setProducts([]);
          setRows([]);
          setConfig(null);
          setLikeCounts(new Map());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [pickupDateId]);

  const selectedDateRows = useMemo(
    () => rows.filter((row) => row.pickup_date_id === pickupDateId && row.remaining_quantity > 0),
    [rows, pickupDateId],
  );

  const remainingByProduct = useMemo(() => {
    const map = new Map<string, number>();
    selectedDateRows.forEach((row) => {
      map.set(row.product_id, Math.max(map.get(row.product_id) || 0, row.remaining_quantity));
    });
    return map;
  }, [selectedDateRows]);

  const placementConfig = config ? getRecommendationPlacementConfig(config, placement) : null;
  const recommendations = useMemo(() => {
    if (!config || !placementConfig?.enabled) return [];
    const eligible = products.filter(
      (product) => !cartProductIds.has(product.id) && (remainingByProduct.get(product.id) || 0) > 0,
    );
    return rankFitsYourPickupProducts(eligible, cartCategoryIds, likeCounts, config)
      .slice(0, placementConfig.maxSuggestions);
  }, [products, cartProductIds, remainingByProduct, cartCategoryIds, likeCounts, config, placementConfig?.enabled, placementConfig?.maxSuggestions]);

  if (loading || !config || !placementConfig?.enabled || recommendations.length === 0) return null;

  const selectedDate = selectedDateRows[0]?.pickup_date || null;
  const isCheckout = placement === 'checkout';
  const title = getLabel(
    isCheckout ? 'checkout_recommendations.title' : 'fits_your_pickup.title',
    language,
    isCheckout
      ? (language === 'th' ? 'เพิ่มอะไรอีกนิดไหม?' : language === 'zh' ? '最后再加一点？' : 'One last thing?')
      : (language === 'th' ? 'เข้ากับวันรับสินค้าของคุณ' : language === 'zh' ? '适合您的取货日期' : 'Fits your pickup'),
  );
  const helper = getLabel(
    isCheckout ? 'checkout_recommendations.helper' : 'fits_your_pickup.helper',
    language,
    isCheckout
      ? (language === 'th'
        ? 'สินค้าเหล่านี้ยังเพิ่มได้โดยไม่เปลี่ยนวันรับสินค้าที่คุณยืนยันไว้'
        : language === 'zh'
          ? '这些商品仍可加入，并且不会改变您已确认的取货日期。'
          : 'These can still be added without changing your confirmed pickup.')
      : (language === 'th'
        ? 'เพิ่มสินค้าเหล่านี้ได้โดยไม่ต้องเปลี่ยนวันรับสินค้าที่เลือก'
        : language === 'zh'
          ? '添加这些商品不会改变您已选择的取货日期。'
          : 'Add any of these without changing your selected pickup date.'),
  );
  const addLabel = getLabel(
    'fits_your_pickup.add',
    language,
    language === 'th' ? 'เพิ่ม' : language === 'zh' ? '添加' : 'Add',
  );
  const viewDetailsLabel = getLabel(
    'recommendations.view_details',
    language,
    language === 'th' ? 'ดูรายละเอียด' : language === 'zh' ? '查看详情' : 'View details',
  );

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${isCheckout ? 'border-amber-200 bg-amber-50/60' : 'border-emerald-200 bg-emerald-50/70'}`}>
      <div className="flex items-start gap-2.5">
        {isCheckout
          ? <Sparkles className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
          : <CheckCircle2 className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" />}
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            {helper}
            {selectedDate ? ` ${formatPickupDate(selectedDate, language)}.` : ''}
          </p>
        </div>
      </div>

      <div className={isCheckout ? 'grid gap-2 sm:grid-cols-2' : 'space-y-2'}>
        {recommendations.map((product) => {
          const name = language === 'th'
            ? product.name_th
            : language === 'zh'
              ? product.name_zh || product.name_en
              : product.name_en;
          const remaining = remainingByProduct.get(product.id) || 0;

          return (
            <div
              key={product.id}
              className={`flex items-center gap-3 rounded-lg border bg-white p-2.5 ${isCheckout ? 'border-amber-100' : 'border-emerald-100'}`}
            >
              <button
                type="button"
                onClick={() => onProductClick?.(product)}
                disabled={!onProductClick}
                className={`min-w-0 flex flex-1 items-center gap-3 rounded-md text-left ${onProductClick ? 'hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400' : 'cursor-default'}`}
              >
                <img
                  src={productImage(product)}
                  alt={name}
                  className="w-12 h-12 rounded-md object-cover shrink-0"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-medium text-primary-800">฿{product.price}</span>
                    <span className="text-[11px] text-gray-500">
                      {language === 'th'
                        ? `เหลือ ${remaining}`
                        : language === 'zh'
                          ? `剩余 ${remaining}`
                          : `${remaining} available`}
                    </span>
                  </div>
                  {onProductClick && <p className="mt-1 text-[11px] font-semibold text-amber-700">{viewDetailsLabel}</p>}
                </div>
              </button>
              <button
                type="button"
                onClick={() => addToCart(product, 1, { openCart: !isCheckout })}
                aria-label={`${addLabel} ${name}`}
                title={`${addLabel} ${name}`}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold text-white transition-colors shrink-0 ${isCheckout ? 'bg-amber-700 hover:bg-amber-800' : 'bg-emerald-700 hover:bg-emerald-800'}`}
              >
                <Plus className="w-3.5 h-3.5" />
                {addLabel}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
