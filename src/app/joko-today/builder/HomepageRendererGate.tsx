import { Component, lazy, Suspense, type ReactNode } from 'react';
import WelcomeBackCard from '../../../components/home/WelcomeBackCard';
import HomePage from '../../../pages/HomePage';
import { homepageRendererMode } from './homepageFeatureFlags';

const PublishedBuilderHomepage = lazy(() => import('./PublishedBuilderHomepage'));
const HomepageExperiencePage = lazy(() => import('../home/HomepageExperiencePage'));

type HomepageRendererGateProps = {
  onNavigate: (page: string) => void;
  onExperienceFailure?: () => void;
};

type HomepageLoadBoundaryProps = {
  fallback: ReactNode;
  children: ReactNode;
  onFailure?: () => void;
};

type HomepageLoadBoundaryState = {
  failed: boolean;
};

class HomepageLoadBoundary extends Component<HomepageLoadBoundaryProps, HomepageLoadBoundaryState> {
  state: HomepageLoadBoundaryState = { failed: false };

  static getDerivedStateFromError(): HomepageLoadBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error('[Homepage] Public renderer chunk/render failed; using legacy Homepage.', error);
    this.props.onFailure?.();
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

export function HomepageRendererGate({
  onNavigate,
  onExperienceFailure,
}: HomepageRendererGateProps) {
  let homepage: ReactNode;

  if (homepageRendererMode === 'experience') {
    homepage = (
      <HomepageLoadBoundary
        fallback={<HomePage onNavigate={onNavigate} />}
        onFailure={onExperienceFailure}
      >
        <Suspense fallback={<div className="min-h-[40vh]" aria-busy="true" aria-label="Loading Homepage" />}>
          <HomepageExperiencePage onNavigate={onNavigate} />
        </Suspense>
      </HomepageLoadBoundary>
    );
  } else if (homepageRendererMode === 'builder') {
    homepage = (
      <HomepageLoadBoundary fallback={<HomePage onNavigate={onNavigate} />}>
        <Suspense fallback={<div className="min-h-[40vh]" aria-busy="true" aria-label="Loading Homepage" />}>
          <PublishedBuilderHomepage onNavigate={onNavigate} />
        </Suspense>
      </HomepageLoadBoundary>
    );
  } else {
    homepage = <HomePage onNavigate={onNavigate} />;
  }

  return (
    <>
      {homepage}
      <WelcomeBackCard onNavigate={onNavigate} />
    </>
  );
}
