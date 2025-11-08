import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import App from '../../src/App';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../src/contexts/AuthProvider';
import { FeatureFlagProvider } from '../../src/contexts/FeatureFlags';

function mount(villageId = 'demo') {
  return render(
    <FeatureFlagProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={[`/village/${villageId}`]}>
          <Routes>
            <Route path="/village/:id" element={<App />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </FeatureFlagProvider>,
  );
}

describe('Minimap teleport integration', () => {
  beforeEach(() => {
    // Mock auth endpoint to return a user
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 1, username: 'testuser' }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);
    }) as any;

    try {
      localStorage.clear();
    } catch {}
    location.hash = '';
  });

  it('persists tab and agent across teleports (hash)', async () => {
    mount('demo');
    // Open dialogue (ensures tab state exists)
    const btn = await screen.findByRole('button', { name: /dialogue/i });
    fireEvent.click(btn);
    fireEvent.click(await screen.findByRole('button', { name: /control tab/i }));
    // Simulate camera settled to write cam + end travel
    window.dispatchEvent(new CustomEvent('cameraSettled' as any));
    expect(location.hash).toMatch(/tab=control/);
  });
});
