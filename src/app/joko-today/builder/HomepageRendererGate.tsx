import { Component, lazy, Suspense, type ReactNode } from 'react';
import HomePage from '../../../pages/HomePage';
import { homepageRendererMode } from './homepageFeatureFlags';

const PublishedBuilderHomepage = lazy(() => import('./PublishedBuilderHomepage'));

type HomepageRendererGateProps = {
  onNavigate: (page: string) => void;
};

type BuilderLoadBoundaryProps = {
  fallback: ReactNode;
  children: ReactNode;
};

type BuilderLoadBoundaryState = {
  failed: boolean;
};

class BuilderLoadBoundary extends Component<BuilderLoadBoundaryProps, BuilderLoadBoundaryState> {
  state: BuilderLoadBoundaryState = { failed: false };

  static getDerivedStateFromError(): BuilderLoadBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error('[Homepage Builder] Public renderer chunk/render failed; using legacy Homepage.', error);
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

export function HomepageRendererGate({ onNavigate }: HomepageRendererGateProps) {
  if (homepageRendererMode !== 'builder') {
    return <HomePage onNavigate={onNavigate} />;
  }

  return (
    <BuilderLoadBoundary fallback={<HomePage onNavigate={onNavigate} />}>
      <Suspense fallback={<div className="min-h-[40vh]" aria-busy="true" aria-label="Loading Homepage" />}>
        <PublishedBuilderHomepage onNavigate={onNavigate} />
      </Suspense>
    </BuilderLoadBoundary>
  );
}
