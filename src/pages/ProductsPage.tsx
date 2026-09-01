import { useEffect, useMemo, useState } from 'react';
import ProductCard from '../components/ProductCard';
import { PickupDaySelector } from '../components/PickupDaySelector';
import {
  PickupBrowseDateSelectorV2,
  PickupBrowseSelectionV2,
} from '../components/PickupBrowseDateSelectorV2';
import { AuthModal } from '../components/AuthModal';
import ProductDetailModal from '../components/ProductDetailModal';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { getCategories, getProducts, getProductBySlug, CMSCategory, CMSProduct } from '../lib/cmsService';
import {
  getPickupDays,
  isDayOpenForOrdering,
  getPickupDayLabel,
  PickupDay,
  ProductAvailability,
} from '../lib/availabilityService';
import { getPickupV2CustomerEnabled } from '../lib/pickupV2Rollout';
import { PickupAvailabilityRow } from '../lib/pickupAvailabilityV2';
import {
  readPreferredPickupDateV2,
  writePreferredPickupDateV2,
} from '../lib/pickupV2PreferredSelection';

interface ProductsPageProps {
  initialProductSlug?: string | null;
  qrSource?: string | null;
  onProductOpened?: () => void;
}

type V2ProductDisplayState = {
  availability: ProductAvailability;
  stockRemaining: number | null;
  quantityLimit: number | null;
};

