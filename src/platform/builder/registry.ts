import type {
  BuilderSectionSpacing,
  BuilderSectionType,
  BuilderSectionWidth,
} from './contracts';

export interface BuilderComponentCapabilities {
  reorder: boolean;
  hide: boolean;
  duplicate: boolean;
  widths: readonly BuilderSectionWidth[];
  spacings: readonly BuilderSectionSpacing[];
}

export interface BuilderComponentDefinition {
  type: BuilderSectionType;
  version: 1;
  label: string;
  maxInstances: number;
  capabilities: BuilderComponentCapabilities;
}

const standardWidths = ['standard', 'wide'] as const;
const standardSpacings = ['compact', 'standard', 'spacious', 'extraSpacious'] as const;

export const homepageComponentRegistry = {
  'home.hero.v1': {
    type: 'home.hero.v1',
    version: 1,
    label: 'Hero',
    maxInstances: 1,
    capabilities: {
      reorder: true,
      hide: true,
      duplicate: false,
      widths: standardWidths,
      spacings: ['none'] as const,
    },
  },
  'home.top-liked.v1': {
    type: 'home.top-liked.v1',
    version: 1,
    label: 'Most Loved',
    maxInstances: 1,
    capabilities: {
      reorder: true,
      hide: true,
      duplicate: false,
      widths: standardWidths,
      spacings: standardSpacings,
    },
  },
  'home.category-grid.v1': {
    type: 'home.category-grid.v1',
    version: 1,
    label: 'Category Grid',
    maxInstances: 1,
    capabilities: {
      reorder: true,
      hide: true,
      duplicate: false,
      widths: standardWidths,
      spacings: standardSpacings,
    },
  },
  'home.cta.v1': {
    type: 'home.cta.v1',
    version: 1,
    label: 'Call to Action',
    maxInstances: 1,
    capabilities: {
      reorder: true,
      hide: true,
      duplicate: false,
      widths: standardWidths,
      spacings: standardSpacings,
    },
  },
} as const satisfies Record<BuilderSectionType, BuilderComponentDefinition>;

export function isBuilderSectionType(value: unknown): value is BuilderSectionType {
  return typeof value === 'string' && value in homepageComponentRegistry;
}

export function getBuilderComponentDefinition(type: BuilderSectionType) {
  return homepageComponentRegistry[type];
}

export function listHomepageComponentDefinitions(): BuilderComponentDefinition[] {
  return Object.values(homepageComponentRegistry);
}
