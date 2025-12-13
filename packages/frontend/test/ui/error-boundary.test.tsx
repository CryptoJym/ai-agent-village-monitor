import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ErrorBoundary, InlineErrorBoundary } from '../../src/ui/ErrorBoundary';

// Component that throws an error
function ThrowingComponent({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div data-testid="child-content">Normal content</div>;
}

// Component that throws different error types
function CustomThrowingComponent({ error }: { error: Error }) {
  throw error;
}

describe('ErrorBoundary', () => {
  // Suppress React error boundary console errors during tests
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  describe('rendering', () => {
    it('renders children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div data-testid="child">Child content</div>
        </ErrorBoundary>,
      );
      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('renders default error UI when child throws', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>,
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Test error message')).toBeInTheDocument();
    });

    it('renders custom fallback when provided', () => {
      const customFallback = <div data-testid="custom-fallback">Custom error UI</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowingComponent />
        </ErrorBoundary>,
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(screen.getByText('Custom error UI')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('renders generic message when error has no message', () => {
      function NoMessageError() {
        throw {};
      }

      render(
        <ErrorBoundary>
          <NoMessageError />
        </ErrorBoundary>,
      );

      expect(screen.getByText('An unexpected error occurred.')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has role="alert" on error container', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>,
      );

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });

    it('has aria-live="assertive" for screen reader announcement', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>,
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });

    it('has accessible buttons with proper type', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>,
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);
      buttons.forEach((btn) => {
        expect(btn).toHaveAttribute('type', 'button');
      });
    });
  });

  describe('error handling', () => {
    it('calls onError callback when error is caught', () => {
      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowingComponent />
        </ErrorBoundary>,
      );

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Test error message' }),
        expect.objectContaining({ componentStack: expect.any(String) }),
      );
    });

    it('includes boundary name in console error', () => {
      render(
        <ErrorBoundary name="GameCanvas">
          <ThrowingComponent />
        </ErrorBoundary>,
      );

      expect(consoleError).toHaveBeenCalledWith(
        '[GameCanvas] Caught error:',
        expect.any(Error),
        expect.any(Object),
      );
    });

    it('uses default name when name prop not provided', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>,
      );

      expect(consoleError).toHaveBeenCalledWith(
        '[ErrorBoundary] Caught error:',
        expect.any(Error),
        expect.any(Object),
      );
    });
  });

  describe('reset functionality', () => {
    it('Try again button resets error state', () => {
      let shouldThrow = true;
      function ConditionalThrower() {
        if (shouldThrow) throw new Error('Test');
        return <div data-testid="recovered">Recovered!</div>;
      }

      render(
        <ErrorBoundary>
          <ConditionalThrower />
        </ErrorBoundary>,
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Stop throwing before reset
      shouldThrow = false;

      const tryAgainBtn = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(tryAgainBtn);

      expect(screen.getByTestId('recovered')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('Refresh page button calls window.location.reload', () => {
      const originalLocation = window.location;
      const mockReload = vi.fn();

      // @ts-expect-error - Mocking location
      delete window.location;
      window.location = { ...originalLocation, reload: mockReload };

      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>,
      );

      const refreshBtn = screen.getByRole('button', { name: /refresh page/i });
      fireEvent.click(refreshBtn);

      expect(mockReload).toHaveBeenCalledTimes(1);

      // Restore
      window.location = originalLocation;
    });
  });

  describe('error types', () => {
    it('handles TypeError', () => {
      render(
        <ErrorBoundary>
          <CustomThrowingComponent error={new TypeError('Cannot read property')} />
        </ErrorBoundary>,
      );

      expect(screen.getByText('Cannot read property')).toBeInTheDocument();
    });

    it('handles RangeError', () => {
      render(
        <ErrorBoundary>
          <CustomThrowingComponent error={new RangeError('Invalid array length')} />
        </ErrorBoundary>,
      );

      expect(screen.getByText('Invalid array length')).toBeInTheDocument();
    });

    it('handles custom error classes', () => {
      class NetworkError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'NetworkError';
        }
      }

      render(
        <ErrorBoundary>
          <CustomThrowingComponent error={new NetworkError('Connection failed')} />
        </ErrorBoundary>,
      );

      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });
  });
});

describe('InlineErrorBoundary', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('renders children when no error occurs', () => {
    render(
      <InlineErrorBoundary>
        <span data-testid="inline-child">Inline content</span>
      </InlineErrorBoundary>,
    );

    expect(screen.getByTestId('inline-child')).toBeInTheDocument();
  });

  it('renders default inline error message on error', () => {
    render(
      <InlineErrorBoundary>
        <ThrowingComponent />
      </InlineErrorBoundary>,
    );

    expect(screen.getByText('Error loading component')).toBeInTheDocument();
  });

  it('renders custom fallback on error', () => {
    const customFallback = <span data-testid="custom-inline">Custom inline error</span>;

    render(
      <InlineErrorBoundary fallback={customFallback}>
        <ThrowingComponent />
      </InlineErrorBoundary>,
    );

    expect(screen.getByTestId('custom-inline')).toBeInTheDocument();
    expect(screen.queryByText('Error loading component')).not.toBeInTheDocument();
  });

  it('logs error to console', () => {
    render(
      <InlineErrorBoundary>
        <ThrowingComponent />
      </InlineErrorBoundary>,
    );

    expect(consoleError).toHaveBeenCalledWith(
      '[InlineErrorBoundary] Caught error:',
      expect.any(Error),
    );
  });

  it('is styled with error color', () => {
    render(
      <InlineErrorBoundary>
        <ThrowingComponent />
      </InlineErrorBoundary>,
    );

    const errorSpan = screen.getByText('Error loading component');
    expect(errorSpan).toHaveStyle({ color: '#fca5a5' });
  });

  it('has small font size for inline display', () => {
    render(
      <InlineErrorBoundary>
        <ThrowingComponent />
      </InlineErrorBoundary>,
    );

    const errorSpan = screen.getByText('Error loading component');
    expect(errorSpan).toHaveStyle({ fontSize: '12px' });
  });
});
