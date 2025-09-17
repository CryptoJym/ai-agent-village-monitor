import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import * as userApi from '../../src/api/user';
import { SettingsPreferences } from '../../src/ui/SettingsPreferences';

vi.mock('../../src/api/user', () => {
  return {
    getPreferences: vi.fn().mockResolvedValue({
      lod: 'high',
      maxFps: 60,
      colorblind: false,
      theme: 'dark',
      keybindings: { talk: 'T' },
      analytics: { enabled: true },
    }),
    updatePreferences: vi.fn().mockResolvedValue({ ok: true }),
  };
});

describe('SettingsPreferences UI', () => {
  beforeEach(() => {
    (userApi.getPreferences as any).mockClear();
    (userApi.updatePreferences as any).mockClear();
    cleanup();
  });
  afterEach(() => cleanup());

  it('loads defaults and applies immediate effects on changes', async () => {
    render(<SettingsPreferences open={true} onClose={() => {}} />);
    // Wait for preferences to load
    await waitFor(() => expect(userApi.getPreferences).toHaveBeenCalled());

    // Change theme to light and expect document dataset to update
    const theme = await screen.findByDisplayValue('dark');
    fireEvent.change(theme, { target: { value: 'light' } });
    await waitFor(() => expect(userApi.updatePreferences).toHaveBeenCalledWith({ theme: 'light' }));
    expect(document.documentElement.dataset.theme).toBe('light');

    // Change max FPS and expect runtime var to be set
    const fps = screen.getByDisplayValue('60') as HTMLInputElement;
    fireEvent.change(fps, { target: { value: '120' } });
    await waitFor(() => expect(userApi.updatePreferences).toHaveBeenCalledWith({ maxFps: 120 }));
    expect((window as any).__MAX_FPS__).toBe(120);

    // Toggle colorblind
    const cb = screen.getByRole('checkbox', { name: /colorblind/i });
    fireEvent.click(cb);
    await waitFor(() =>
      expect(userApi.updatePreferences).toHaveBeenCalledWith({ colorblind: true }),
    );
  });
});