export default function ProductsPage({ initialProductSlug, qrSource, onProductOpened }: ProductsPageProps) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { selectedPickupDay, setSelectedPickupDay, selectedCategory, setSelectedCategory } = useCart();
  const [categories, setCategories] = useState<CMSCategory[]>([]);
  const [products, setProducts] = useState<CMSProduct[]>([]);
  const [pickupDays, setPickupDays] = useState<PickupDay[]>([]);
  const [pickupV2Enabled, setPickupV2Enabled] = useState(false);
  const [rolloutResolved, setRolloutResolved] = useState(false);
  const [selectedPickupV2, setSelectedPickupV2] = useState<PickupBrowseSelectionV2 | null>(null);
  const [v2AvailabilityRows, setV2AvailabilityRows] = useState<PickupAvailabilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CMSProduct | null>(null);

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
    if (rolloutResolved && !pickupV2Enabled && selectedPickupV2) {
      setSelectedPickupV2(null);
      setV2AvailabilityRows([]);
    }
  }, [rolloutResolved, pickupV2Enabled, selectedPickupDay, selectedPickupV2]);

  useEffect(() => {
    if (!rolloutResolved || !pickupV2Enabled) return;
    const stored = readPreferredPickupDateV2(user?.id ?? null);
    if (!stored) return;
    setSelectedPickupV2({
      pickupDateId: stored.pickupDateId,
      pickupDate: stored.pickupDate,
      scheduleId: stored.scheduleId,
      scheduleKey: stored.scheduleKey,
      scheduleLabelEn: stored.scheduleLabelEn || stored.scheduleKey,
      scheduleLabelTh: stored.scheduleLabelTh || null,
      scheduleLabelZh: stored.scheduleLabelZh || null,
    });
  }, [rolloutResolved, pickupV2Enabled, user?.id]);

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
    } catch (error) {
      console.error('Error loading data:', error);
      setPickupV2Enabled(false);
      setRolloutResolved(true);
    } finally {
      setLoading(false);
    }
  }

  const handlePickupV2Change = (next: PickupBrowseSelectionV2 | null) => {
    setSelectedPickupV2(next);
    writePreferredPickupDateV2(user?.id ?? null, next);
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
    return map;
  }, [v2AvailabilityRows]);

  const getV2ProductDisplayState = (productId: string): V2ProductDisplayState => {
    const productRows = v2RowsByProduct.get(productId) || [];

    if (selectedPickupV2) {
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

  const filteredProducts = products.filter((product) => {
    const matchesCategory = !selectedCategory || selectedCategory === 'all' || product.category_id === selectedCategory;
    if (!matchesCategory) return false;

    if (pickupV2Enabled) {
      if (v2AvailabilityRows.length === 0) return true;
      const productRows = v2RowsByProduct.get(product.id) || [];
      if (!selectedPickupV2) return productRows.length > 0;
      return productRows.some((row) => row.pickup_date_id === selectedPickupV2.pickupDateId);
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
    const locale = language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-GB';
    const date = new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${selectedPickupV2.pickupDate}T12:00:00Z`));
    const schedule = language === 'th'
      ? selectedPickupV2.scheduleLabelTh || selectedPickupV2.scheduleLabelEn
      : language === 'zh'
        ? selectedPickupV2.scheduleLabelZh || selectedPickupV2.scheduleLabelEn
        : selectedPickupV2.scheduleLabelEn;
    return `${date} · ${schedule}`;
  }, [selectedPickupV2, language]);

  const selectedProductV2State = selectedProduct && pickupV2Enabled
    ? getV2ProductDisplayState(selectedProduct.id)
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-header font-bold text-primary-900 mb-4">
            {t.nav.products}
          </h1>
          <p className="text-lg text-gray-700">
            {t.product.preOrderOnly}
          </p>
        </div>

        {!rolloutResolved ? (
          <div className="max-w-3xl mx-auto mb-8 rounded-2xl border-2 border-amber-200 bg-amber-50 py-12 text-center text-sm text-gray-500">
            {language === 'th' ? 'กำลังโหลดวันรับสินค้า…' : language === 'zh' ? '正在加载取货日期…' : 'Loading pickup dates…'}
          </div>
        ) : pickupV2Enabled ? (
          <PickupBrowseDateSelectorV2
            productIds={products.map((product) => product.id)}
            value={selectedPickupV2}
            onChange={handlePickupV2Change}
            onAvailabilityRowsChange={setV2AvailabilityRows}
          />
        ) : (
          <PickupDaySelector
            selectedPickupDay={selectedPickupDay}
            onPickupDayChange={setSelectedPickupDay}
            availableDays={availableDays}
            closedDays={closedDays}
          />
        )}

        <div className="mb-8">
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-6 py-2.5 rounded-full font-medium transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-background text-primary-900 hover:bg-primary-100 border border-primary-200'
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
                  className={`px-6 py-2.5 rounded-full font-medium transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-background text-primary-900 hover:bg-primary-100 border border-primary-200'
                  }`}
                >
                  {categoryName}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading delicious items...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-gray-600">
              {(pickupV2Enabled ? selectedPickupV2 : selectedPickupDay)
                ? 'No products available for this pickup date and category.'
                : 'No products are currently available in this category.'}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => {
              const v2State = pickupV2Enabled ? getV2ProductDisplayState(product.id) : null;
              return (
                <div
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  className="cursor-pointer"
                >
                  <ProductCard
                    product={product}
                    selectedDay={pickupV2Enabled ? selectedPickupV2?.pickupDate || null : selectedPickupDay}
                    selectedDayDisplay={pickupV2Enabled ? v2SelectedDisplay : selectedLegacyPickupDisplay}
                    availabilityOverride={v2State?.availability}
                    stockRemainingOverride={v2State?.stockRemaining}
                    quantityLimitOverride={v2State?.quantityLimit}
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
        selectedDay={pickupV2Enabled ? selectedPickupV2?.pickupDate || null : selectedPickupDay}
        selectedDayDisplay={pickupV2Enabled ? v2SelectedDisplay : selectedLegacyPickupDisplay}
        availabilityOverride={selectedProductV2State?.availability}
        stockRemainingOverride={selectedProductV2State?.stockRemaining}
        quantityLimitOverride={selectedProductV2State?.quantityLimit}
        onLoginRequired={() => setShowAuthModal(true)}
      />
    </div>
  );
}
