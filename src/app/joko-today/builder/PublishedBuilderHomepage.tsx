import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCart } from '../../../context/CartContext';
import { useLanguage } from '../../../context/LanguageContext';
import HomePage from '../../../pages/HomePage';
import {
  BuilderPageRenderer,
  type BuilderAction,
  type BuilderDocument,
  type HomepageBuilderProviders,
} from '../../../platform/builder';
import { createJokoTodayHomepageBuilderProviders } from './homepageProviders';
import { loadPublishedHomepageBuilderDocument } from './publishedHomepageProvider';
import { jokoTodayBuilderSite } from './site';

type PublishedBuilderHomepageProps = {
  onNavigate: (page: string) => void;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; document: BuilderDocument }
  | { status: 'fallback' };

function reportHomepageFailure(context: string, error?: unknown) {
  console.error(`[Homepage Builder] ${context}`, error);
}

function createFailureReportingProviders(
  providers: HomepageBuilderProviders,
  onFailure: (context: string, error: unknown) => void,
): HomepageBuilderProviders {
  return {
    heroMedia: {
      async getHeroMedia() {
        try {
          return await providers.heroMedia.getHeroMedia();
        } catch (error) {
          onFailure('Hero media provider failed.', error);
          throw error;
        }
      },
    },
    topLiked: {
      async getTopLikedProducts() {
        try {
          return await providers.topLiked.getTopLikedProducts();
        } catch (error) {
          onFailure('Most Loved provider failed.', error);
          throw error;
        }
      },
    },
    categories: {
      async getCategories() {
        try {
          return await providers.categories.getCategories();
        } catch (error) {
          onFailure('Category provider failed.', error);
          throw error;
        }
      },
    },
  };
}

export function PublishedBuilderHomepage({ onNavigate }: PublishedBuilderHomepageProps) {
  const { language } = useLanguage();
  const { setSelectedCategory } = useCart();
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });

  const failToLegacy = useCallback((context: string, error?: unknown) => {
    reportHomepageFailure(context, error);
    setLoadState({ status: 'fallback' });
  }, []);

  const liveProviders = useMemo(() => createJokoTodayHomepageBuilderProviders(), []);
  const guardedProviders = useMemo(
    () => createFailureReportingProviders(liveProviders, failToLegacy),
    [failToLegacy, liveProviders],
  );

  useEffect(() => {
    let active = true;

    loadPublishedHomepageBuilderDocument()
      .then((published) => {
        if (!active) return;
        if (!published) {
          reportHomepageFailure('No published Homepage revision exists; using legacy Homepage.');
          setLoadState({ status: 'fallback' });
          return;
        }
        setLoadState({ status: 'ready', document: published.document });
      })
      .catch((error) => {
        if (!active) return;
        failToLegacy('Published Homepage load failed; using legacy Homepage.', error);
      });

    return () => {
      active = false;
    };
  }, [failToLegacy]);

  const handleAction = useCallback((action: BuilderAction) => {
    switch (action.type) {
      case 'commerce.openProducts':
        onNavigate('products');
        return;
      case 'site.openHowItWorks':
        onNavigate('how-it-works');
        return;
      case 'commerce.browseCategory':
        setSelectedCategory(action.categoryId);
        onNavigate('products');
        return;
    }
  }, [onNavigate, setSelectedCategory]);

  if (loadState.status === 'fallback') {
    return <HomePage onNavigate={onNavigate} />;
  }

  if (loadState.status === 'loading') {
    return <div className="min-h-[40vh]" aria-busy="true" aria-label="Loading Homepage" />;
  }

  return (
    <BuilderPageRenderer
      document={loadState.document}
      locale={language}
      site={jokoTodayBuilderSite}
      providers={guardedProviders}
      onAction={handleAction}
      onSectionError={(sectionId, error) => {
        failToLegacy(`Section ${sectionId} failed; using legacy Homepage.`, error);
      }}
    />
  );
}

export default PublishedBuilderHomepage;
