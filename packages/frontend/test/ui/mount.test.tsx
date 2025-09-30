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
  it('renders the app title and toggles dialogue', () => {
    render(<AppRouter />);
    expect(screen.getByText('AI Agent Village Monitor')).toBeInTheDocument();

    const btn = screen.getByRole('button', { name: 'Dialogue' });
    fireEvent.click(btn);
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });
});
