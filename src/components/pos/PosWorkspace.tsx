import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  Loader2,
  Minus,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import type { CMSCategory, CMSProduct } from '../../lib/cmsService';
import { getPublicImageUrl } from '../../lib/storage';
import type { PosCartState } from '../../hooks/usePosCart';
import { LoyaltyRewardSelector } from '../staff/LoyaltyRewardSelector';

type StaffLanguage = 'en' | 'th';
type PaymentMethod = 'cash' | 'qr_code' | '';
type CompletedPaymentMethod = Exclude<PaymentMethod, ''>;

type Props = {
  products: CMSProduct[];
  categories: CMSCategory[];
  loading: boolean;
  loadError: boolean;
  language: StaffLanguage;
  currentBalance: number;
  loyaltyMultiplier: number;
  isGuestSale: boolean;
  cart: PosCartState;
  saving: boolean;
  retryRequired: boolean;
  checkoutError: string | null;
  onRetry: () => void;
  onCompleteSale: (input: {
    paymentMethod: CompletedPaymentMethod;
    rewardId: string | null;
  }) => Promise<void>;
  onUseLegacyCheckout: (previewSubtotal: number) => void;
};

const money = (value: number) =>
  Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const productImageUrl = (product: CMSProduct) => {
  if (!product.image) return null;
  if (product.image.startsWith('http')) return product.image;
  return getPublicImageUrl(`products/${product.image}`);
};

