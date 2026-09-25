import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, RefreshCw, ShoppingBag } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { PickupDaySelector } from '../components/PickupDaySelector';
import {
  PickupBrowseDateSelectorV2,
  PickupBrowseSelectionV2,
} from '../components/PickupBrowseDateSelectorV2';
import { AuthModal } from '../components/AuthModal';
import ProductDetailModal from '../components/ProductDetailModal';
import { ProductPickupCalendarModalV2 } from '../components/ProductPickupCalendarModalV2';
import { PickupBasketFitDisplay } from '../components/PickupIntelligenceBadges';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import { getCategories, getProducts, getProductBySlug, CMSCategory, CMSProduct } from '../lib/cmsService';
import {
  getPickupDays,
  isDayOpenForOrdering,
  getPickupDayLabel,
  PickupDay,
  ProductAvailability,
} from '../lib/availabilityService';
import { getPickupV2CustomerEnabled } from '../lib/pickupV2Rollout';
import {
  getCommonPickupDates,
  getCustomerPickupAvailabilityV2,
  PickupAvailabilityRow,
} from '../lib/pickupAvailabilityV2';
import { writePreferredPickupDateV2 } from '../lib/pickupV2PreferredSelection';

interface ProductsPageProps {
  initialProductSlug?: string | null;
  qrSource?: string | null;
  onProductOpened?: () => void;
  onNavigate?: (page: string) => void;
}

type V2ProductDisplayState = {
  availability: ProductAvailability;
  stockRemaining: number | null;
  quantityLimit: number | null;
};

type SupportedLanguage = 'en' | 'th' | 'zh';
type BrowseMode = 'all' | 'pickup';

type ProductPickupCalendarRequest = {
  product: CMSProduct;
  quantity: number;
};

