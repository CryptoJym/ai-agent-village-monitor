import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { SyncHealth } from '../../src/ui/SyncHealth';

describe('SyncHealth', () => {
  let fetchMock: ReturnType<typeof vi.spyOn>;

  const mockHealthResponse = {
    latest: {
      ts: Date.now() - 30000, // 30 seconds ago
      repos: 150,
      houses: 25,
      created: 5,
      updated: 10,
      archived: 2,
      discrepancy: 0.003, // 0.3%
    },
    recent: [
      { ts: Date.now() - 30000, repos: 150, houses: 25, created: 5, updated: 10, archived: 2, discrepancy: 0.003 },
      { ts: Date.now() - 60000, repos: 148, houses: 24, created: 3, updated: 8, archived: 1, discrepancy: 0.002 },
    ],
  };

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchMock = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.useRealTimers();
    fetchMock.mockRestore();
  });

  describe('rendering', () => {
    it('renders the component with title', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockHealthResponse,
      } as Response);

      render(<SyncHealth villageId="test-village" />);

      await waitFor(() => {
        expect(screen.getByText('Sync Health')).toBeInTheDocument();
      });
    });

    it('displays latest sync data when available', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockHealthResponse,
      } as Response);

      render(<SyncHealth villageId="test-village" />);

      await waitFor(() => {
        // Use getAllByText for values that may appear multiple times (in stats and recent)
        const discrepancyElements = screen.getAllByText(/0\.30%/);
        expect(discrepancyElements.length).toBeGreaterThan(0);
        expect(screen.getByText('150')).toBeInTheDocument(); // repos
        expect(screen.getByText('25')).toBeInTheDocument(); // houses
      });
    });

    it('displays stats grid with all values', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockHealthResponse,
      } as Response);

      render(<SyncHealth villageId="test-village" />);

      await waitFor(() => {
        expect(screen.getByText('Repos')).toBeInTheDocument();
        expect(screen.getByText('Houses')).toBeInTheDocument();
        expect(screen.getByText('Created')).toBeInTheDocument();
        expect(screen.getByText('Updated')).toBeInTheDocument();
        expect(screen.getByText('Archived')).toBeInTheDocument();
      });
    });

    it('shows recent sync runs', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockHealthResponse,
      } as Response);

      render(<SyncHealth villageId="test-village" />);

      await waitFor(() => {
        expect(screen.getByText('Recent')).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('has aria-live="polite" for live updates', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockHealthResponse,
      } as Response);

      render(<SyncHealth villageId="test-village" />);

      await waitFor(() => {
        const container = screen.getByText('Sync Health').parentElement?.parentElement;
        expect(container).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('refresh button has aria-busy attribute', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockHealthResponse,
      } as Response);

      render(<SyncHealth villageId="test-village" />);

      await waitFor(() => {
        const refreshBtn = screen.getByRole('button');
        expect(refreshBtn).toHaveAttribute('aria-busy');
      });
    });
  });

  describe('error handling', () => {
    it('displays error message on fetch failure', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      render(<SyncHealth villageId="test-village" />);

      await waitFor(() => {
        expect(screen.getByText(/HTTP 500/)).toBeInTheDocument();
      });
    });

    it('displays error message on network error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      render(<SyncHealth villageId="test-village" />);

      await waitFor(() => {
        // getErrorMessage extracts the message from the Error object
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('uses getErrorMessage for type-safe error handling', async () => {
      // Test with non-Error throw (string is returned as-is by getErrorMessage)
      fetchMock.mockRejectedValueOnce('String error');

      render(<SyncHealth villageId="test-village" />);

      await waitFor(() => {
        // getErrorMessage returns the string directly when passed a string
        expect(screen.getByText('String error')).toBeInTheDocument();
      });
    });

    it('clears data on error', async () => {
      // First successful load
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockHealthResponse,
      } as Response);

      render(<SyncHealth villageId="test-village" />);

      await waitFor(() => {
        expect(screen.getByText('150')).toBeInTheDocument();
      });

      // Simulate refresh with error
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      const refreshBtn = screen.getByRole('button');
      fireEvent.click(refreshBtn);

      await waitFor(() => {
        // The error message is directly shown, not "Failed to load sync health"
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('refresh functionality', () => {
    it('shows loading state while refreshing', async () => {
      let resolvePromise: (value: Response) => void;
      const slowPromise = new Promise<Response>((resolve) => {
        resolvePromise = resolve;
      });

      fetchMock.mockReturnValueOnce(slowPromise);

      render(<SyncHealth villageId="test-village" />);

      // Should show loading state
      await waitFor(() => {
        const btn = screen.getByRole('button');
        expect(btn).toHaveTextContent('Refreshing…');
      });

      // Resolve the promise
      resolvePromise!({
        ok: true,
        json: async () => mockHealthResponse,
      } as Response);

      await waitFor(() => {
        expect(screen.getByRole('button')).toHaveTextContent('Refresh');
      });
    });

    it('disables refresh button while loading', async () => {
      let resolvePromise: (value: Response) => void;
      const slowPromise = new Promise<Response>((resolve) => {
        resolvePromise = resolve;
      });

      fetchMock.mockReturnValueOnce(slowPromise);

      render(<SyncHealth villageId="test-village" />);

      await waitFor(() => {
        const btn = screen.getByRole('button');
        expect(btn).toBeDisabled();
      });

      resolvePromise!({
        ok: true,
        json: async () => mockHealthResponse,
      } as Response);

      await waitFor(() => {
        expect(screen.getByRole('button')).not.toBeDisabled();
      });
    });

    it('calls API with correct URL', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockHealthResponse,
      } as Response);

      render(<SyncHealth villageId="my-village-123" />);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/villages/my-village-123/sync/health',
          expect.objectContaining({ credentials: 'include' }),
        );
      });
    });

    it('encodes villageId in URL', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockHealthResponse,
      } as Response);

      render(<SyncHealth villageId="village/with/slashes" />);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/villages/village%2Fwith%2Fslashes/sync/health',
          expect.any(Object),
        );
      });
    });
  });

  describe('discrepancy warning', () => {
    it('shows green color for low discrepancy', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          latest: { ...mockHealthResponse.latest, discrepancy: 0.003 }, // 0.3%
          recent: [],
        }),
      } as Response);

      render(<SyncHealth villageId="test-village" />);

      await waitFor(() => {
        const discrepancyValue = screen.getByText('0.30%');
        expect(discrepancyValue).toHaveStyle({ color: '#a7f3d0' }); // green
      });
    });

    it('shows red color for high discrepancy', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          latest: { ...mockHealthResponse.latest, discrepancy: 0.01 }, // 1%
          recent: [],
        }),
      } as Response);

      render(<SyncHealth villageId="test-village" />);

      await waitFor(() => {
        const discrepancyValue = screen.getByText('1.00%');
        expect(discrepancyValue).toHaveStyle({ color: '#fca5a5' }); // red
      });
    });
  });

  describe('villageId changes', () => {
    it('refetches data when villageId changes', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockHealthResponse,
      } as Response);

      const { rerender } = render(<SyncHealth villageId="village-1" />);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/villages/village-1/sync/health',
          expect.any(Object),
        );
      });

      rerender(<SyncHealth villageId="village-2" />);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/villages/village-2/sync/health',
          expect.any(Object),
        );
      });
    });
  });
});
