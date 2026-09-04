import type { LocalizedText } from '../contracts';

export interface BuilderMedia {
  src: string;
}

export interface BuilderMoney {
  amount: number;
  currency: string;
}

export interface BuilderTopLikedProduct {
  id: string;
  slug: string;
  name: LocalizedText;
  imageSrc: string;
  price: BuilderMoney;
  likeCount: number;
}

export interface BuilderCategory {
  id: string;
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  iconKey?: string;
}

export interface BuilderHeroMediaProvider {
  getHeroMedia(): Promise<BuilderMedia>;
}

export interface BuilderTopLikedProvider {
  getTopLikedProducts(): Promise<BuilderTopLikedProduct[]>;
}

export interface BuilderCategoryProvider {
  getCategories(): Promise<BuilderCategory[]>;
}

export interface HomepageBuilderProviders {
  heroMedia: BuilderHeroMediaProvider;
  topLiked: BuilderTopLikedProvider;
  categories: BuilderCategoryProvider;
}
