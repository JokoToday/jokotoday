import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Plus, ShoppingBasket } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { getProducts, type CMSProduct } from '../lib/cmsService';
import { type PickupDay, isDayOpenForOrdering } from '../lib/availabilityService';
import {
  getCustomerPickupAvailabilityV2,
  type PickupAvailabilityRow,
} from '../lib/pickupAvailabilityV2';
import { getPublicImageUrl } from '../lib/storage';

interface NonBakeryCheckoutSuggestionsProps {
  /** V2 authoritative concrete pickup date. */
  pickupDateId?: string;
  /** Legacy checkout selection; never offer items for an unconfirmed day. */
  legacyPickupDay?: PickupDay | null;
  onProductClick?: (product: CMSProduct) => void;
}

const copy = {
  en: {
    title: 'Want more than bread?',
    helper: 'A few non-bakery finds you can add for the same pickup.',
    add: 'Add',
    view: 'Details',
  },
  th: {
    title: 'อยากได้มากกว่าเบเกอรี่ไหม?',
    helper: 'ของดีที่ไม่ใช่เบเกอรี่ เพิ่มลงในวันรับสินค้าเดิมได้',
    add: 'เพิ่ม',
    view: 'รายละเอียด',
  },
  zh: {
    title: '还想加点烘焙之外的好东西？',
    helper: '这些非烘焙精选商品也能在同一取货日领取。',
    add: '添加',
    view: '详情',
  },
};

function thumbnail(product: CMSProduct): string | null {
  if (!product.image) return null;
  return product.image.startsWith('http')
    ? product.image : getPublicImageUrl(product.image);
}

function eligibleForLegacyDay(product: CMSProduct, day: PickupDay): boolean {
  if (!isDayOpenForOrdering(day) || product.is_sold_out || product.stock_remaining <= 0) return false;
  const aliases = [day.day_key, day.label, day.label_en, day.label_th, day.label_zh]
    .filter((value): value is string => Boolean(value));
  const availableDays = product.available_days ?? [];
  if (availableDays.length && !aliases.some((value) => availableDays.includes(value))) return false;

  // Legacy inventory may be tracked by day; don't recommend a known empty slot.
  const dayStock = product.stock_by_day ?? {};
  const matchingStock = aliases.find((value) => Object.prototype.hasOwnProperty.call(dayStock, value));
  return !matchingStock || Number(dayStock[matchingStock]) > 0;
}

export function NonBakeryCheckoutSuggestions({
  pickupDateId,
  legacyPickupDay,
  onProductClick,
}: NonBakeryCheckoutSuggestionsProps) {
  const { items, addToCart } = useCart();
  const { language } = useLanguage();
  const text = copy[language === 'th' || language === 'zh' ? language : 'en'];
  const [products, setProducts] = useState<CMSProduct[]>([]);
  const [remaining, setRemaining] = useState<Map<string, number>>(new Map());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!pickupDateId && !legacyPickupDay) {
      setReady(false);
      return;
    }
    let cancelled = false;
    setReady(false);
    void (async () => {
      try {
        const catalog = (await getProducts())
          .filter((product) => product.is_non_bakery && !product.is_sold_out)
          .sort((a, b) =>
            (a.non_bakery_feature_order ?? 1000) - (b.non_bakery_feature_order ?? 1000)
            || a.sort_order - b.sort_order
          );
        if (cancelled) return;
        if (!pickupDateId) {
          setProducts(catalog);
          setRemaining(new Map());
          return;
        }

        const rows: PickupAvailabilityRow[] = catalog.length
          ? await getCustomerPickupAvailabilityV2(catalog.map((product) => product.id))
          : [];
        if (cancelled) return;
        const available = new Map<string, number>();
        rows.filter((row) => row.pickup_date_id === pickupDateId && row.remaining_quantity > 0)
          .forEach((row) => {
            available.set(row.product_id, Math.max(available.get(row.product_id) || 0, row.remaining_quantity));
          });
        setProducts(catalog);
        setRemaining(available);
      } catch (error) {
        console.error('Could not load non-bakery suggestions:', error);
        if (!cancelled) {
          setProducts([]);
          setRemaining(new Map());
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [pickupDateId, legacyPickupDay?.id]);

  const alreadyInCart = useMemo(() => new Set(items.map((item) => item.product.id)), [items]);
  const suggestions = useMemo(() => {
    if (!pickupDateId && !legacyPickupDay) return [];
    return products.filter((product) =>
      !alreadyInCart.has(product.id)
      && (pickupDateId
        ? (remaining.get(product.id) || 0) > 0
        : Boolean(legacyPickupDay && eligibleForLegacyDay(product, legacyPickupDay)))
    ).slice(0, 4);
  }, [products, alreadyInCart, remaining, pickupDateId, legacyPickupDay]);

  if (!ready || suggestions.length === 0) return null;

  return (
    <section
      className="rounded-[1.5rem] border border-[#C76624]/20 bg-[#FFF4E6]/85 p-4"
      aria-label={text.title}
    >
      <div className="mb-4 flex items-start gap-2.5">
        <ShoppingBasket className="mt-0.5 h-5 w-5 shrink-0 text-[#B65B28]" />
        <div>
          <h3 className="font-semibold text-[#303532]">{text.title}</h3>
          <p className="mt-1 text-xs leading-5 text-[#303532]/70">{text.helper}</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {suggestions.map((product) => {
          const name = language === 'th' ? product.name_th : language === 'zh'
            ? product.name_zh || product.name_en : product.name_en;
          const image = thumbnail(product);
          return (
            <article key={product.id} className="flex items-center gap-2 rounded-xl border border-[#C76624]/12 bg-white/80 p-2.5">
              <button
                type="button"
                disabled={!onProductClick}
                onClick={() => onProductClick?.(product)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55766F]"
              >
                {image ? (
                  <img src={image} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" loading="lazy" />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#E9E0D0]">
                    <ShoppingBasket className="h-5 w-5 text-[#55766F]/60" />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-[#303532]">{name}</span>
                  <span className="block text-xs font-semibold text-[#A44F1D]">฿{product.price}</span>
                  {onProductClick && <span className="mt-1 inline-flex items-center gap-0.5 text-[11px] text-[#55766F]">{text.view}<ArrowUpRight className="h-3 w-3" /></span>}
                </span>
              </button>
              <button
                type="button"
                onClick={() => addToCart(product, 1, { openCart: false })}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#C76624] px-2.5 py-2 text-xs font-semibold text-white hover:bg-[#A95120]"
                aria-label={`${text.add} ${name}`}
              >
                <Plus className="h-3.5 w-3.5" /> {text.add}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default NonBakeryCheckoutSuggestions;
