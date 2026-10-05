import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, CheckCircle2, Search } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { getProducts, type CMSProduct } from '../lib/cmsService';
import { supabase } from '../lib/supabase';
import { getPublicImageUrl } from '../lib/storage';

type CurationChanges = Pick<CMSProduct, 'is_non_bakery' | 'non_bakery_feature_order'>;

const thumbnail = (product: CMSProduct) =>
  product.image
    ? product.image.startsWith('http') ? product.image : getPublicImageUrl(product.image)
    : null;

export function NonBakeryManagement() {
  const { language } = useLanguage();
  const [products, setProducts] = useState<CMSProduct[]>([]);
  const [query, setQuery] = useState('');
  const [onlyNonBakery, setOnlyNonBakery] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      setProducts(await getProducts());
      setError('');
    } catch (cause) {
      console.error('Could not load non-bakery curation:', cause);
      setError('Unable to load catalogue products. Check that the database migration has been applied.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const chosen = useMemo(() =>
    products.filter((product) => product.is_non_bakery), [products]);
  const featured = useMemo(() =>
    chosen.filter((product) => product.non_bakery_feature_order != null)
      .sort((a, b) =>
        (a.non_bakery_feature_order ?? 999) - (b.non_bakery_feature_order ?? 999)
        || a.sort_order - b.sort_order
      ), [chosen]);
  const visible = useMemo(() => products.filter((product) =>
    (!onlyNonBakery || product.is_non_bakery)
    && [product.name_en, product.name_th, product.name_zh ?? '', product.slug]
      .some((value) => value.toLowerCase().includes(query.trim().toLowerCase()))
  ), [products, query, onlyNonBakery]);

  const update = async (product: CMSProduct, changes: CurationChanges) => {
    if (pendingId) return;
    setPendingId(product.id);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('cms_products')
        .update(changes)
        .eq('id', product.id);
      if (updateError) throw updateError;
      setProducts((current) =>
        current.map((candidate) =>
          candidate.id === product.id ? { ...candidate, ...changes } : candidate
        ),
      );
    } catch (cause) {
      console.error('Could not update non-bakery product:', cause);
      setError('Could not save the selection. No other product details were changed.');
    } finally {
      setPendingId(null);
    }
  };

  const nextPosition = () =>
    Math.max(0, ...featured.map((product) => product.non_bakery_feature_order ?? 0)) + 1;

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <p className="joko-admin-eyebrow">Homepage &amp; catalogue curation</p>
      <h1 className="joko-admin-title mt-2 text-3xl font-semibold">Not Bread. Still Good.</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#303532]/75">
        First identify products as <strong>Non-bakery</strong> (independent of their normal catalogue category),
        then choose the ones to feature on the homepage. Only active products are shown here. Checkout
        suggests eligible Non-bakery products for the customer’s selected pickup day.
      </p>
      <div className="mt-5 flex flex-wrap gap-3 text-xs font-medium">
        <span className="rounded-full bg-[#D5E8E2] px-3 py-2 text-[#304B45]">{chosen.length} non-bakery products</span>
        <span className="rounded-full bg-[#EEDBC4] px-3 py-2 text-[#795022]">{featured.length} featured on homepage</span>
      </div>

      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <label className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-xl border border-[#55766F]/20 bg-white/80 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-[#55766F]" />
          <span className="sr-only">Search products</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products…"
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-[#304B45]">
          <input type="checkbox" checked={onlyNonBakery} onChange={(event) => setOnlyNonBakery(event.target.checked)} />
          Non-bakery only
        </label>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-[#303532]/70">Loading catalogue…</p>
      ) : (
        <div className="mt-5 grid gap-3">
          {visible.map((product) => {
            const name = language === 'th'
              ? product.name_th
              : language === 'zh' ? product.name_zh || product.name_en : product.name_en;
            const image = thumbnail(product);
            const selected = Boolean(product.is_non_bakery);
            const homepage = selected && product.non_bakery_feature_order != null;
            return (
              <div key={product.id} className="grid gap-3 rounded-2xl border border-[#55766F]/[.16] bg-[#FFF9EE] p-4 sm:grid-cols-[4rem_minmax(0,1fr)_auto] sm:items-center">
                <div className="h-16 w-16 overflow-hidden rounded-xl bg-[#E9E0D0]">
                  {image && <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[#303532]">{name}</p>
                  <p className="truncate text-xs text-[#303532]/55">{product.slug} · ฿{product.price}</p>
                  <a href={`/products/${encodeURIComponent(product.slug)}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-[#A44F1D]">
                    Catalogue entry <ArrowUpRight className="h-3 w-3" />
                  </a>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={pendingId !== null}
                      onChange={(event) => {
                        void update(product, {
                          is_non_bakery: event.target.checked,
                          non_bakery_feature_order: event.target.checked
                            ? product.non_bakery_feature_order ?? null : null,
                        });
                      }}
                    />
                    Non-bakery
                  </label>
                  <label className={`inline-flex items-center gap-2 text-sm ${!selected ? 'opacity-50' : 'cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      checked={homepage}
                      disabled={!selected || pendingId !== null}
                      onChange={(event) => {
                        void update(product, {
                          is_non_bakery: selected,
                          non_bakery_feature_order: event.target.checked ? Math.min(nextPosition(), 999) : null,
                        });
                      }}
                    />
                    Show on homepage
                  </label>
                  {homepage && (
                    <label className="inline-flex items-center gap-2 text-xs text-[#304B45]">
                      Position
                      <input
                        type="number"
                        min={1}
                        max={999}
                        key={product.non_bakery_feature_order}
                        defaultValue={product.non_bakery_feature_order ?? 1}
                        disabled={pendingId !== null}
                        onBlur={(event) => {
                          const order = Number(event.target.value);
                          if (!Number.isInteger(order) || order < 1 || order > 999
                            || order === product.non_bakery_feature_order) return;
                          void update(product, { is_non_bakery: true, non_bakery_feature_order: order });
                        }}
                        className="w-16 rounded-md border border-[#55766F]/25 bg-white px-2 py-1 text-sm"
                        aria-label={`Homepage position for ${product.name_en}`}
                      />
                    </label>
                  )}
                  {pendingId === product.id && <span className="text-xs text-[#55766F]">Saving…</span>}
                  {homepage && <CheckCircle2 className="h-4 w-4 text-[#55766F]" aria-label="Featured" />}
                </div>
              </div>
            );
          })}
          {visible.length === 0 && <p className="p-8 text-center text-sm text-[#303532]/60">No products match this filter.</p>}
        </div>
      )}
      <p className="mt-5 text-xs leading-5 text-[#303532]/60">
        Changing a feature selection never creates a duplicate catalogue product or changes its price, stock,
        or pickup availability. Positions are sorted ascending; ties use the catalogue sort order.
      </p>
    </section>
  );
}

export default NonBakeryManagement;
