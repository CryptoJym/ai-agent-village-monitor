import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ControlTab } from '../../src/ui/ControlTab';
import { ToastProvider } from '../../src/ui/Toast';

describe('ControlTab', () => {
  beforeEach(() => {
    // @ts-ignore
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, status: 202 }));
    // @ts-ignore
    global.confirm = vi.fn(() => true);
  });

  function renderWithProviders() {
    return render(
      <ToastProvider>
        <ControlTab agentId="a-1" />
      </ToastProvider>,
    );
  }

  it('calls run_tool and disables during in-flight', async () => {
    renderWithProviders();
    const btn = screen.getAllByTestId('btn-run-tool')[0] as HTMLButtonElement;
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
    await waitFor(() => expect(btn).not.toBeDisabled());
    expect(global.fetch).toHaveBeenCalledWith('/api/agents/a-1/command', expect.any(Object));
  });

  it('confirms commit and PR actions', async () => {
    renderWithProviders();
    const commitBtn = screen.getAllByTestId('btn-commit')[0] as HTMLButtonElement;
    const prBtn = screen.getAllByTestId('btn-pr')[0] as HTMLButtonElement;
    fireEvent.click(commitBtn);
    await waitFor(() => expect(commitBtn).not.toBeDisabled());
    fireEvent.click(prBtn);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
    expect(global.confirm).toHaveBeenCalledTimes(2);
  });
});
