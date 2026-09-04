import type {
  BuilderSectionSpacing,
  BuilderSectionWidth,
} from '../../contracts';

export type HomepagePuckComponentType =
  | 'HomeHero'
  | 'HomeTopLiked'
  | 'HomeCategoryGrid'
  | 'HomeCta';

export interface HomepagePuckSectionProps {
  visible: boolean;
  width: BuilderSectionWidth;
  spacing: BuilderSectionSpacing;
}

export interface HomepagePuckHeroProps extends HomepagePuckSectionProps {
  title: string;
  subtitle: string;
  primaryActionLabel: string;
  secondaryActionLabel: string;
  mediaAlt: string;
}

export interface HomepagePuckTopLikedProps extends HomepagePuckSectionProps {
  title: string;
  subtitle: string;
  browseLabel: string;
}

export interface HomepagePuckCategoryGridProps extends HomepagePuckSectionProps {
  title: string;
}

export interface HomepagePuckCtaProps extends HomepagePuckSectionProps {
  title: string;
  body: string;
  actionLabel: string;
}

export type HomepagePuckComponents = {
  HomeHero: HomepagePuckHeroProps;
  HomeTopLiked: HomepagePuckTopLikedProps;
  HomeCategoryGrid: HomepagePuckCategoryGridProps;
  HomeCta: HomepagePuckCtaProps;
};

export const builderTypeToPuckType = {
  'home.hero.v1': 'HomeHero',
  'home.top-liked.v1': 'HomeTopLiked',
  'home.category-grid.v1': 'HomeCategoryGrid',
  'home.cta.v1': 'HomeCta',
} as const;

export const puckTypeToBuilderType = {
  HomeHero: 'home.hero.v1',
  HomeTopLiked: 'home.top-liked.v1',
  HomeCategoryGrid: 'home.category-grid.v1',
  HomeCta: 'home.cta.v1',
} as const;
