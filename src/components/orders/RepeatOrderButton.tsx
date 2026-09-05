import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, X } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { CMSProduct } from '../../lib/cmsService';
import { getCustomerPickupAvailabilityV2 } from '../../lib/pickupAvailabilityV2';
import { supabase } from '../../lib/supabase';
import { Order } from './OrderTypes';

type Language = 'en' | 'th' | 'zh';

type RepeatOrderButtonProps = {
  order: Order;
  language: Language;
  getLabel: (key: string, lang: Language, fallback: string) => string;
  variant?: 'card' | 'modal';
  onApplied?: () => void;
};

type ResolvedLine = {
  product: CMSProduct;
  quantity: number;
};

type ResolvedRepeatOrder = {
  lines: ResolvedLine[];
  totalLines: number;
  skippedLines: number;
};

type Feedback = {
  kind: 'success' | 'warning' | 'error';
  message: string;
};

type LocalizedFallback = Record<Language, string>;

const FALLBACKS = {
  orderAgain: {
    en: 'Order again',
    th: 'สั่งแบบเดิมอีกครั้ง',
    zh: '再次下单',
  },
  preparing: {
    en: 'Preparing…',
    th: 'กำลังเตรียม…',
    zh: '正在准备…',
  },
  replaceTitle: {
    en: 'Replace your current cart?',
    th: 'แทนที่ตะกร้าปัจจุบัน?',
    zh: '替换当前购物车？',
  },
  replaceMessage: {
    en: 'Ordering again will replace the items already in your cart. The pickup date from the old order will not be copied.',
    th: 'การสั่งแบบเดิมอีกครั้งจะแทนที่สินค้าที่อยู่ในตะกร้าปัจจุบัน และจะไม่นำวันรับสินค้าจากคำสั่งซื้อเดิมมาใช้',
    zh: '再次下单会替换您当前购物车中的商品，并且不会复制旧订单的取货日期。',
  },
  currentRules: {
    en: 'Current prices and availability apply. You’ll choose a new pickup date.',
    th: 'ใช้ราคาและสินค้าคงเหลือปัจจุบัน และคุณจะเลือกวันรับสินค้าใหม่',
    zh: '将使用当前价格和库存情况，您需要重新选择取货日期。',
  },
  replaceConfirm: {
    en: 'Replace cart & continue',
    th: 'แทนที่ตะกร้าและดำเนินการต่อ',
    zh: '替换购物车并继续',
  },
  keepCart: {
    en: 'Keep my cart',
    th: 'เก็บตะกร้าปัจจุบันไว้',
    zh: '保留当前购物车',
  },
  success: {
    en: 'Order copied to your cart using current prices. Choose a pickup date before checkout.',
    th: 'คัดลอกคำสั่งซื้อไปยังตะกร้าแล้วโดยใช้ราคาปัจจุบัน กรุณาเลือกวันรับสินค้าก่อนชำระเงิน',
    zh: '订单已按当前价格复制到购物车。结账前请选择新的取货日期。',
  },
  partial: {
    en: 'Added {added} of {total} items using current prices. {skipped} unavailable item(s) were skipped.',
    th: 'เพิ่มสินค้า {added} จาก {total} รายการโดยใช้ราคาปัจจุบัน ข้ามสินค้าที่ไม่พร้อมจำหน่าย {skipped} รายการ',
    zh: '已按当前价格加入 {added}/{total} 项商品，跳过了 {skipped} 项当前不可用的商品。',
  },
  unavailable: {
    en: 'None of the items from this order are currently available to reorder.',
    th: 'ขณะนี้ไม่มีสินค้าในคำสั่งซื้อนี้ที่พร้อมให้สั่งซ้ำ',
    zh: '此订单中的商品目前均无法再次下单。',
  },
  error: {
    en: 'We couldn’t check current availability. Please try again.',
    th: 'ไม่สามารถตรวจสอบสินค้าที่พร้อมจำหน่ายในขณะนี้ได้ กรุณาลองอีกครั้ง',
    zh: '暂时无法检查当前库存，请重试。',
  },
} satisfies Record<string, LocalizedFallback>;

function interpolate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.split(`{${key}}`).join(String(value)),
    template,
  );
}

