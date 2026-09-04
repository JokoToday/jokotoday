import type { Config } from '@puckeditor/core';
import type {
  BuilderAction,
  BuilderDocument,
  BuilderSiteIdentity,
  BuilderSectionType,
} from '../../contracts';
import { getBuilderComponentDefinition } from '../../registry';
import type { HomepageBuilderProviders } from '../../providers';
import {
  HomeCategoryGridSectionRenderer,
  HomeCtaSectionRenderer,
  HomeHeroSectionRenderer,
  HomeTopLikedSectionRenderer,
} from '../../renderer/sections';
import { applyPuckComponentToSection } from './adapter';
import type { HomepagePuckComponents, HomepagePuckComponentType } from './types';

interface CreateHomepagePuckConfigOptions {
  document: BuilderDocument;
  locale: string;
  site: BuilderSiteIdentity;
  providers: HomepageBuilderProviders;
  onAction?: (action: BuilderAction) => void;
}

const visibilityOptions = [
  { label: 'Shown', value: true },
  { label: 'Hidden', value: false },
] as const;

function labelForValue(value: string) {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
}

function optionsFor(type: BuilderSectionType, field: 'widths' | 'spacings') {
  const definition = getBuilderComponentDefinition(type);
  return definition.capabilities[field].map((value) => ({
    label: labelForValue(value),
    value,
  }));
}

function hiddenPreview(label: string) {
  return (
    <div className="m-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
      Hidden section: {label}
    </div>
  );
}

export function createHomepagePuckConfig({
  document,
  locale,
  site,
  providers,
  onAction,
}: CreateHomepagePuckConfigOptions): Config<HomepagePuckComponents> {
  const previewSection = (
    puckType: HomepagePuckComponentType,
    props: Record<string, unknown>,
  ) => applyPuckComponentToSection(puckType, props, document, locale);

  return {
    components: {
      HomeHero: {
        label: getBuilderComponentDefinition('home.hero.v1').label,
        permissions: { delete: false, duplicate: false, insert: false },
        fields: {
          visible: { type: 'radio', options: visibilityOptions },
          width: { type: 'select', options: optionsFor('home.hero.v1', 'widths') },
          spacing: { type: 'select', options: optionsFor('home.hero.v1', 'spacings') },
          title: { type: 'text' },
          subtitle: { type: 'textarea' },
          primaryActionLabel: { type: 'text' },
          secondaryActionLabel: { type: 'text' },
          mediaAlt: { type: 'text' },
        },
        render: (props) => {
          const section = previewSection(
            'HomeHero',
            props as unknown as Record<string, unknown>,
          );
          if (!section || section.type !== 'home.hero.v1') return null;
          if (!section.visible) return hiddenPreview('Hero');
          return (
            <HomeHeroSectionRenderer
              section={section}
              locale={locale}
              site={site}
              provider={providers.heroMedia}
              onAction={onAction}
            />
          );
        },
      },

      HomeTopLiked: {
        label: getBuilderComponentDefinition('home.top-liked.v1').label,
        permissions: { delete: false, duplicate: false, insert: false },
        fields: {
          visible: { type: 'radio', options: visibilityOptions },
          width: { type: 'select', options: optionsFor('home.top-liked.v1', 'widths') },
          spacing: { type: 'select', options: optionsFor('home.top-liked.v1', 'spacings') },
          title: { type: 'text' },
          subtitle: { type: 'textarea' },
          browseLabel: { type: 'text' },
        },
        render: (props) => {
          const section = previewSection(
            'HomeTopLiked',
            props as unknown as Record<string, unknown>,
          );
          if (!section || section.type !== 'home.top-liked.v1') return null;
          if (!section.visible) return hiddenPreview('Most Loved');
          return (
            <HomeTopLikedSectionRenderer
              section={section}
              locale={locale}
              site={site}
              provider={providers.topLiked}
              onAction={onAction}
            />
          );
        },
      },

      HomeCategoryGrid: {
        label: getBuilderComponentDefinition('home.category-grid.v1').label,
        permissions: { delete: false, duplicate: false, insert: false },
        fields: {
          visible: { type: 'radio', options: visibilityOptions },
          width: { type: 'select', options: optionsFor('home.category-grid.v1', 'widths') },
          spacing: { type: 'select', options: optionsFor('home.category-grid.v1', 'spacings') },
          title: { type: 'text' },
        },
        render: (props) => {
          const section = previewSection(
            'HomeCategoryGrid',
            props as unknown as Record<string, unknown>,
          );
          if (!section || section.type !== 'home.category-grid.v1') return null;
          if (!section.visible) return hiddenPreview('Category Grid');
          return (
            <HomeCategoryGridSectionRenderer
              section={section}
              locale={locale}
              site={site}
              provider={providers.categories}
              onAction={onAction}
            />
          );
        },
      },

      HomeCta: {
        label: getBuilderComponentDefinition('home.cta.v1').label,
        permissions: { delete: false, duplicate: false, insert: false },
        fields: {
          visible: { type: 'radio', options: visibilityOptions },
          width: { type: 'select', options: optionsFor('home.cta.v1', 'widths') },
          spacing: { type: 'select', options: optionsFor('home.cta.v1', 'spacings') },
          title: { type: 'text' },
          body: { type: 'textarea' },
          actionLabel: { type: 'text' },
        },
        render: (props) => {
          const section = previewSection(
            'HomeCta',
            props as unknown as Record<string, unknown>,
          );
          if (!section || section.type !== 'home.cta.v1') return null;
          if (!section.visible) return hiddenPreview('Call to Action');
          return (
            <HomeCtaSectionRenderer
              section={section}
              locale={locale}
              site={site}
              onAction={onAction}
            />
          );
        },
      },
    },
  };
}
