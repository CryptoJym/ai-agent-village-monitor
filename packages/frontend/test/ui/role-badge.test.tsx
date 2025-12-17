import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RoleBadge } from '../../src/ui/RoleBadge';

describe('RoleBadge integration', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.includes('/api/villages/')) {
        return {
          ok: true,
          json: async () => ({ viewerRole: 'owner', isPublic: true }),
        } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows role badge for village view', async () => {
    render(
      <MemoryRouter initialEntries={['/village/1']}>
        <Routes>
          <Route path="/village/:id" element={<RoleBadge />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/owner/i)).toBeInTheDocument();
  });
});
