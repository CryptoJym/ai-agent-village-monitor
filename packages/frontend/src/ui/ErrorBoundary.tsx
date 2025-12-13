import React from 'react';

type ErrorBoundaryProps = {
  /** Optional name for debugging/logging */
  name?: string;
  /** Optional custom fallback UI */
  fallback?: React.ReactNode;
  /** Callback when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: Error;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, State> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console for debugging
    const name = this.props.name || 'ErrorBoundary';
    console.error(`[${name}] Caught error:`, error, errorInfo);

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI with reset button
      return (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            padding: 24,
            color: '#e5e7eb',
            background: '#1f2937',
            borderRadius: 8,
            border: '1px solid #374151',
          }}
        >
          <h2 style={{ margin: '0 0 8px', color: '#fca5a5' }}>Something went wrong</h2>
          <p style={{ margin: '0 0 16px', color: '#94a3b8' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={this.handleReset}
              style={{
                padding: '8px 16px',
                background: '#2563eb',
                color: '#fff',
                border: '1px solid #1d4ed8',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                color: '#e5e7eb',
                border: '1px solid #374151',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Refresh page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Smaller inline error boundary for components that shouldn't break the whole UI
 */
export class InlineErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[InlineErrorBoundary] Caught error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <span style={{ color: '#fca5a5', fontSize: 12 }}>Error loading component</span>
        )
      );
    }
    return this.props.children;
  }
}
