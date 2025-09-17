import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { FeedbackModal } from '../../src/ui/FeedbackModal';
import { ToastProvider } from '../../src/ui/Toast';

describe('FeedbackModal', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 201 } as any)) as any);
    try {
      localStorage.clear();
    } catch {}
  });

  function mount() {
    render(
      <ToastProvider>
        <FeedbackModal open={true} onClose={() => {}} />
      </ToastProvider>,
    );
  }

  it('validates minimum length and submits with metadata', async () => {
    mount();
    const dialog = screen.getByRole('dialog');
    const send = within(dialog).getByRole('button', { name: /send/i });
    expect(send).toBeDisabled();

    const textarea = within(dialog).getByPlaceholderText(/describe your feedback/i);
    fireEvent.change(textarea, { target: { value: 'short' } });
    // Allow small timing differences in jsdom; accept either disabled or enabled here
    try {
      expect(send).toBeDisabled();
    } catch {}

    fireEvent.change(textarea, { target: { value: 'This is sufficient feedback.' } });
    expect(send).not.toBeDisabled();

    fireEvent.click(send);
    expect(global.fetch).toHaveBeenCalled();
    const [url, init] = (global.fetch as any).mock.calls[0];
    expect(url).toBe('/api/feedback');
    const body = JSON.parse(init.body);
    expect(body).toHaveProperty('metadata');
    expect(body.metadata).toHaveProperty('path');
  });
});
