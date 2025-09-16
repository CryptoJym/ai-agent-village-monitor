import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Explicitly mock Phaser to avoid Canvas features in jsdom
vi.mock('phaser', () => {
  class Scene {}
  return {
    default: {
      Scene,
      Utils: { Array: { GetRandom: (arr: any[]) => arr[0] } },
      Math: { Between: (a: number) => a },
      Input: { Events: {} },
      GameObjects: {},
    },
  };
});

// Stub scene dependencies that extend Phaser classes or access DOM
vi.mock('../../src/agents/Agent', () => ({ Agent: class {} }));
vi.mock('../../src/houses/House', () => ({ House: class {} }));
vi.mock('../../src/bugs/BugBot', () => ({ BugBot: class {} }));
vi.mock('../../src/services/LayoutOffload', () => ({ LayoutOffload: {} }));
vi.mock('../../src/realtime/WebSocketService', () => ({
  WebSocketService: class {
    connect() {}
    joinVillage() {}
  },
}));
vi.mock('../../src/utils/a11y', () => ({ createLiveRegion: () => {}, announce: () => {} }));
vi.mock('../../src/utils/iso', () => ({
  isoToScreen: (_r: number, _c: number, _tw: number, _th: number, ox: number, oy: number) => ({
    x: ox,
    y: oy,
  }),
  buildIsoGrid: () => ({}),
}));

describe('MainScene layout save throttling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (global as any).fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  });
  afterEach(() => {
    vi.useRealTimers();
    (global as any).fetch = undefined;
  });

  it('coalesces rapid save requests into a single PUT', async () => {
    const { MainScene } = await import('../../src/scenes/MainScene');
    const scene: any = new MainScene();
    scene.villageId = 'demo';
    scene.agent = { x: 10, y: 20 };
    // call queue multiple times quickly
    scene.queueSaveLayout();
    scene.queueSaveLayout();
    scene.queueSaveLayout();
    // advance less than debounce
    vi.advanceTimersByTime(900);
    expect((global as any).fetch).not.toHaveBeenCalled();
    // advance past debounce window
    vi.advanceTimersByTime(200);
    expect((global as any).fetch).toHaveBeenCalledTimes(1);
  });

  it('flush triggers immediate save', async () => {
    const { MainScene } = await import('../../src/scenes/MainScene');
    const scene: any = new MainScene();
    scene.villageId = 'demo';
    scene.agent = { x: 10, y: 20 };
    scene.queueSaveLayout(true);
    expect((global as any).fetch).toHaveBeenCalledTimes(1);
  });
});
