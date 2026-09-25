import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Heart,
  Minus,
  Plus,
  QrCode,
  Share2,
  ShoppingBag,
} from 'lucide-react';
import { AuthModal } from '../components/AuthModal';
import ProductQRPanel from '../components/ProductQRPanel';
import { ProductPickupCalendarModalV2 } from '../components/ProductPickupCalendarModalV2';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { useLikes } from '../context/LikesContext';
import {
  CMSProduct,
  getProductByPublicCode,
  getProductBySlug,
} from '../lib/cmsService';
import { getPublicImageUrl } from '../lib/storage';
import {
  getCustomerPickupAvailabilityV2,
  PickupAvailabilityRow,
} from '../lib/pickupAvailabilityV2';
import { getPickupV2CustomerEnabled } from '../lib/pickupV2Rollout';
import { Container } from '../platform/design-system';

type SupportedLanguage = 'en' | 'th' | 'zh';

interface ProductDetailPageProps {
  productSlug?: string | null;
  publicCode?: string | null;
  entrySource?: 'qr' | 'web';
  onNavigate: (page: string) => void;
}

const copy = {
  en: {
    back: 'Back to Bakery',
    found: 'YOU FOUND THIS AT JOKO',
    foundBody: 'Want it again? Pre-order it for an upcoming pickup.',
    inactive: 'This product is not currently on the JOKO menu.',
    pickup: 'Next available pickup',
    pickupUnknown: 'Pickup availability is temporarily unavailable.',
    seeDates: 'See pickup dates',
    add: 'Add to basket',
    soldOut: 'No upcoming stock is currently available.',
    share: 'Share',
    qr: 'QR',
    copied: 'Link copied',
    about: 'About this product',
    jokoNote: 'JOKO note',
    ingredients: 'Ingredients',
    allergens: 'Allergens',
    storage: 'Storage',
    bestEnjoyed: 'Best enjoyed',
    reheating: 'Reheating',
    notFound: 'Product not found',
    notFoundBody: 'This product link may be old or unavailable.',
    loading: 'Loading product…',
  },
  th: {
    back: 'กลับไปที่เบเกอรี่',
    found: 'คุณพบสินค้านี้ที่ JOKO',
    foundBody: 'ชอบใช่ไหม? สั่งล่วงหน้าสำหรับรอบรับสินค้าครั้งถัดไปได้เลย',
    inactive: 'สินค้านี้ยังไม่มีจำหน่ายในเมนู JOKO ตอนนี้',
    pickup: 'รอบรับสินค้าถัดไป',
    pickupUnknown: 'ไม่สามารถโหลดข้อมูลรอบรับสินค้าได้ชั่วคราว',
    seeDates: 'ดูวันรับสินค้า',
    add: 'เพิ่มลงตะกร้า',
    soldOut: 'ขณะนี้ยังไม่มีสต็อกสำหรับรอบรับสินค้าถัดไป',
    share: 'แชร์',
    qr: 'QR',
    copied: 'คัดลอกลิงก์แล้ว',
    about: 'เกี่ยวกับสินค้านี้',
    jokoNote: 'บันทึกจาก JOKO',
    ingredients: 'ส่วนผสม',
    allergens: 'สารก่อภูมิแพ้',
    storage: 'การเก็บรักษา',
    bestEnjoyed: 'แนะนำการรับประทาน',
    reheating: 'การอุ่น',
    notFound: 'ไม่พบสินค้า',
    notFoundBody: 'ลิงก์สินค้านี้อาจเก่าหรือไม่พร้อมใช้งาน',
    loading: 'กำลังโหลดสินค้า…',
  },
  zh: {
    back: '返回烘焙坊',
    found: '您在 JOKO 发现了这款商品',
    foundBody: '喜欢它吗？可以提前预订下一次取货。',
    inactive: '此商品目前不在 JOKO 菜单中。',
    pickup: '最近可取货时间',
    pickupUnknown: '暂时无法加载取货信息。',
    seeDates: '查看取货日期',
    add: '加入购物篮',
    soldOut: '目前没有可预订的后续库存。',
    share: '分享',
    qr: '二维码',
    copied: '链接已复制',
    about: '关于这款商品',
    jokoNote: 'JOKO 小注',
    ingredients: '配料',
    allergens: '过敏原',
    storage: '保存方式',
    bestEnjoyed: '最佳食用',
    reheating: '加热建议',
    notFound: '未找到商品',
    notFoundBody: '此商品链接可能已过期或暂不可用。',
    loading: '正在加载商品…',
  },
} as const;

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

