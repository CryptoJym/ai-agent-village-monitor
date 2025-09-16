import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AppRouter from '../../src/routes/AppRouter';

vi.mock('phaser3spectorjs', () => ({}));
vi.mock('phaser', () => {
  class Scene {}
  class Game {
    destroy = vi.fn();
    constructor(_config: any) {}
  }
  const GameObjects = {
    Container: class {},
    Arc: class {},
    Graphics: class {},
    Text: class {},
    Image: class {},
  };
  const Tweens = { Tween: class {} };
  const MathNS = {
    Distance: { Between: () => 0 },
    Clamp: (v: number) => v,
    FloatBetween: () => 0,
    DegToRad: (v: number) => v,
  } as any;
  const Input = {
    Events: {
      POINTER_DOWN: 'pointerdown',
      POINTER_UP: 'pointerup',
      POINTER_MOVE: 'pointermove',
      WHEEL: 'wheel',
    },
  } as any;
  const Geom = {
    Rectangle: class {
      constructor(..._a: any[]) {}
      static Contains() {
        return true;
      }
    },
    Point: class {},
  } as any;
  return { default: { Scene, Game, AUTO: 0, GameObjects, Tweens, Math: MathNS, Input, Geom } };
});

describe('RoleBadge integration', () => {
  beforeEach(() => {
    // @ts-ignore
    global.fetch = async (url: string) => {
      if (url.includes('/api/villages/')) {
        return {
          ok: true,
          json: async () => ({ viewerRole: 'owner', isPublic: true }),
        } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    };
  });

  it('shows role badge for village view', async () => {
    // Render router; by default AppRouter renders at "/"
    // Simulate navigating to /village/1
    window.history.pushState({}, '', '/village/1');
    render(<AppRouter />);
    expect(await screen.findByText(/owner/i)).toBeInTheDocument();
  });
});
