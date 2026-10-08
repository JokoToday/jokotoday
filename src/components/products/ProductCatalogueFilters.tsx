import { Search, SlidersHorizontal, X } from 'lucide-react';
import type { CMSCategory, CMSProduct } from '../../lib/cmsService';

interface ProductCatalogueFiltersProps {
  query: string;
  categoryId: string;
  categories: CMSCategory[];
  totalCount: number;
  filteredCount: number;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
}

export function filterProductCatalogue(
  products: CMSProduct[],
  query: string,
  categoryId: string,
): CMSProduct[] {
  const needle = query.trim().toLocaleLowerCase();

  return products.filter((product) => {
    if (categoryId && product.category_id !== categoryId) return false;
    if (!needle) return true;

    return [
      product.name_en,
      product.name_th,
      product.name_zh,
      product.slug,
      product.public_code,
    ]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase().includes(needle));
  });
}

export function ProductCatalogueFilters({
  query,
  categoryId,
  categories,
  totalCount,
  filteredCount,
  onQueryChange,
  onCategoryChange,
}: ProductCatalogueFiltersProps) {
  const filtersActive = Boolean(query.trim() || categoryId);

  return (
    <div className="joko-admin-paper-card p-4 sm:p-5">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
        <label className="relative block">
          <span className="sr-only">Search products</span>
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#55766F]" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search by product name, slug or code…"
            className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#55766F]"
          />
        </label>

        <label className="relative block">
          <span className="sr-only">Filter products by category</span>
          <SlidersHorizontal className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#55766F]" aria-hidden="true" />
          <select
            value={categoryId}
            onChange={(event) => onCategoryChange(event.target.value)}
            className="w-full appearance-none rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-9 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#55766F]"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.title_en}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex min-h-6 flex-wrap items-center justify-between gap-2 text-xs text-[#303532]/60">
        <span>
          {filtersActive
            ? `${filteredCount} of ${totalCount} products shown`
            : `${totalCount} products`}
        </span>
        {filtersActive && (
          <button
            type="button"
            onClick={() => {
              onQueryChange('');
              onCategoryChange('');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium text-[#55766F] transition hover:bg-[#D9ECE9]/35 hover:text-[#304B45] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55766F]"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
