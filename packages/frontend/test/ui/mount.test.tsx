import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

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
      Math: {
        Between: (a: number, _b: number) => a,
        FloatBetween: (a: number, _b: number) => a,
      },
      Utils: { Array: { GetRandom: (arr: any[]) => arr[0] } },
    },
  };
});

import AppRouter from '../../src/routes/AppRouter';

describe('App mount', () => {
  it('renders the app title and toggles dialogue', async () => {
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

    render(<AppRouter />);
    expect(await screen.findByText('AI Agent Village Monitor')).toBeInTheDocument();

    const btn = screen.getByRole('button', { name: 'Dialogue' });
    fireEvent.click(btn);
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });
});
