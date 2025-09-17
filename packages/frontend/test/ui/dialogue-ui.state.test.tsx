import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { DialogueUI } from '../../src/ui/DialogueUI';
import { ToastProvider } from '../../src/ui/Toast';

describe('DialogueUI UI state persistence', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {}
  });

  it('restores persisted tab on open', async () => {
    try {
      localStorage.setItem('ui_state_v1', JSON.stringify({ dialogueTab: 'control' }));
    } catch {}
    render(
      <ToastProvider>
        <DialogueUI open={true} onClose={() => {}} agentId="a-1" />
      </ToastProvider>,
    );
    // Active tab should eventually be Control
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /control tab \(2\)/i });
      expect(btn).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('persists tab changes when user clicks', () => {
    render(
      <ToastProvider>
        <DialogueUI open={true} onClose={() => {}} agentId="a-1" />
      </ToastProvider>,
    );
    const infoButtons = screen.getAllByRole('button', { name: /info tab \(3\)/i });
    fireEvent.click(infoButtons[0]);
    const raw = localStorage.getItem('ui_state_v1');
    const st = raw ? JSON.parse(raw) : {};
    expect(st.dialogueTab).toBe('info');
  });
});
