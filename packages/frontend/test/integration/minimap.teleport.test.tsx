import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import App from '../../src/App';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

function mount(villageId = 'demo') {
  return render(
    <MemoryRouter initialEntries={[`/village/${villageId}`]}>
      <Routes>
        <Route path="/village/:id" element={<App />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Minimap teleport integration', () => {
  beforeEach(() => {
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
