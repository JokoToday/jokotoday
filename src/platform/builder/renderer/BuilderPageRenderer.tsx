import { PageCanvas } from '../../design-system';
import type {
  BuilderAction,
  BuilderSection,
  BuilderSiteIdentity,
} from '../contracts';
import type { HomepageBuilderProviders } from '../providers';
import { jokoBrandingCssVariables, resolveJokoHomepageBranding } from '../branding';
import { validateBuilderDocument, type BuilderValidationIssue } from '../validation';
import { BuilderSectionErrorBoundary } from './BuilderSectionErrorBoundary';
import {
  HomeCategoryGridSectionRenderer,
  HomeCtaSectionRenderer,
  HomeHeroSectionRenderer,
  HomeTopLikedSectionRenderer,
} from './sections';

export interface BuilderPageRendererProps {
  document: unknown;
  locale: string;
  site: BuilderSiteIdentity;
  providers: HomepageBuilderProviders;
  onAction?: (action: BuilderAction) => void;
  onValidationError?: (issues: BuilderValidationIssue[]) => void;
  onSectionError?: (sectionId: string, error: Error) => void;
  selectedSectionId?: string | null;
  onSectionSelect?: (sectionId: string) => void;
}

function renderSection(
  section: BuilderSection,
  props: Omit<BuilderPageRendererProps, 'document' | 'onValidationError'>,
) {
  const common = {
    locale: props.locale,
    site: props.site,
    onAction: props.onAction,
  };

  switch (section.type) {
    case 'home.hero.v1':
      return (
        <HomeHeroSectionRenderer
          section={section}
          provider={props.providers.heroMedia}
          {...common}
        />
      );

    case 'home.top-liked.v1':
      return (
        <HomeTopLikedSectionRenderer
          section={section}
          provider={props.providers.topLiked}
          {...common}
        />
      );

    case 'home.category-grid.v1':
      return (
        <HomeCategoryGridSectionRenderer
          section={section}
          provider={props.providers.categories}
          {...common}
        />
      );

    case 'home.cta.v1':
      return <HomeCtaSectionRenderer section={section} {...common} />;
  }
}

export function BuilderPageRenderer({
  document,
  locale,
  site,
  providers,
  onAction,
  onValidationError,
  onSectionError,
  selectedSectionId = null,
  onSectionSelect,
}: BuilderPageRendererProps) {
  const validation = validateBuilderDocument(document, {
    supportedLocales: site.supportedLocales,
  });

  if (!validation.ok) {
    onValidationError?.(validation.issues);
    return null;
  }

  const branding = resolveJokoHomepageBranding(validation.value.branding);

  return (
    <PageCanvas
      className="bg-[#F4EFE5]"
      style={jokoBrandingCssVariables(branding)}
    >
      {validation.value.sections
        .filter((section) => section.visible)
        .map((section) => (
          <div
            key={section.id}
            data-builder-section={section.id}
            className={[
              'relative outline-none transition',
              onSectionSelect ? 'cursor-pointer' : '',
              selectedSectionId === section.id
                ? 'ring-2 ring-inset ring-[#C76624]/80'
                : '',
            ].join(' ')}
            onClick={onSectionSelect ? (event) => {
              event.stopPropagation();
              onSectionSelect(section.id);
            } : undefined}
          >
            <BuilderSectionErrorBoundary
              onError={(error) => onSectionError?.(section.id, error)}
            >
              {renderSection(section, {
                locale,
                site,
                providers,
                onAction,
                onSectionError,
              })}
            </BuilderSectionErrorBoundary>
          </div>
        ))}
    </PageCanvas>
  );
}
