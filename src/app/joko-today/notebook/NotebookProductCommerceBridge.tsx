import { Check, ExternalLink, Minus, Plus, ShoppingBag } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useCart } from '../../../context/CartContext';
import { useLanguage } from '../../../context/LanguageContext';
import type { CMSProduct } from '../../../lib/cmsService';
import {
  getCustomerPickupAvailabilityV2,
  type PickupAvailabilityRow,
} from '../../../lib/pickupAvailabilityV2';
import { getPickupV2CustomerEnabled } from '../../../lib/pickupV2Rollout';
import { getPublicImageUrl } from '../../../lib/storage';

interface NotebookProductCommerceBridgeProps {
  product: CMSProduct;
  onOpenBakery: () => void;
}

type LanguageCode = 'en' | 'th' | 'zh';

const copy = {
  en: {
    eyebrow: 'Live from the bakery',
    price: 'Current price',
    available: 'Available to pre-order',
    soldOut: 'Sold out for upcoming pickup',
    checking: 'Checking pickup availability…',
    unavailable: 'Pickup availability is temporarily unavailable.',
    earliest: 'Earliest pickup',
    upcomingCapacity: (count: number) => `Up to ${count} for an upcoming pickup`,
    stockLeft: (count: number) => `${count} left`,
    add: 'Add to order',
    added: 'Added to your order',
    viewBakery: 'View in bakery',
    helper: 'Choose what you like here. Pickup Finder in your basket will find a date when your order can be collected together.',
  },
  th: {
    eyebrow: 'ข้อมูลสดจากเบเกอรี่',
    price: 'ราคาปัจจุบัน',
    available: 'พร้อมให้สั่งล่วงหน้า',
    soldOut: 'สินค้าหมดสำหรับรอบรับสินค้าที่กำลังจะมาถึง',
    checking: 'กำลังตรวจสอบวันรับสินค้า…',
    unavailable: 'ไม่สามารถตรวจสอบวันรับสินค้าได้ชั่วคราว',
    earliest: 'รับได้เร็วที่สุด',
    upcomingCapacity: (count: number) => `สั่งได้สูงสุด ${count} ชิ้นในรอบรับสินค้าที่กำลังจะมาถึง`,
    stockLeft: (count: number) => `เหลือ ${count} ชิ้น`,
    add: 'เพิ่มลงในออเดอร์',
    added: 'เพิ่มลงในออเดอร์แล้ว',
    viewBakery: 'ดูในหน้าเบเกอรี่',
    helper: 'เลือกสิ่งที่คุณชอบได้จากตรงนี้ แล้ว Pickup Finder ในตะกร้าจะหาวันที่สินค้าทุกชิ้นรับพร้อมกันได้',
  },
  zh: {
    eyebrow: '烘焙坊实时信息',
    price: '当前价格',
    available: '可预订',
    soldOut: '近期取货已售罄',
    checking: '正在查询取货日期…',
    unavailable: '暂时无法查询取货信息。',
    earliest: '最早取货',
    upcomingCapacity: (count: number) => `近期取货最多可订 ${count} 件`,
    stockLeft: (count: number) => `剩余 ${count} 件`,
    add: '加入订单',
    added: '已加入订单',
    viewBakery: '在烘焙坊中查看',
    helper: '先在这里选好喜欢的商品，购物篮里的 Pickup Finder 会查找可以一起取货的日期。',
  },
} as const;

