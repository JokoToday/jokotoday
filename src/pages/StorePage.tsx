import { useEffect, useMemo, useState } from 'react';
import { PackageSearch, Store } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { useLanguage } from '../context/LanguageContext';
import { getProducts, type CMSProduct } from '../lib/cmsService';
import { getPublicStoreCatalog, type StoreCategory } from '../lib/storeCatalogService';
import { supabase } from '../lib/supabase';
import { useCart } from '../context/CartContext';
import { StoreStagingPaymentHandoff } from '../components/StoreStagingPaymentHandoff';

/**
 * Phase B preview only. Store assignments are explicit, never inferred from
 * product_origin, is_non_bakery, or the legacy Beyond catalog.
 * All ordering is deliberately disabled pending physical stock reservations.
 */
export default function StorePage() {
  const { language } = useLanguage();
  const [products, setProducts] = useState<CMSProduct[]>([]);
  const [storeCategories, setStoreCategories] = useState<StoreCategory[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('all');
  const { items, addToCart, updateQuantity, setIsCartOpen } = useCart();
  const [availability, setAvailability] = useState<Record<string, { stock_on_hand: number; stock_reserved: number; pickup_today: boolean; pickup_preorder: boolean; delivery_today: boolean }>>({});
  const copy = {
    en: { title: 'JOKO Store', intro: 'Selected ingredients, useful tools, and good things worth sharing.', preview: 'A first look at our Store. Ordering will open after stock and delivery checks are ready.', empty: 'Our first Store selection is being prepared.', category: 'All products', error: 'The Store catalog is not yet available.' },
    th: { title: 'JOKO Store', intro: 'วัตถุดิบ อุปกรณ์ และของดีที่เราคัดสรร', preview: 'ตัวอย่างร้านค้า การสั่งซื้อจะเปิดเมื่อระบบสต็อกและการจัดส่งพร้อมแล้ว', empty: 'เรากำลังเตรียมสินค้าชุดแรก', category: 'สินค้าทั้งหมด', error: 'ยังไม่สามารถแสดงสินค้าของร้านได้' },
    zh: { title: 'JOKO Store', intro: '精选食材、实用工具与值得分享的好物。', preview: '商店预览。库存和配送系统验证完成后开放订购。', empty: '首批商店商品正在准备中。', category: '全部商品', error: '商店商品目录暂不可用。' },
  }[language];
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // The join table must be explicitly populated by an approved Admin workflow.
        const entries = await getPublicStoreCatalog();
        if (!active) return;
        setStoreCategories(entries.categories);
        setAssignments(Object.fromEntries(entries.assignments.map((entry) => [entry.product_id, entry.store_category_id])));
        if (entries.assignments.length === 0) { setProducts([]); return; }
        const all = await getProducts(undefined, { includeStoreOnly: true });
        const ids = new Set(entries.assignments.map((entry) => entry.product_id));
        const { data: configs, error: stockError } = await supabase.from('store_fulfillment_settings').select('product_id,stock_on_hand,stock_reserved,pickup_today,pickup_preorder,delivery_today').in('product_id', [...ids]);
        if (stockError) throw stockError;
        if (active) setAvailability(Object.fromEntries((configs || []).map((row) => [row.product_id, row])));
        if (active) setProducts(all.filter((product) => ids.has(product.id)));
      } catch {
        if (active) setError(copy.error);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [copy.error]);
  const categories = useMemo(() => storeCategories.filter((c) => c.is_active && products.some((p) => assignments[p.id] === c.id)), [storeCategories, products, assignments]);
  const shown = category === 'all' ? products : products.filter((p) => assignments[p.id] === category);
  const cartQty = (productId: string) => items.find((item) => item.product.id === productId)?.quantity || 0;
  const cartCount = items.reduce((total, item) => total + item.quantity, 0);
  const addStoreProduct = (product: CMSProduct) => {
    const max = Math.max(0, (availability[product.id]?.stock_on_hand ?? 0) - (availability[product.id]?.stock_reserved ?? 0));
    if (cartQty(product.id) >= max) return;
    addToCart({ ...product, catalog_scope: 'store_only' }, 1);
  };
  return (
    <main className="joko-mineral-field min-h-[70vh] px-4 py-12">
      <div className="mx-auto max-w-7xl">
        <StoreStagingPaymentHandoff />
        <div className="mb-8 flex items-center gap-3 text-[#303532]">
          <Store className="h-8 w-8 text-[#55766F]" aria-hidden="true" />
          <h1 className="text-4xl font-semibold">{copy.title}</h1>
        </div>
        <p className="mb-4 max-w-2xl text-lg text-[#303532]">{copy.intro}</p>
        <p className="mb-8 rounded-2xl bg-[#FFF9EE] p-4 text-sm text-[#303532]/80" role="status">{copy.preview}</p>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setIsCartOpen(true)} className="rounded-xl bg-[#55766F] px-4 py-2 text-white">
            {language === 'th' ? 'ดูตะกร้าของฉัน' : language === 'zh' ? '查看我的购物篮' : 'View My Cart'} ({cartCount})
          </button>
          <span className="text-xs text-[#303532]/70">{language === 'th' ? 'สินค้า Store อยู่ในตะกร้าเดียวกัน ยังไม่เปิดรับชำระเงิน' : language === 'zh' ? '商店商品与其他商品共用购物篮，暂不支持付款' : 'One cart for JOKO. Store checkout is not yet active.'}</span>
        </div>
        {categories.length > 1 && (
          <div className="mb-6 flex flex-wrap gap-2">
            <button type="button" onClick={() => setCategory('all')} aria-pressed={category === 'all'} className="rounded-full border border-[#55766F] px-4 py-2">{copy.category}</button>
            {categories.map((entry) => {
              const id = entry.id;
              return (
              <button key={id} type="button" onClick={() => setCategory(id)} aria-pressed={category === id} className="rounded-full border border-[#55766F] px-4 py-2">{language === 'th' ? storeCategories.find((c) => c.id === id)?.name_th : language === 'zh' ? storeCategories.find((c) => c.id === id)?.name_zh : storeCategories.find((c) => c.id === id)?.name_en}</button>
              );
            })}
          </div>
        )}
        {loading ? <div className="py-16 text-center" aria-busy="true">…</div>
          : error ? <p role="alert">{error}</p>
          : shown.length === 0 ? <div className="flex flex-col items-center gap-4 rounded-3xl bg-[#FFF9EE] p-12 text-center text-[#303532]"><PackageSearch className="h-12 w-12 text-[#55766F]" /><p>{copy.empty}</p></div>
          : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {shown.map((product) => (
                <div key={product.id}>
                  <ProductCard product={product} preview />
                  <div className="mt-2 rounded-xl bg-[#FFF9EE] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs">{availability[product.id] ? `${Math.max(0, availability[product.id].stock_on_hand - availability[product.id].stock_reserved)} in stock` : 'Stock not configured'}</span>
                      <div className="flex items-center gap-2">
                        <button type="button" aria-label={`Remove one ${product.name_en}`} disabled={!cartQty(product.id)} onClick={() => updateQuantity(product.id, cartQty(product.id) - 1)} className="rounded-lg border px-2 py-1 disabled:opacity-30">−</button>
                        <span>{cartQty(product.id)}</span>
                        <button type="button" aria-label={`Add one ${product.name_en}`} disabled={!availability[product.id] || cartQty(product.id) >= Math.max(0, availability[product.id].stock_on_hand - availability[product.id].stock_reserved)} onClick={() => addStoreProduct(product)} className="rounded-lg border px-2 py-1 disabled:opacity-30">+</button>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-[#8A4A24]">{language === 'th' ? 'เพิ่มลงตะกร้าหลัก · ยังไม่รับคำสั่งซื้อ' : language === 'zh' ? '添加到统一购物篮 · 尚未开放下单' : 'Adds to My Cart · Ordering not yet enabled'}</p>
                  </div>
                </div>
              ))}
            </div>}
      </div>
    </main>
  );
}
