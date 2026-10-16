import { useEffect, useMemo, useState } from 'react';
import { PackageSearch, Store } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { getProducts, type CMSProduct } from '../lib/cmsService';
import { supabase } from '../lib/supabase';

/**
 * Phase B preview only. Store assignments are explicit, never inferred from
 * product_origin, is_non_bakery, or the legacy Beyond catalog.
 * All ordering is deliberately disabled pending physical stock reservations.
 */
export default function StorePage() {
  const { language } = useLanguage();
  const [products, setProducts] = useState<CMSProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('all');
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
        const { data, error: assignmentError } = await supabase
          .from('store_product_assignments')
          .select('product_id')
          .eq('is_published', true);
        if (assignmentError) {
          // A not-yet-applied migration is a safe empty preview, not a fallback
          // to origin=beyond (which would silently misclassify maker goods).
          if (active) { setProducts([]); setError(''); }
          return;
        }
        const ids = new Set((data || []).map((row) => row.product_id));
        if (ids.size === 0) { if (active) setProducts([]); return; }
        const all = await getProducts();
        if (active) setProducts(all.filter((product) => ids.has(product.id)));
      } catch {
        if (active) setError(copy.error);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [copy.error]);
  const categories = useMemo(() => {
    const unique = new Set(products.map((product) => product.category_id).filter((value): value is string => !!value));
    return Array.from(unique);
  }, [products]);
  const shown = category === 'all' ? products : products.filter((p) => p.category_id === category);
  const name = (p: CMSProduct) => (language === 'th' ? p.name_th : language === 'zh' ? p.name_zh : p.name_en) || p.name_en;
  return (
    <main className="joko-mineral-field min-h-[70vh] px-4 py-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center gap-3 text-[#303532]">
          <Store className="h-8 w-8 text-[#55766F]" aria-hidden="true" />
          <h1 className="text-4xl font-semibold">{copy.title}</h1>
        </div>
        <p className="mb-4 max-w-2xl text-lg text-[#303532]">{copy.intro}</p>
        <p className="mb-8 rounded-2xl bg-[#FFF9EE] p-4 text-sm text-[#303532]/80" role="status">{copy.preview}</p>
        {categories.length > 1 && (
          <div className="mb-6 flex flex-wrap gap-2">
            <button type="button" onClick={() => setCategory('all')} aria-pressed={category === 'all'} className="rounded-full border border-[#55766F] px-4 py-2">{copy.category}</button>
            {categories.map((id) => (
              <button key={id} type="button" onClick={() => setCategory(id)} aria-pressed={category === id} className="rounded-full border border-[#55766F] px-4 py-2">{id}</button>
            ))}
          </div>
        )}
        {loading ? <div className="py-16 text-center" aria-busy="true">…</div>
          : error ? <p role="alert">{error}</p>
          : shown.length === 0 ? <div className="flex flex-col items-center gap-4 rounded-3xl bg-[#FFF9EE] p-12 text-center text-[#303532]"><PackageSearch className="h-12 w-12 text-[#55766F]" /><p>{copy.empty}</p></div>
          : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {shown.map((product) => (
                <article key={product.id} className="overflow-hidden rounded-3xl bg-[#FFF9EE] shadow-sm">
                  {product.image && <img src={product.image} alt={name(product)} className="aspect-square w-full object-cover" loading="lazy" />}
                  <div className="p-5">
                    <h2 className="text-lg font-semibold text-[#303532]">{name(product)}</h2>
                    <p className="mt-2 text-[#55766F]">฿{Number(product.price).toLocaleString()}</p>
                    <p className="mt-3 text-sm text-[#303532]/70">{copy.preview}</p>
                  </div>
                </article>
              ))}
            </div>}
      </div>
    </main>
  );
}