export function PosWorkspace({
  products,
  categories,
  loading,
  loadError,
  language,
  currentBalance,
  loyaltyMultiplier,
  isGuestSale,
  cart,
  saving,
  retryRequired,
  checkoutError,
  onRetry,
  onCompleteSale,
  onUseLegacyCheckout,
}: Props) {
  const {
    items,
    addProduct,
    increment,
    decrement,
    remove,
    clear,
    totalQuantity,
    previewSubtotal,
    quantityFor,
  } = cart;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('');
  const [selectedRewardId, setSelectedRewardId] = useState('');

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();

    return products.filter((product) => {
      const categoryMatches =
        selectedCategory === 'all' || product.category_id === selectedCategory;
      if (!categoryMatches) return false;
      if (!query) return true;

      return [
        product.name_en,
        product.name_th,
        product.name_zh,
        product.slug,
        product.public_code,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(query));
    });
  }, [products, searchQuery, selectedCategory]);

  const productName = (product: CMSProduct) =>
    language === 'th' ? product.name_th || product.name_en : product.name_en;

  const categoryName = (category: CMSCategory) =>
    language === 'th' ? category.title_th || category.title_en : category.title_en;

  const projectedPoints = Math.round(previewSubtotal * loyaltyMultiplier);
  const checkoutLocked = saving || retryRequired;
  const canCompleteSale = items.length > 0 && paymentMethod !== '' && !checkoutLocked;

  const clearSale = () => {
    if (items.length === 0) return;
    const confirmed = window.confirm(
      language === 'en'
        ? 'Clear all products from this sale?'
        : 'ล้างสินค้าทั้งหมดออกจากรายการขายนี้หรือไม่'
    );
    if (!confirmed) return;
    clear();
    setSelectedRewardId('');
    setPaymentMethod('');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-bold text-emerald-950">
              {isGuestSale
                ? (language === 'en' ? 'JOKO POS · Guest sale' : 'JOKO POS · การขายแบบ Guest')
                : (language === 'en' ? 'JOKO POS · Live checkout' : 'JOKO POS · ชำระเงินจริง')}
            </p>
            <p className="mt-1 text-sm text-emerald-800">
              {isGuestSale
                ? (language === 'en'
                    ? 'Build the basket normally. Guest sales have no loyalty rewards, points or customer-history attachment.'
                    : 'สร้างตะกร้าตามปกติ การขายแบบ Guest จะไม่มีรางวัล แต้มสะสม หรือประวัติลูกค้า')
                : (language === 'en'
                    ? 'Build the basket here. Product prices, rewards, totals and loyalty are verified again by the server when you complete the sale.'
                    : 'สร้างตะกร้าที่นี่ ระบบจะตรวจสอบราคาสินค้า รางวัล ยอดรวม และแต้มสะสมอีกครั้งบนเซิร์ฟเวอร์เมื่อเสร็จสิ้นการขาย')}
            </p>
          </div>
          {!isGuestSale && (
            <button
              type="button"
              onClick={() => onUseLegacyCheckout(previewSubtotal)}
              disabled={checkoutLocked}
              className="rounded-lg border border-emerald-700 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {language === 'en' ? 'Use Legacy Walk-In' : 'ใช้ Walk-In แบบเดิม'}
            </button>
          )}
        </div>
      </div>

      {retryRequired && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <p className="font-bold">
                {language === 'en'
                  ? 'Confirm this submitted sale before doing anything else'
                  : 'ยืนยันรายการขายที่ส่งไปแล้วก่อนดำเนินการอื่น'}
              </p>
              <p className="mt-1 text-sm text-amber-800">
                {language === 'en'
                  ? 'The connection failed after submission, so this sale may already exist. The basket is locked. Retry the same sale; v3 will safely return the existing transaction if it was committed.'
                  : 'การเชื่อมต่อขัดข้องหลังส่งรายการขาย รายการนี้อาจถูกบันทึกแล้ว ตะกร้าจึงถูกล็อก กรุณาลองรายการเดิมอีกครั้ง ระบบ v3 จะคืนรายการเดิมอย่างปลอดภัยหากบันทึกสำเร็จแล้ว'}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={saving || paymentMethod === ''}
            onClick={() => {
              if (paymentMethod === '') return;
              void onCompleteSale({
                paymentMethod,
                rewardId: isGuestSale ? null : (selectedRewardId || null),
              });
            }}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {language === 'en' ? 'Retry Same Sale' : 'ลองรายการเดิมอีกครั้ง'}
          </button>
        </div>
      )}

      <fieldset
        disabled={checkoutLocked}
        className={`grid min-w-0 gap-6 border-0 p-0 lg:grid-cols-[minmax(0,1fr)_360px] ${checkoutLocked ? 'opacity-70' : ''}`}
      >
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto lg:p-5">
          <div className="sticky top-0 z-10 -mx-1 -mt-1 mb-4 bg-white/95 px-1 pb-3 pt-1 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {language === 'en' ? 'Products' : 'สินค้า'}
                </h3>
                <p className="text-sm text-slate-500">
                  {language === 'en'
                    ? `${products.length} active products`
                    : `สินค้าใช้งาน ${products.length} รายการ`}
                </p>
              </div>
              {items.length > 0 && (
                <div className="rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-800">
                  {totalQuantity} {language === 'en' ? 'items' : 'ชิ้น'}
                </div>
              )}
            </div>

            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={language === 'en' ? 'Search products…' : 'ค้นหาสินค้า…'}
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-green-600 focus:bg-white focus:ring-4 focus:ring-green-100"
              />
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`whitespace-nowrap rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
                  selectedCategory === 'all'
                    ? 'border-green-700 bg-green-700 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-green-400'
                }`}
              >
                {language === 'en' ? 'All' : 'ทั้งหมด'}
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategory(category.id)}
                  className={`whitespace-nowrap rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
                    selectedCategory === category.id
                      ? 'border-green-700 bg-green-700 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-green-400'
                  }`}
                >
                  {categoryName(category)}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-72 items-center justify-center text-slate-500">
              <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
              {language === 'en' ? 'Loading products…' : 'กำลังโหลดสินค้า…'}
            </div>
          ) : loadError ? (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-6 text-center">
              <p className="font-semibold text-red-800">
                {language === 'en' ? 'Could not load the POS catalogue.' : 'ไม่สามารถโหลดแคตตาล็อก POS ได้'}
              </p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
              >
                <RefreshCw className="h-4 w-4" />
                {language === 'en' ? 'Retry' : 'ลองอีกครั้ง'}
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="min-h-72 rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              <ShoppingCart className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              <p className="font-semibold text-slate-700">
                {language === 'en' ? 'No products found' : 'ไม่พบสินค้า'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="mt-3 text-sm font-semibold text-green-700 hover:text-green-900"
              >
                {language === 'en' ? 'Reset filters' : 'รีเซ็ตตัวกรอง'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product) => {
                const quantity = quantityFor(product.id);
                const imageUrl = productImageUrl(product);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProduct(product)}
                    className="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-green-400 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-green-100"
                    aria-label={`${language === 'en' ? 'Add' : 'เพิ่ม'} ${productName(product)}`}
                  >
                    <div className="relative aspect-square overflow-hidden bg-slate-100">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <ShoppingCart className="h-9 w-9 text-slate-300" />
                        </div>
                      )}
                      {quantity > 0 && (
                        <div className="absolute right-2 top-2 flex h-8 min-w-8 items-center justify-center rounded-full bg-green-700 px-2 text-sm font-bold text-white shadow">
                          {quantity}
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 min-h-10 text-sm font-bold text-slate-900">
                        {productName(product)}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="font-bold text-green-800">฿{money(Number(product.price))}</span>
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-green-50 text-green-700 transition group-hover:bg-green-700 group-hover:text-white">
                          <Plus className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <ShoppingCart className="h-5 w-5 text-green-700" />
                {language === 'en' ? 'Current Sale' : 'รายการขายปัจจุบัน'}
              </h3>
              <p className="text-sm text-slate-500">
                {totalQuantity} {language === 'en' ? 'items' : 'ชิ้น'}
              </p>
            </div>
            {items.length > 0 && (
              <button
                type="button"
                onClick={clearSale}
                className="text-xs font-semibold text-red-600 hover:text-red-800"
              >
                {language === 'en' ? 'Clear sale' : 'ล้างรายการ'}
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="my-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <ShoppingCart className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 font-semibold text-slate-700">
                {language === 'en' ? 'No products yet' : 'ยังไม่มีสินค้า'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {language === 'en' ? 'Tap a product to add it.' : 'แตะสินค้าเพื่อเพิ่มลงในรายการ'}
              </p>
            </div>
          ) : (
            <div className="my-5 divide-y divide-slate-100 border-y border-slate-100">
              {items.map((item) => (
                <div key={item.product.id} className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{productName(item.product)}</p>
                      <p className="mt-0.5 text-sm text-slate-500">
                        ฿{money(Number(item.product.price))} {language === 'en' ? 'each' : 'ต่อชิ้น'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(item.product.id)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={language === 'en' ? 'Remove product' : 'ลบสินค้า'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50">
                      <button
                        type="button"
                        onClick={() => decrement(item.product.id)}
                        className="flex h-10 w-10 items-center justify-center rounded-l-lg text-slate-700 hover:bg-slate-200"
                        aria-label={language === 'en' ? 'Decrease quantity' : 'ลดจำนวน'}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-10 px-2 text-center font-bold text-slate-900">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => increment(item.product.id)}
                        disabled={item.quantity >= 99}
                        className="flex h-10 w-10 items-center justify-center rounded-r-lg text-slate-700 hover:bg-slate-200 disabled:opacity-30"
                        aria-label={language === 'en' ? 'Increase quantity' : 'เพิ่มจำนวน'}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="font-bold text-slate-900">
                      ฿{money(Number(item.product.price) * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-600">
                  {language === 'en' ? 'Cart subtotal' : 'ยอดรวมตะกร้า'}
                </span>
                <span className="text-2xl font-black text-slate-950">
                  ฿{money(previewSubtotal)}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {language === 'en'
                  ? 'Displayed from the catalogue. The server recalculates the authoritative total when the sale is completed.'
                  : 'ยอดนี้มาจากแคตตาล็อก เซิร์ฟเวอร์จะคำนวณยอดจริงอีกครั้งเมื่อเสร็จสิ้นการขาย'}
              </p>
            </div>

            {isGuestSale ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-bold text-slate-800">
                  {language === 'en' ? 'Guest sale' : 'การขายแบบ Guest'}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {language === 'en'
                    ? 'No loyalty reward or points will be applied. This purchase will not be attached to a customer account.'
                    : 'จะไม่มีการใช้รางวัลหรือแต้มสะสม และรายการซื้อนี้จะไม่ผูกกับบัญชีลูกค้า'}
                </p>
              </div>
            ) : (
              <LoyaltyRewardSelector
                currentBalance={currentBalance}
                language={language}
                contextAmount={previewSubtotal}
                selectedRewardId={selectedRewardId}
                onChange={setSelectedRewardId}
              />
            )}

            <div>
              <p className="mb-2 text-sm font-bold text-slate-800">
                {language === 'en' ? 'Payment' : 'การชำระเงิน'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-bold transition-colors ${
                    paymentMethod === 'cash'
                      ? 'border-green-700 bg-green-700 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-green-400'
                  }`}
                >
                  <Banknote className="h-4 w-4" />
                  {language === 'en' ? 'Cash' : 'เงินสด'}
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('qr_code')}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-bold transition-colors ${
                    paymentMethod === 'qr_code'
                      ? 'border-green-700 bg-green-700 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-green-400'
                  }`}
                >
                  <QrCode className="h-4 w-4" />
                  {language === 'en' ? 'Thai QR' : 'Thai QR'}
                </button>
              </div>
            </div>

            {!isGuestSale && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-600">
                    {language === 'en' ? 'Loyalty preview' : 'ตัวอย่างแต้มสะสม'}
                  </span>
                  <span className="font-bold text-green-800">
                    +{projectedPoints} {language === 'en' ? 'points' : 'แต้ม'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {language === 'en'
                    ? `Final points will use the server-authoritative amount paid (${loyaltyMultiplier}×).`
                    : `แต้มจริงจะใช้ยอดชำระจากเซิร์ฟเวอร์ (${loyaltyMultiplier}×)`}
                </p>
              </div>
            )}

            {checkoutError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{checkoutError}</span>
              </div>
            )}

            <button
              type="button"
              disabled={!canCompleteSale}
              onClick={() => {
                if (paymentMethod === '') return;
                void onCompleteSale({
                  paymentMethod,
                  rewardId: isGuestSale ? null : (selectedRewardId || null),
                });
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-4 text-base font-bold text-white shadow-lg transition-all hover:from-green-700 hover:to-emerald-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShoppingCart className="h-5 w-5" />}
              {saving
                ? (language === 'en' ? 'Completing sale…' : 'กำลังบันทึกการขาย…')
                : (language === 'en' ? 'Complete Sale' : 'เสร็จสิ้นการขาย')}
            </button>

            <p className="text-center text-xs text-slate-500">
              {items.length === 0
                ? (language === 'en' ? 'Add at least one product to continue.' : 'เพิ่มสินค้าอย่างน้อยหนึ่งรายการเพื่อดำเนินการต่อ')
                : paymentMethod === ''
                  ? (language === 'en' ? 'Choose Cash or Thai QR to complete the sale.' : 'เลือกเงินสดหรือ Thai QR เพื่อเสร็จสิ้นการขาย')
                  : (language === 'en' ? 'The final amount and loyalty result come from the server.' : 'ยอดสุดท้ายและแต้มสะสมจะยืนยันจากเซิร์ฟเวอร์')}
            </p>
          </div>
        </aside>
      </fieldset>
    </div>
  );
}