function localizedLocation(row: PickupAvailabilityRow, language: SupportedLanguage): string {
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

function localizedField(
  product: CMSProduct,
  language: SupportedLanguage,
  field: 'name' | 'short_desc' | 'desc' | 'joko_note' | 'ingredients' | 'allergens' | 'storage' | 'best_enjoyed' | 'reheating',
): string {
  const enKey = field === 'name' ? 'name_en' : `${field}_en`;
  const thKey = field === 'name' ? 'name_th' : `${field}_th`;
  const zhKey = field === 'name' ? 'name_zh' : `${field}_zh`;
  const record = product as unknown as Record<string, string | null | undefined>;

  if (language === 'th') return record[thKey] || record[enKey] || '';
  if (language === 'zh') return record[zhKey] || record[enKey] || '';
  return record[enKey] || '';
}

function productImage(product: CMSProduct): string {
  if (!product.image) return 'https://images.pexels.com/photos/821365/pexels-photo-821365.jpeg';
  if (product.image.startsWith('http')) return product.image;
  return getPublicImageUrl(`products/${product.image}`);
}

export default function ProductDetailPage({
  productSlug,
  publicCode,
  entrySource = 'web',
  onNavigate,
}: ProductDetailPageProps) {
  const { language } = useLanguage();
  const lang = language as SupportedLanguage;
  const labels = copy[lang];
  const { user } = useAuth();
  const { addToCart, setIsCartOpen } = useCart();
  const { isLiked, getLikeCount, toggleProductLike } = useLikes();

  const [product, setProduct] = useState<CMSProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [availabilityRows, setAvailabilityRows] = useState<PickupAvailabilityRow[]>([]);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [showQr, setShowQr] = useState(false);
  const [showPickupCalendar, setShowPickupCalendar] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const resolved = publicCode
          ? await getProductByPublicCode(publicCode)
          : productSlug
            ? await getProductBySlug(productSlug, { includeInactive: true })
            : null;

        if (cancelled) return;
        setProduct(resolved);

        if (!resolved) return;

        try {
          const v2Enabled = await getPickupV2CustomerEnabled();
          if (!v2Enabled) {
            setAvailabilityRows([]);
            return;
          }
          const rows = await getCustomerPickupAvailabilityV2([resolved.id]);
          if (!cancelled) setAvailabilityRows(rows);
        } catch (error) {
          console.error('Product detail pickup availability failed:', error);
          if (!cancelled) setAvailabilityError(true);
        }
      } catch (error) {
        console.error('Product detail load failed:', error);
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [productSlug, publicCode]);

  useEffect(() => {
    if (!product) return;
    document.title = `${localizedField(product, lang, 'name')} - JOKO TODAY`;
  }, [product, lang]);

  const nextPickup = useMemo(
    () => availabilityRows
      .filter((row) => row.remaining_quantity > 0)
      .sort((a, b) => a.pickup_date.localeCompare(b.pickup_date))[0] || null,
    [availabilityRows],
  );

  const maxQuantity = useMemo(
    () => availabilityRows.reduce((maximum, row) => Math.max(maximum, row.remaining_quantity), 0),
    [availabilityRows],
  );

  useEffect(() => {
    if (maxQuantity > 0 && quantity > maxQuantity) setQuantity(maxQuantity);
  }, [maxQuantity, quantity]);

  if (loading) {
    return (
      <div className="joko-mineral-field min-h-[70vh]">
        <Container width="wide" className="py-20 text-center text-[#303532]/60">
          {labels.loading}
        </Container>
      </div>
    );
  }

  if (loadError || !product) {
    return (
      <div className="joko-mineral-field min-h-[70vh]">
        <Container width="wide" className="py-20">
          <button type="button" onClick={() => onNavigate('products')} className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-[#3F665E]">
            <ArrowLeft className="h-4 w-4" />
            {labels.back}
          </button>
          <div className="mx-auto max-w-xl rounded-[2rem] bg-[#FFF9EE] p-10 text-center shadow-sm">
            <h1 className="text-3xl font-semibold text-[#292D2B]">{labels.notFound}</h1>
            <p className="mt-3 text-[#303532]/65">{labels.notFoundBody}</p>
          </div>
        </Container>
      </div>
    );
  }

  const name = localizedField(product, lang, 'name');
  const shortDescription = localizedField(product, lang, 'short_desc');
  const description = localizedField(product, lang, 'desc');
  const jokoNote = localizedField(product, lang, 'joko_note');
  const liked = isLiked(product.id);
  const likeCount = getLikeCount(product.id);
  const canOrder = product.is_active && !product.is_sold_out && maxQuantity > 0;
  const canonicalUrl = `${window.location.origin}/products/${encodeURIComponent(product.slug)}`;

  const toggleLike = async () => {
    if (!user) {
      setShowAuth(true);
      return;
    }
    await toggleProductLike(product.id);
  };

  const addProduct = () => {
    if (!canOrder) return;
    addToCart(product, quantity, { openCart: false });
    setIsCartOpen(true);
  };

  const shareProduct = async () => {
    const shareData = { title: `${name} - JOKO TODAY`, text: shortDescription || description, url: canonicalUrl };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    await navigator.clipboard.writeText(canonicalUrl);
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 1500);
  };

  const infoRows = [
    { key: 'ingredients', label: labels.ingredients, value: localizedField(product, lang, 'ingredients') },
    { key: 'allergens', label: labels.allergens, value: localizedField(product, lang, 'allergens') },
    { key: 'best', label: labels.bestEnjoyed, value: localizedField(product, lang, 'best_enjoyed') },
    { key: 'storage', label: labels.storage, value: localizedField(product, lang, 'storage') },
    { key: 'reheating', label: labels.reheating, value: localizedField(product, lang, 'reheating') },
  ].filter((item) => Boolean(item.value));

  return (
    <div className="joko-product-detail joko-mineral-field min-h-screen">
      <Container width="wide" className="relative z-10 py-8 sm:py-12 lg:py-14">
        <button type="button" onClick={() => onNavigate('products')} className="mb-7 inline-flex items-center gap-2 rounded-full bg-[#FFF9EE]/75 px-4 py-2 text-sm font-semibold text-[#3F665E] transition hover:bg-[#FFF9EE]">
          <ArrowLeft className="h-4 w-4" />
          {labels.back}
        </button>

        {entrySource === 'qr' && (
          <div className="mb-6 rounded-[1.5rem] border border-[#C76624]/18 bg-[#FFF4DF] px-5 py-4 sm:px-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C76624]">{labels.found}</p>
            <p className="mt-1 text-sm text-[#303532]/72">{labels.foundBody}</p>
          </div>
        )}

        <section className="overflow-hidden rounded-[2.25rem] border border-[#55766F]/14 bg-[#FFF9EE] shadow-[0_18px_50px_rgba(59,74,69,0.08)]">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
            <div className="min-h-[360px] bg-[#F0E7D9] sm:min-h-[520px]">
              <img src={productImage(product)} alt={name} className="h-full min-h-[360px] w-full object-cover sm:min-h-[520px]" />
            </div>

            <div className="flex flex-col p-6 sm:p-8 lg:p-10">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#55766F]">JOKO TODAY</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] text-[#292D2B] sm:text-5xl" style={{ fontFamily: 'var(--joko-font-display)' }}>
                {name}
              </h1>
              {shortDescription && <p className="mt-4 text-base leading-7 text-[#303532]/68">{shortDescription}</p>}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <span className="text-3xl font-bold text-[#C76624]">฿{Number(product.price).toFixed(0)}</span>
                {!product.is_active && (
                  <span className="rounded-full bg-[#E7DED0] px-3 py-1 text-xs font-semibold text-[#6C6256]">{labels.inactive}</span>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <button type="button" onClick={() => void toggleLike()} className="inline-flex items-center gap-2 rounded-full border border-[#55766F]/20 bg-white/65 px-4 py-2.5 text-sm font-semibold text-[#303532]">
                  <Heart className={`h-4 w-4 ${liked ? 'fill-[#C76624] stroke-[#C76624]' : ''}`} />
                  {likeCount > 0 ? likeCount : ''}
                </button>
                <button type="button" onClick={() => void shareProduct()} className="inline-flex items-center gap-2 rounded-full border border-[#55766F]/20 bg-white/65 px-4 py-2.5 text-sm font-semibold text-[#303532]">
                  {shareCopied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                  {shareCopied ? labels.copied : labels.share}
                </button>
                {product.public_code && (
                  <button type="button" onClick={() => setShowQr(true)} className="inline-flex items-center gap-2 rounded-full border border-[#55766F]/20 bg-white/65 px-4 py-2.5 text-sm font-semibold text-[#303532]">
                    <QrCode className="h-4 w-4" />
                    {labels.qr}
                  </button>
                )}
              </div>

              <div className="mt-7 rounded-[1.5rem] border border-[#55766F]/12 bg-white/55 p-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-xl bg-[#CFE3DF]/75 p-2.5 text-[#3F665E]">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#303532]/45">{labels.pickup}</p>
                    {availabilityError ? (
                      <p className="mt-2 text-sm text-[#303532]/65">{labels.pickupUnknown}</p>
                    ) : nextPickup ? (
                      <>
                        <p className="mt-2 font-semibold text-[#303532]">
                          {formatPickupDate(nextPickup.pickup_date, lang)} · {localizedLocation(nextPickup, lang)}
                        </p>
                        <p className="mt-1 text-sm text-[#303532]/58">
                          {lang === 'th' ? `เหลือ ${nextPickup.remaining_quantity} ชิ้น` : lang === 'zh' ? `剩余 ${nextPickup.remaining_quantity} 件` : `${nextPickup.remaining_quantity} remaining`}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-[#303532]/65">{labels.soldOut}</p>
                    )}
                  </div>
                </div>
                {product.is_active && (
                  <button type="button" onClick={() => setShowPickupCalendar(true)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#55766F]/25 px-4 py-3 text-sm font-semibold text-[#3F665E] hover:bg-[#CFE3DF]/30">
                    <CalendarDays className="h-4 w-4" />
                    {labels.seeDates}
                  </button>
                )}
              </div>

              {canOrder && (
                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-center gap-4">
                    <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="rounded-full border border-[#55766F]/20 bg-white p-2.5 text-[#303532]">
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-12 text-center text-lg font-semibold text-[#303532]">{quantity}</span>
                    <button type="button" onClick={() => setQuantity((value) => Math.min(maxQuantity || 99, value + 1))} className="rounded-full border border-[#55766F]/20 bg-white p-2.5 text-[#303532]">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <button type="button" onClick={addProduct} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#C76624] px-5 py-3.5 font-semibold text-white hover:bg-[#A95120]">
                    <ShoppingBag className="h-5 w-5" />
                    {labels.add}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto mt-8 max-w-5xl rounded-[2rem] border border-[#55766F]/12 bg-[#FFF9EE]/92 p-6 sm:p-8 lg:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#55766F]">{labels.about}</p>
          {description && <p className="mt-4 max-w-3xl text-base leading-8 text-[#303532]/76 sm:text-lg">{description}</p>}

          {jokoNote && (
            <div className="mt-7 rounded-[1.5rem] bg-[#CFE3DF]/45 p-5 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#3F665E]">{labels.jokoNote}</p>
              <p className="mt-2 text-lg font-medium leading-7 text-[#303532]">{jokoNote}</p>
            </div>
          )}

          {infoRows.length > 0 && (
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {infoRows.map((item) => (
                <div key={item.key} className="rounded-[1.35rem] border border-[#55766F]/12 bg-white/60 p-5">
                  <h2 className="text-sm font-bold text-[#3F665E]">{item.label}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#303532]/72">{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </Container>

      {showQr && <ProductQRPanel product={product} onClose={() => setShowQr(false)} />}
      <ProductPickupCalendarModalV2
        product={product}
        quantity={quantity}
        isOpen={showPickupCalendar}
        onClose={() => setShowPickupCalendar(false)}
      />
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
    </div>
  );
}
