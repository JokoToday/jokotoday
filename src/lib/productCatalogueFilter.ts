import type { CMSProduct } from './cmsService';

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
