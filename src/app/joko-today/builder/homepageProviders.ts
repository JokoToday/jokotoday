import { getCategories, getImageUrl, getProducts } from '../../../lib/cmsService';
import { getPublicImageUrl } from '../../../lib/storage';
import { JOKO_BAKERY_HERO_ASSET } from '../../../lib/staticAssetPolicy';
import type {
  BuilderCategory,
  BuilderTopLikedProduct,
  HomepageBuilderProviders,
} from '../../../platform/builder';

const DEFAULT_HERO_IMAGE = JOKO_BAKERY_HERO_ASSET;
const DEFAULT_PRODUCT_IMAGE = 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400';

function resolveProductImage(image?: string | null): string {
  if (!image) return DEFAULT_PRODUCT_IMAGE;
  if (image.startsWith('http')) return image;
  return getPublicImageUrl(image);
}

async function getLiveTopLikedProducts(): Promise<BuilderTopLikedProduct[]> {
  const products = await getProducts();

  return products
    .filter((product) => Boolean(product.image))
    .slice(0, 5)
    .map((product) => ({
      id: product.id,
      slug: product.slug,
      name: {
        en: product.name_en,
        th: product.name_th || product.name_en,
        zh: product.name_zh || product.name_en,
      },
      imageSrc: resolveProductImage(product.image),
      price: {
        amount: Number(product.price) || 0,
        currency: 'THB',
      },
      likeCount: 0,
    }));
}

async function getLiveCategories(): Promise<BuilderCategory[]> {
  const categories = await getCategories();

  return categories.map((category) => ({
    id: category.id,
    slug: category.slug,
    name: {
      en: category.title_en,
      th: category.title_th || category.title_en,
      zh: category.title_zh || category.title_en,
    },
    description: {
      en: category.description_en || '',
      th: category.description_th || category.description_en || '',
      zh: category.description_zh || category.description_en || '',
    },
    iconKey: category.id,
  }));
}

export function createJokoTodayHomepageBuilderProviders(): HomepageBuilderProviders {
  return {
    heroMedia: {
      async getHeroMedia() {
        const src = await getImageUrl('hero_image_url', DEFAULT_HERO_IMAGE);
        return { src };
      },
    },
    topLiked: {
      getTopLikedProducts: getLiveTopLikedProducts,
    },
    categories: {
      getCategories: getLiveCategories,
    },
  };
}