export function RepeatOrderButton({
  order,
  language,
  getLabel,
  variant = 'card',
  onApplied,
}: RepeatOrderButtonProps) {
  const { items: cartItems, clearCart, addToCart, setIsCartOpen } = useCart();
  const [busy, setBusy] = useState(false);
  const [pendingRepeat, setPendingRepeat] = useState<ResolvedRepeatOrder | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const label = (key: string, fallback: LocalizedFallback) =>
    getLabel(key, language, fallback[language]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 6000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const resolveCurrentOrder = async (): Promise<ResolvedRepeatOrder> => {
    const historicalItems = Array.isArray(order.order_items) ? order.order_items : [];
    const productIds = Array.from(new Set(historicalItems.map(item => item.product_id).filter(Boolean)));

    if (productIds.length === 0) {
      return { lines: [], totalLines: historicalItems.length, skippedLines: historicalItems.length };
    }

    const [productsResult, availabilityRows] = await Promise.all([
      supabase.from('cms_products').select('*').in('id', productIds),
      getCustomerPickupAvailabilityV2(productIds),
    ]);

    if (productsResult.error) throw productsResult.error;

    const productById = new Map<string, CMSProduct>();
    (productsResult.data || []).forEach(product => {
      productById.set(product.id, product as CMSProduct);
    });

    const availabilityByProduct = new Map<string, number[]>();
    availabilityRows.forEach(row => {
      const quantities = availabilityByProduct.get(row.product_id) || [];
      quantities.push(row.remaining_quantity);
      availabilityByProduct.set(row.product_id, quantities);
    });

    const merged = new Map<string, ResolvedLine>();
    let skippedLines = 0;

    historicalItems.forEach(item => {
      const product = productById.get(item.product_id);
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const futureQuantities = availabilityByProduct.get(item.product_id) || [];
      const hasEnoughUpcomingAvailability = futureQuantities.some(remaining => remaining >= quantity);

      if (!product || !product.is_active || product.is_sold_out || !hasEnoughUpcomingAvailability) {
        skippedLines += 1;
        return;
      }

      const existing = merged.get(product.id);
      merged.set(product.id, existing
        ? { product, quantity: existing.quantity + quantity }
        : { product, quantity });
    });

    return {
      lines: Array.from(merged.values()),
      totalLines: historicalItems.length,
      skippedLines,
    };
  };

  const applyRepeatOrder = (resolved: ResolvedRepeatOrder) => {
    clearCart();
    resolved.lines.forEach(({ product, quantity }) => {
      addToCart(product, quantity, { openCart: false });
    });
    setIsCartOpen(true);
    setPendingRepeat(null);

    if (resolved.skippedLines > 0) {
      const template = label('my_orders_page.reorder_partial', FALLBACKS.partial);
      setFeedback({
        kind: 'warning',
        message: interpolate(template, {
          added: resolved.totalLines - resolved.skippedLines,
          total: resolved.totalLines,
          skipped: resolved.skippedLines,
        }),
      });
    } else {
      setFeedback({
        kind: 'success',
        message: label('my_orders_page.reorder_success', FALLBACKS.success),
      });
    }

    onApplied?.();
  };

  const handleRequest = async () => {
    if (busy) return;
    setBusy(true);
    setFeedback(null);

    try {
      const resolved = await resolveCurrentOrder();
      if (resolved.lines.length === 0) {
        setFeedback({
          kind: 'error',
          message: label('my_orders_page.reorder_unavailable', FALLBACKS.unavailable),
        });
        return;
      }

      if (cartItems.length > 0) {
        setPendingRepeat(resolved);
        return;
      }

      applyRepeatOrder(resolved);
    } catch (error) {
      console.error('Repeat order availability check failed:', error);
      setFeedback({
        kind: 'error',
        message: label('my_orders_page.reorder_error', FALLBACKS.error),
      });
    } finally {
      setBusy(false);
    }
  };

  const buttonLabel = busy
    ? label('my_orders_page.reorder_preparing', FALLBACKS.preparing)
    : label('my_orders_page.order_again', FALLBACKS.orderAgain);

  return (
    <>
      <button
        type="button"
        onClick={handleRequest}
        disabled={busy}
        className={variant === 'modal'
          ? 'mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-60'
          : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-white text-xs font-semibold transition-colors hover:bg-amber-50 disabled:opacity-60'}
        style={variant === 'modal'
          ? { background: '#9a7b2f' }
          : { borderColor: '#d9c58f', color: '#8a6d28' }}
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
        {buttonLabel}
      </button>

      {pendingRepeat && (
        <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-4">
              <RotateCcw className="w-5 h-5" style={{ color: '#9a7b2f' }} />
            </div>
            <h3 className="text-lg font-bold text-stone-900 mb-2">
              {label('my_orders_page.replace_cart_title', FALLBACKS.replaceTitle)}
            </h3>
            <p className="text-sm text-stone-600 leading-relaxed">
              {label('my_orders_page.replace_cart_message', FALLBACKS.replaceMessage)}
            </p>
            <div className="mt-4 rounded-xl px-3.5 py-3 text-xs leading-relaxed bg-amber-50 border border-amber-200 text-amber-900">
              {label('my_orders_page.current_prices_apply', FALLBACKS.currentRules)}
            </div>
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => applyRepeatOrder(pendingRepeat)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: '#9a7b2f' }}
              >
                {label('my_orders_page.replace_cart_confirm', FALLBACKS.replaceConfirm)}
              </button>
              <button
                type="button"
                onClick={() => setPendingRepeat(null)}
                className="w-full py-2.5 rounded-xl text-sm font-medium bg-stone-100 text-stone-700 hover:bg-stone-200 transition-colors"
              >
                {label('my_orders_page.replace_cart_cancel', FALLBACKS.keepCart)}
              </button>
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[90] w-[calc(100%-2rem)] max-w-lg">
          <div
            className={`rounded-xl border px-4 py-3 shadow-lg flex items-start gap-3 ${
              feedback.kind === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : feedback.kind === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            {feedback.kind === 'success'
              ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              : <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />}
            <p className="text-sm leading-relaxed flex-1">{feedback.message}</p>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
