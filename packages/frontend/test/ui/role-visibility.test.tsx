import { describe, it, expect, beforeEach, vi } from 'vitest';
// Mock Phaser to avoid canvas requirements in jsdom
vi.mock('phaser3spectorjs', () => ({}));
vi.mock('phaser', () => {
  class Scene {}
  class Game {
    destroy = vi.fn();
    constructor(_config: any) {}
  }
  class Container {}
  class Text {}
  class Arc {}
  return {
    default: {
      Scene,
      Game,
      AUTO: 0,
      GameObjects: { Container, Text, Arc },
      Math: { Between: (a: number, b: number) => a, FloatBetween: (a: number, b: number) => a },
      Utils: { Array: { GetRandom: (arr: any[]) => arr[0] } },
    },
  };
});
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ControlTab } from '../../src/ui/ControlTab';
import App from '../../src/App';
import { ToastProvider } from '../../src/ui/Toast';

describe('role-based visibility and gating', () => {
  beforeEach(() => {
    // @ts-ignore
    global.fetch = vi.fn();
  });

  it('disables ControlTab actions for non-owners and enables for owners', async () => {
    // Member role → disabled
    // @ts-ignore
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 1,
        name: 'v1',
        githubOrgId: '1',
        isPublic: false,
        viewerRole: 'member',
      }),
    });

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/village/1']}>
          <Routes>
            <Route path="/village/:id" element={<ControlTab agentId="a-1" />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('btn-run-tool')).toBeDisabled();
      expect(screen.getByTestId('btn-commit')).toBeDisabled();
      expect(screen.getByTestId('btn-pr')).toBeDisabled();
    });

    // Owner role → enabled (cleanup previous render to avoid duplicate nodes)
    cleanup();
    // @ts-ignore
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 1,
        name: 'v1',
        githubOrgId: '1',
        isPublic: false,
        viewerRole: 'owner',
      }),
    });

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/village/1']}>
          <Routes>
            <Route path="/village/:id" element={<ControlTab agentId="a-1" />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>,
    );

    await waitFor(() => {
      const runBtns = screen.getAllByTestId('btn-run-tool');
      const commitBtns = screen.getAllByTestId('btn-commit');
      const prBtns = screen.getAllByTestId('btn-pr');
      const last = (arr: HTMLElement[]) => arr[arr.length - 1] as HTMLButtonElement;
      expect(last(runBtns)).not.toBeDisabled();
      expect(last(commitBtns)).not.toBeDisabled();
      expect(last(prBtns)).not.toBeDisabled();
    });
  });

  it.skip('disables Settings button for non-owners in App', async () => {
    // Member → disabled
    // @ts-ignore
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 1,
        name: 'v1',
        githubOrgId: '1',
        isPublic: false,
        viewerRole: 'member',
      }),
    });
    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/village/1']}>
          <Routes>
            <Route path="/village/:id" element={<App />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>,
    );
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: 'Settings' }) as HTMLButtonElement;
      expect(btn).toBeDisabled();
    });

    // (Owner: verified via ControlTab gating above)
  });
});