function formatPickupDate(value: string, language: SupportedLanguage): string {
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

function localizedScheduleLabel(row: PickupAvailabilityRow, language: SupportedLanguage): string {
  if (language === 'th') return row.schedule_label_th || row.schedule_label_en;
  if (language === 'zh') return row.schedule_label_zh || row.schedule_label_en;
  return row.schedule_label_en;
}

function localizedLocationLabel(row: PickupAvailabilityRow, language: SupportedLanguage): string | null {
  if (row.locations.length !== 1) return null;
  const location = row.locations[0];
  if (language === 'th') return location.name_th || location.name_en;
  if (language === 'zh') return location.name_zh || location.name_en;
  return location.name_en;
}

export default function ProductsPage({ initialProductSlug, qrSource, onProductOpened, onNavigate }: ProductsPageProps) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { getLabel } = useCMSLabels();
  const { items, selectedPickupDay, setSelectedPickupDay, selectedCategory, setSelectedCategory } = useCart();
  const [categories, setCategories] = useState<CMSCategory[]>([]);
  const [products, setProducts] = useState<CMSProduct[]>([]);
  const [pickupDays, setPickupDays] = useState<PickupDay[]>([]);
  const [pickupV2Enabled, setPickupV2Enabled] = useState(false);
  const [rolloutResolved, setRolloutResolved] = useState(false);
  const [browseMode, setBrowseMode] = useState<BrowseMode>('all');
  const [selectedPickupV2, setSelectedPickupV2] = useState<PickupBrowseSelectionV2 | null>(null);
  const [v2AvailabilityRows, setV2AvailabilityRows] = useState<PickupAvailabilityRow[]>([]);
  const [v2AvailabilityLoading, setV2AvailabilityLoading] = useState(false);
  const [v2AvailabilityError, setV2AvailabilityError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CMSProduct | null>(null);
  const [productPickupCalendar, setProductPickupCalendar] = useState<ProductPickupCalendarRequest | null>(null);

  useEffect(() => {
    void loadData();
    if (!selectedCategory) {
      setSelectedCategory('all');
    }

    const handleOpenProductDetail = (e: CustomEvent<CMSProduct>) => {
      setSelectedProduct(e.detail);
    };
    window.addEventListener('openProductDetail', handleOpenProductDetail as EventListener);
    return () => {
      window.removeEventListener('openProductDetail', handleOpenProductDetail as EventListener);
    };
  }, []);

  useEffect(() => {
    if (rolloutResolved && pickupV2Enabled && selectedPickupDay) {
      setSelectedPickupDay(null);
    }
    if (rolloutResolved && !pickupV2Enabled) {
      setBrowseMode('all');
      setSelectedPickupV2(null);
    }
  }, [rolloutResolved, pickupV2Enabled, selectedPickupDay]);

  useEffect(() => {
    if (initialProductSlug && !loading && products.length > 0) {
      const foundProduct = products.find(p => p.slug === initialProductSlug || p.slug.startsWith(initialProductSlug));
      if (foundProduct) {
        setSelectedProduct(foundProduct);
        if (qrSource === 'qr') {
          console.log('[QR Scan] Product opened via in-store QR:', foundProduct.slug);
        }
        onProductOpened?.();
      } else {
        getProductBySlug(initialProductSlug).then(product => {
          if (product) {
            setSelectedProduct(product);
            if (qrSource === 'qr') {
              console.log('[QR Scan] Product opened via in-store QR:', product.slug);
            }
          }
          onProductOpened?.();
        });
      }
    }
  }, [initialProductSlug, loading, products, qrSource, onProductOpened]);

  async function loadV2Availability(productIds: string[]) {
    if (productIds.length === 0) {
      setV2AvailabilityRows([]);
      setV2AvailabilityError('');
      return;
    }

    setV2AvailabilityLoading(true);
    setV2AvailabilityError('');
    try {
      const rows = await getCustomerPickupAvailabilityV2(productIds);
      setV2AvailabilityRows(rows);
    } catch (error) {
      console.error('Error loading Pickup v2 product availability:', error);
      setV2AvailabilityRows([]);
      setV2AvailabilityError(error instanceof Error ? error.message : 'Could not load Pickup v2 availability.');
    } finally {
      setV2AvailabilityLoading(false);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const [cmsCategories, cmsProducts, days, v2Enabled] = await Promise.all([
        getCategories(),
        getProducts(),
        getPickupDays(),
        getPickupV2CustomerEnabled(),
      ]);

      setCategories(cmsCategories);
      setProducts(cmsProducts);
      setPickupDays(days);
      setPickupV2Enabled(v2Enabled);
      setRolloutResolved(true);

      if (v2Enabled) {
        await loadV2Availability(cmsProducts.map((product) => product.id));
      } else {
        setV2AvailabilityRows([]);
        setV2AvailabilityError('');
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setPickupV2Enabled(false);
      setRolloutResolved(true);
    } finally {
      setLoading(false);
    }
  }

  const handleBrowsePickupChange = (selection: PickupBrowseSelectionV2 | null) => {
    setSelectedPickupV2(selection);
    if (!selection) return;
    writePreferredPickupDateV2(user?.id ?? null, {
      pickupDateId: selection.pickupDateId,
      pickupDate: selection.pickupDate,
      pickupLocationId: selection.pickupLocationId || null,
      scheduleId: selection.scheduleId,
      scheduleKey: selection.scheduleKey,
      scheduleLabelEn: selection.scheduleLabelEn,
      scheduleLabelTh: selection.scheduleLabelTh,
      scheduleLabelZh: selection.scheduleLabelZh,
    });
  };

  const selectedPickupSlot = pickupDays.find((day) =>
    day.day_key === selectedPickupDay || day.label === selectedPickupDay,
  ) || null;
  const selectedLegacyPickupDisplay = selectedPickupSlot
    ? getPickupDayLabel(selectedPickupSlot, language)
    : selectedPickupDay;

  const v2RowsByProduct = useMemo(() => {
    const map = new Map<string, PickupAvailabilityRow[]>();
    v2AvailabilityRows.forEach((row) => {
      const current = map.get(row.product_id) || [];
      current.push(row);
      map.set(row.product_id, current);
    });
    map.forEach((rows) => rows.sort((a, b) => a.pickup_date.localeCompare(b.pickup_date)));
    return map;
  }, [v2AvailabilityRows]);

  const cartRequirements = useMemo(
    () => items.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
    [items],
  );

  const getV2ProductDisplayState = (productId: string): V2ProductDisplayState => {
    const productRows = v2RowsByProduct.get(productId) || [];

    if (browseMode === 'pickup' && selectedPickupV2) {
      const row = productRows.find((candidate) => candidate.pickup_date_id === selectedPickupV2.pickupDateId);
      if (!row) {
        return {
          availability: {
            isAvailable: false,
            isSoldOut: false,
            isNotOfferedToday: true,
            remainingStock: 0,
          },
          stockRemaining: 0,
          quantityLimit: 0,
        };
      }

      const remaining = Math.max(0, row.remaining_quantity);
      return {
        availability: {
          isAvailable: remaining > 0,
          isSoldOut: remaining <= 0,
          isNotOfferedToday: false,
          remainingStock: remaining,
        },
        stockRemaining: remaining,
        quantityLimit: remaining,
      };
    }

    const maxRemaining = productRows.reduce(
      (maximum, row) => Math.max(maximum, row.remaining_quantity),
      0,
    );
    const hasFutureAvailability = maxRemaining > 0;

    return {
      availability: {
        isAvailable: hasFutureAvailability,
        isSoldOut: !hasFutureAvailability,
        isNotOfferedToday: productRows.length === 0,
        remainingStock: maxRemaining,
      },
      stockRemaining: hasFutureAvailability ? null : 0,
      quantityLimit: hasFutureAvailability ? maxRemaining : 0,
    };
  };

  const earliestPickupTemplate = getLabel(
    'pickup_intelligence.earliest_pickup',
    language,
    language === 'th' ? 'รับเร็วที่สุด: {{pickup}}' : language === 'zh' ? '最早取货：{{pickup}}' : 'Earliest pickup: {{pickup}}',
  );
  const basketFitTemplate = getLabel(
    'pickup_intelligence.basket_fit',
    language,
    language === 'th'
      ? 'เข้ากับตะกร้าของคุณ · {{count}} ตัวเลือกรับสินค้า'
      : language === 'zh'
        ? '适合当前购物篮 · {{count}} 个取货选项'
        : 'Fits your basket · {{count}} pickup options',
  );
  const basketConflictLabel = getLabel(
    'pickup_intelligence.basket_conflict',
    language,
    language === 'th'
      ? 'ไม่มีวันรับสินค้าร่วมกันสำหรับตะกร้านี้'
      : language === 'zh'
        ? '与当前购物篮没有共同取货日期'
        : 'No common pickup date with this basket',
  );

  const getNextPickupLabel = (productId: string): string | null => {
    if (!pickupV2Enabled) return null;
    const nextRow = (v2RowsByProduct.get(productId) || []).find((row) => row.remaining_quantity > 0);
    if (!nextRow) return null;

    const dateLabel = formatPickupDate(nextRow.pickup_date, language);
    const destinationLabel = localizedLocationLabel(nextRow, language)
      || localizedScheduleLabel(nextRow, language);
    return earliestPickupTemplate.replace('{{pickup}}', `${dateLabel} · ${destinationLabel}`);
  };

  const getBasketFit = (productId: string, quantity: number): PickupBasketFitDisplay | null => {
    if (!pickupV2Enabled || cartRequirements.length === 0 || !Number.isFinite(quantity) || quantity <= 0) {
      return null;
    }

    const commonDates = getCommonPickupDates(v2AvailabilityRows, [
      ...cartRequirements,
      { productId, quantity },
    ]);

    if (commonDates.length > 0) {
      return {
        tone: 'positive',
        label: basketFitTemplate.replace('{{count}}', String(commonDates.length)),
      };
    }

    return {
      tone: 'warning',
      label: basketConflictLabel,
    };
  };

  const filteredProducts = products.filter((product) => {
    const matchesCategory = !selectedCategory || selectedCategory === 'all' || product.category_id === selectedCategory;
    if (!matchesCategory) return false;

    if (pickupV2Enabled) {
      if (browseMode === 'pickup' && selectedPickupV2) {
        const productRows = v2RowsByProduct.get(product.id) || [];
        return productRows.some((row) => row.pickup_date_id === selectedPickupV2.pickupDateId);
      }
      return true;
    }

    if (!selectedPickupDay) return true;

    const selectedDay = pickupDays.find((day) =>
      day.day_key === selectedPickupDay || day.label === selectedPickupDay,
    );
    const candidates = selectedDay
      ? [selectedDay.day_key, selectedDay.label, selectedDay.label_en, selectedDay.label_th, selectedDay.label_zh]
          .filter((value): value is string => Boolean(value))
      : [selectedPickupDay];
    const productDays = product.available_days || [];
    return productDays.length === 0 || candidates.some((value) => productDays.includes(value));
  });

  const dayOptions = pickupDays.map(day => ({
    label: day.label,
    displayLabel: getPickupDayLabel(day, language),
    key: day.day_key,
  }));

  const getIsOpen = (label: string): boolean => {
    const day = pickupDays.find((d) => d.label === label);
    return day ? isDayOpenForOrdering(day) : false;
  };

  const availableDays = dayOptions.filter(d => getIsOpen(d.label)).map(d => d.label);
  const closedDays = dayOptions.filter(d => !getIsOpen(d.label)).map(d => d.label);

  const v2SelectedDisplay = useMemo(() => {
    if (!selectedPickupV2) return null;
    const date = formatPickupDate(selectedPickupV2.pickupDate, language);
    const schedule = language === 'th'
      ? selectedPickupV2.scheduleLabelTh || selectedPickupV2.scheduleLabelEn
      : language === 'zh'
        ? selectedPickupV2.scheduleLabelZh || selectedPickupV2.scheduleLabelEn
        : selectedPickupV2.scheduleLabelEn;
    const representative = v2AvailabilityRows.find((row) => row.pickup_date_id === selectedPickupV2.pickupDateId);
    const location = representative && selectedPickupV2.pickupLocationId
      ? representative.locations.find((candidate) => candidate.id === selectedPickupV2.pickupLocationId) || null
      : null;
    const locationName = location
      ? (language === 'th'
        ? location.name_th || location.name_en
        : language === 'zh'
          ? location.name_zh || location.name_en
          : location.name_en)
      : null;
    return `${date} · ${locationName || schedule}`;
  }, [selectedPickupV2, language, v2AvailabilityRows]);

  const selectedProductV2State = selectedProduct && pickupV2Enabled
    ? getV2ProductDisplayState(selectedProduct.id)
    : null;
  const selectedProductNextPickupLabel = selectedProduct && pickupV2Enabled && browseMode === 'all'
    ? getNextPickupLabel(selectedProduct.id)
    : null;

  const browseEverythingModeLabel = getLabel(
    'products.browse_everything_mode',
    language,
    language === 'th' ? 'เลือกดูสินค้าทั้งหมด' : language === 'zh' ? '浏览全部商品' : 'Browse everything',
  );
  const browseByPickupModeLabel = getLabel(
    'products.browse_by_pickup_mode',
    language,
    language === 'th' ? 'เลือกดูตามวันและสถานที่รับสินค้า' : language === 'zh' ? '按取货日期和地点浏览' : 'Browse by pickup date & location',
  );
  const browseTitle = getLabel(
    'products.browse_everything_title',
    language,
    browseEverythingModeLabel,
  );
  const browseHelper = getLabel(
    'products.browse_everything_helper',
    language,
    language === 'th'
      ? 'เลือกสินค้าที่คุณชอบได้เลย แล้ว Pickup Finder ในตะกร้าจะหาวันที่สินค้าทุกชิ้นมีพร้อมให้รับในครั้งเดียว'
      : language === 'zh'
        ? '先挑选您喜欢的商品。购物篮里的 Pickup Finder 会查找所有商品都能一起取货的日期。'
        : 'Choose what you like first. Pickup Finder in your basket will find dates when everything can be collected together.',
  );

  return (
    <div className="joko-products-page joko-mineral-field min-h-screen">
      <div className="relative z-10 mx-auto max-w-[88rem] px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
        <div className="mb-9 max-w-3xl sm:mb-11">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#3F665E] sm:text-[11px]">
            JOKO TODAY
          </p>
          <h1
            className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-[#292D2B] sm:text-5xl lg:text-6xl"
            style={{ fontFamily: 'var(--joko-font-display)' }}
          >
            {t.nav.products}
          </h1>
          <span className="mt-3 block h-[3px] w-44 -rotate-1 rounded-full bg-[#D98242]/75" aria-hidden="true" />
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#303532]/70 sm:text-lg">
            {t.product.preOrderOnly}
          </p>
        </div>

        {!rolloutResolved ? (
          <div className="joko-products-control-card mx-auto mb-8 max-w-3xl py-12 text-center text-sm text-[#303532]/60">
            {language === 'th' ? 'กำลังโหลดสินค้า…' : language === 'zh' ? '正在加载商品…' : 'Loading products…'}
          </div>
        ) : pickupV2Enabled ? (
          <>
            <div className="joko-products-mode-switch mx-auto mb-5 grid max-w-3xl gap-1.5 p-1.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setBrowseMode('all')}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${browseMode === 'all' ? 'bg-[#55766F] text-white shadow-sm' : 'text-[#303532]/76 hover:bg-[#FFF9EE]/72'}`}
              >
                <ShoppingBag className="w-4 h-4" />
                {browseEverythingModeLabel}
              </button>
              <button
                type="button"
                onClick={() => setBrowseMode('pickup')}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${browseMode === 'pickup' ? 'bg-[#55766F] text-white shadow-sm' : 'text-[#303532]/76 hover:bg-[#FFF9EE]/72'}`}
              >
                <CalendarDays className="w-4 h-4" />
                {browseByPickupModeLabel}
              </button>
            </div>

            {browseMode === 'all' ? (
              <div className="joko-products-control-card mx-auto mb-8 max-w-3xl p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#C76624]/18 bg-[#FFF9EE]/82">
                      <ShoppingBag className="h-5 w-5 text-[#A44F1D]" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-[#303532]">{browseTitle}</h2>
                      <p className="mt-1 text-sm leading-6 text-[#303532]/64">{browseHelper}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadV2Availability(products.map((product) => product.id))}
                    disabled={v2AvailabilityLoading || products.length === 0}
                    className="shrink-0 rounded-lg border border-[#55766F]/18 bg-[#FFF9EE]/78 p-2 text-[#55766F] transition hover:bg-[#FFF9EE] disabled:opacity-40"
                    aria-label="Refresh product availability"
                  >
                    <RefreshCw className={`w-4 h-4 ${v2AvailabilityLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                {v2AvailabilityError && (
                  <div className="mt-4 rounded-xl border border-[#B95C4B]/20 bg-[#F9E9E5]/72 px-4 py-3 text-sm text-[#944235]">
                    {v2AvailabilityError}
                  </div>
                )}
              </div>
            ) : (
              <div className="joko-products-control-card mx-auto mb-8 max-w-4xl p-4 sm:p-5">
                <PickupBrowseDateSelectorV2
                  productIds={products.map((product) => product.id)}
                  value={selectedPickupV2}
                  onChange={handleBrowsePickupChange}
                  onAvailabilityRowsChange={setV2AvailabilityRows}
                />
              </div>
            )}
          </>
        ) : (
          <div className="joko-products-control-card mx-auto mb-8 max-w-4xl p-4 sm:p-5">
            <PickupDaySelector
              selectedPickupDay={selectedPickupDay}
              onPickupDayChange={setSelectedPickupDay}
              availableDays={availableDays}
              closedDays={closedDays}
            />
          </div>
        )}

        <div className="mb-9">
          <div className="joko-products-category-strip flex flex-wrap gap-2.5 p-2.5 sm:gap-3 sm:p-3">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`rounded-full border px-5 py-2.5 text-sm font-medium transition-all sm:px-6 ${
                selectedCategory === 'all'
                  ? 'border-[#55766F] bg-[#55766F] text-white shadow-sm'
                  : 'border-[#55766F]/18 bg-[#FFF9EE]/62 text-[#303532]/78 hover:border-[#C76624]/35 hover:bg-[#FFF9EE]'
              }`}
            >
              {t.categories.all}
            </button>
            {categories.map((category) => {
              const categoryName = language === 'zh'
                ? (category.title_zh || category.title_en)
                : language === 'th'
                  ? category.title_th
                  : category.title_en;
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`rounded-full border px-5 py-2.5 text-sm font-medium transition-all sm:px-6 ${
                    selectedCategory === category.id
                      ? 'border-[#55766F] bg-[#55766F] text-white shadow-sm'
                      : 'border-[#55766F]/18 bg-[#FFF9EE]/62 text-[#303532]/78 hover:border-[#C76624]/35 hover:bg-[#FFF9EE]'
                  }`}
                >
                  {categoryName}
                </button>
              );
            })}
          </div>
        </div>

        {loading || (pickupV2Enabled && v2AvailabilityLoading && v2AvailabilityRows.length === 0) ? (
          <div className="py-20 text-center">
            <div className="inline-block h-11 w-11 animate-spin rounded-full border-[3px] border-solid border-[#55766F] border-r-transparent"></div>
            <p className="mt-4 text-sm text-[#303532]/62">Loading delicious items...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="joko-products-control-card py-16 text-center">
            <p className="text-lg text-[#303532]/62">
              {(pickupV2Enabled && browseMode === 'pickup' && selectedPickupV2) || (selectedPickupDay && !pickupV2Enabled)
                ? 'No products available for this pickup date and category.'
                : 'No products are currently available in this category.'}
            </p>
          </div>
        ) : (
          <div className="joko-products-grid grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6">
            {filteredProducts.map((product) => {
              const v2State = pickupV2Enabled ? getV2ProductDisplayState(product.id) : null;
              const nextPickupLabel = pickupV2Enabled && browseMode === 'all' ? getNextPickupLabel(product.id) : null;
              const canShowBasketFit = Boolean(pickupV2Enabled && browseMode === 'all' && v2State?.availability.isAvailable);
              return (
                <div
                  key={product.id}
                  onClick={(event) => {
                    const target = event.target as HTMLElement;
                    if (target.closest('button, a, input, select, textarea')) return;
                    if (onNavigate) {
                      onNavigate(`product/${product.slug}`);
                      return;
                    }
                    setSelectedProduct(product);
                  }}
                  className="joko-products-card-wrap cursor-pointer"
                >
                  <ProductCard
                    product={product}
                    selectedDay={pickupV2Enabled
                      ? (browseMode === 'pickup' ? selectedPickupV2?.pickupDate || null : null)
                      : selectedPickupDay}
                    selectedDayDisplay={pickupV2Enabled
                      ? (browseMode === 'pickup' ? v2SelectedDisplay : null)
                      : selectedLegacyPickupDisplay}
                    availabilityOverride={v2State?.availability}
                    stockRemainingOverride={v2State?.stockRemaining}
                    quantityLimitOverride={v2State?.quantityLimit}
                    nextPickupLabel={nextPickupLabel}
                    getBasketFit={canShowBasketFit ? (quantity) => getBasketFit(product.id, quantity) : undefined}
                    onOpenPickupCalendar={pickupV2Enabled && browseMode === 'all'
                      ? (quantity) => setProductPickupCalendar({ product, quantity })
                      : undefined}
                    onLoginRequired={() => setShowAuthModal(true)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />

      <ProductDetailModal
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        selectedDay={pickupV2Enabled
          ? (browseMode === 'pickup' ? selectedPickupV2?.pickupDate || null : null)
          : selectedPickupDay}
        selectedDayDisplay={pickupV2Enabled
          ? (browseMode === 'pickup' ? v2SelectedDisplay : null)
          : selectedLegacyPickupDisplay}
        availabilityOverride={selectedProductV2State?.availability}
        stockRemainingOverride={selectedProductV2State?.stockRemaining}
        quantityLimitOverride={selectedProductV2State?.quantityLimit}
        nextPickupLabel={selectedProductNextPickupLabel}
        getBasketFit={selectedProduct && pickupV2Enabled && browseMode === 'all' && selectedProductV2State?.availability.isAvailable
          ? (quantity) => getBasketFit(selectedProduct.id, quantity)
          : undefined}
        onOpenPickupCalendar={selectedProduct && pickupV2Enabled && browseMode === 'all'
          ? (quantity) => {
              const product = selectedProduct;
              setSelectedProduct(null);
              setProductPickupCalendar({ product, quantity });
            }
          : undefined}
        onLoginRequired={() => setShowAuthModal(true)}
      />

      <ProductPickupCalendarModalV2
        product={productPickupCalendar?.product || null}
        quantity={productPickupCalendar?.quantity || 1}
        isOpen={Boolean(productPickupCalendar)}
        onClose={() => setProductPickupCalendar(null)}
      />
    </div>
  );
}
