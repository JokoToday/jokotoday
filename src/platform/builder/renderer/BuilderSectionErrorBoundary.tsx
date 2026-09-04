import { Component, type ErrorInfo, type ReactNode } from 'react';

interface BuilderSectionErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface BuilderSectionErrorBoundaryState {
  failed: boolean;
}

export class BuilderSectionErrorBoundary extends Component<
  BuilderSectionErrorBoundaryProps,
  BuilderSectionErrorBoundaryState
> {
  state: BuilderSectionErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): BuilderSectionErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
