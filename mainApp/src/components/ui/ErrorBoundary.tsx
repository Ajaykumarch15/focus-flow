import { Component, type ReactNode } from 'react';

// IES-P0-24: top-level error boundary so an uncaught render error (or a failed
// lazy chunk load) shows a recovery UI instead of a blank page.

type FallbackProps = {
  error: Error;
  reset: () => void;
  reload: () => void;
};

type ErrorBoundaryProps = {
  fallback?: ReactNode | ((props: FallbackProps) => ReactNode);
  onRetry?: () => void;
  children: ReactNode;
};

type ErrorBoundaryState = { error: Error | null };

function DefaultFallback({ error, reset, reload }: FallbackProps) {
  return (
    <div className="min-h-screen bg-surface-950 text-surface-50 flex items-center justify-center p-6">
      <div className="card max-w-md w-full p-8 text-center">
        <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
        <p className="text-sm text-surface-400 mb-6 break-words">{error.message}</p>
        <div className="flex gap-3 justify-center">
          <button className="btn-primary" onClick={reset} type="button">Try again</button>
          <button className="btn-secondary" onClick={reload} type="button">Reload app</button>
        </div>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('[ErrorBoundary]', error, info);
  }

  reset = () => this.setState({ error: null });

  reload = () => {
    if (this.props.onRetry) {
      this.props.onRetry();
      return;
    }
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      const { fallback } = this.props;
      const props: FallbackProps = {
        error: this.state.error,
        reset: this.reset,
        reload: this.reload,
      };
      if (typeof fallback === 'function') return fallback(props);
      return fallback ?? <DefaultFallback {...props} />;
    }
    return this.props.children;
  }
}