function formatPickupDate(value: string, language: LanguageCode): string {
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

function pickupDestination(row: PickupAvailabilityRow, language: LanguageCode): string {
  if (row.locations.length === 1) {
    const location = row.locations[0];
    if (language === 'th') return location.name_th || location.name_en;
    if (language === 'zh') return location.name_zh || location.name_en;
    return location.name_en;
  }
  if (language === 'th') return row.schedule_label_th || row.schedule_label_en;
  if (language === 'zh') return row.schedule_label_zh || row.schedule_label_en;
  return row.schedule_label_en;
}
function productImage(product: CMSProduct): string | null {
  if (!product.image) return null;
  return product.image.startsWith('http')
    ? product.image
    : getPublicImageUrl(`products/${product.image}`);
}

export function NotebookProductCommerceBridge({
  product,
  onOpenBakery,
}: NotebookProductCommerceBridgeProps) {
  const { language } = useLanguage();
  const lang: LanguageCode = language === 'th' || language === 'zh' ? language : 'en';
  const labels = copy[lang];
  const { items, addToCart } = useCart();
  const [pickupV2Enabled, setPickupV2Enabled] = useState(false);
  const [rows, setRows] = useState<PickupAvailabilityRow[]>([]);
  const [checkingAvailability, setCheckingAvailability] = useState(true);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let active = true;
    setCheckingAvailability(true);
    setAvailabilityError(false);
    setRows([]);

    void (async () => {
      try {
        const enabled = await getPickupV2CustomerEnabled();
        if (!active) return;
        setPickupV2Enabled(enabled);
        if (!enabled) return;
        const nextRows = await getCustomerPickupAvailabilityV2([product.id]);
        if (active) setRows(nextRows);
      } catch (error) {
        console.error('Could not load Notebook product pickup availability:', error);
        if (active) setAvailabilityError(true);
      } finally {
        if (active) setCheckingAvailability(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [product.id]);

  const positiveRows = useMemo(
    () => rows.filter((row) => row.remaining_quantity > 0).sort((a, b) => a.pickup_date.localeCompare(b.pickup_date)),
    [rows],
  );
  const earliest = positiveRows[0] || null;
  const maximumAvailable = pickupV2Enabled
    ? positiveRows.reduce((maximum, row) => Math.max(maximum, row.remaining_quantity), 0)
    : Math.max(0, product.stock_remaining || 0);
  const cartQuantity = items.find((item) => item.product.id === product.id)?.quantity || 0;
  const remainingToAdd = Math.max(0, maximumAvailable - cartQuantity);
  const soldOut = product.is_sold_out
    || (!checkingAvailability && !availabilityError && maximumAvailable <= 0);
  const canAdd = !checkingAvailability && !availabilityError && !soldOut && remainingToAdd > 0;
  const image = productImage(product);
  const name = lang === 'th'
    ? product.name_th || product.name_en
    : lang === 'zh'
      ? product.name_zh || product.name_en
      : product.name_en;

  useEffect(() => {
    if (remainingToAdd <= 0) {
      setQuantity(1);
      return;
    }
    setQuantity((current) => Math.min(Math.max(1, current), remainingToAdd));
  }, [remainingToAdd]);

  const handleAdd = () => {
    if (!canAdd) return;
    addToCart(product, quantity);
    setAdded(true);
    setQuantity(1);
    window.setTimeout(() => setAdded(false), 1800);
  };

  return (
    <aside className="mx-auto mt-5 max-w-6xl rounded-2xl border border-primary-900/10 bg-background-secondary/45 p-4 shadow-sm sm:p-5" aria-label={labels.eyebrow}>
      <div className="grid gap-5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center">
        {image && (
          <img src={image} alt={name} className="h-28 w-full rounded-xl object-cover sm:h-28 sm:w-32" loading="lazy" />
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-700">{labels.eyebrow}</p>
              <h3 className="mt-1 font-header text-2xl font-semibold text-primary-950">{name}</h3>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">{labels.price}</p>
              <p className="font-header text-2xl font-semibold text-primary-950">฿{product.price}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium">
            {checkingAvailability ? (
              <span className="rounded-full bg-gray-100 px-3 py-1.5 text-gray-600">{labels.checking}</span>
            ) : availabilityError ? (
              <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-800">{labels.unavailable}</span>
            ) : soldOut ? (
              <span className="rounded-full bg-red-50 px-3 py-1.5 text-red-700">{labels.soldOut}</span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-green-700">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                {labels.available}
              </span>
            )}
            {!checkingAvailability && !availabilityError && maximumAvailable > 0 && (
              <span className="rounded-full bg-primary-50 px-3 py-1.5 text-primary-800">{pickupV2Enabled ? labels.upcomingCapacity(maximumAvailable) : labels.stockLeft(maximumAvailable)}</span>
            )}
          </div>

          {pickupV2Enabled && earliest && (
            <p className="mt-3 text-sm text-gray-700">
              <span className="font-semibold text-primary-950">{labels.earliest}:</span>{' '}
              {formatPickupDate(earliest.pickup_date, lang)} · {pickupDestination(earliest, lang)}
            </p>
          )}
          <p className="mt-2 max-w-2xl text-xs leading-5 text-gray-500">{labels.helper}</p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center rounded-full border border-primary-900/10 bg-background p-1">
              <button
                type="button"
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                disabled={!canAdd || quantity <= 1}
                className="flex h-9 w-9 items-center justify-center rounded-full text-primary-950 transition hover:bg-primary-50 disabled:opacity-35"
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="min-w-9 text-center text-sm font-semibold text-primary-950">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((current) => Math.min(Math.max(1, remainingToAdd), current + 1))}
                disabled={!canAdd || quantity >= remainingToAdd}
                className="flex h-9 w-9 items-center justify-center rounded-full text-primary-950 transition hover:bg-primary-50 disabled:opacity-35"
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!canAdd}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {added ? <Check className="h-4 w-4" aria-hidden="true" /> : <ShoppingBag className="h-4 w-4" aria-hidden="true" />}
              {added ? labels.added : labels.add}
            </button>
            <button
              type="button"
              onClick={onOpenBakery}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-primary-900/15 bg-background px-5 py-2.5 text-sm font-semibold text-primary-950 transition hover:bg-primary-50"
            >
              {labels.viewBakery}
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default NotebookProductCommerceBridge;
