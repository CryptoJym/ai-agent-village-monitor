import { describe, it, expect, vi } from 'vitest';
import Phaser from 'phaser';
import { Minimap } from '../../src/overlays/Minimap';

// Minimal scene stub
class TestScene extends Phaser.Scene {
  constructor() {
    super('Test');
  }
  create() {}
}

describe('Minimap coordinate transforms', () => {
  it('maps world->mini and back within bounds', () => {
    const game = new Phaser.Game({
      type: Phaser.HEADLESS,
      width: 800,
      height: 600,
      scene: [] as any,
    });
    const scene = new TestScene();
    // @ts-ignore attach
    scene.game = game;
    // @ts-ignore set scale
    scene.scale = { width: 800, height: 600, on: vi.fn() } as any;
    // @ts-ignore cameras
    scene.cameras = {
      main: { worldView: { x: 0, y: 0, width: 800, height: 600 }, zoom: 1 },
    } as any;
    // @ts-ignore input
    scene.input = { keyboard: { on: vi.fn() } } as any;
    // @ts-ignore add
    scene.add = {
      rectangle: vi.fn(() => ({ setOrigin: () => ({ setStrokeStyle: () => ({}) }) })),
      renderTexture: vi.fn(() => ({ setOrigin: () => ({}), setAlpha: () => ({}) })),
      container: vi.fn(() => ({
        setScrollFactor: () => ({
          setDepth: () => ({ setName: () => ({ setPosition: vi.fn() }) }),
        }),
      })),
      circle: vi.fn(() => ({})),
      text: vi.fn(() => ({ setInteractive: () => ({ on: vi.fn() }) })),
    } as any;

    const m = new Minimap(scene as any, { width: 200, height: 120, world: { w: 1600, h: 1200 } });
    // @ts-ignore access private
    const toMini = (m as any).toMini.bind(m);
    // @ts-ignore access private
    const fromMini = (m as any).fromMini.bind(m);
    const wpt = { x: 400, y: 300 };
    const mini = toMini(wpt);
    const round = fromMini(mini);
    expect(Math.abs(round.x - wpt.x)).toBeLessThan(2);
    expect(Math.abs(round.y - wpt.y)).toBeLessThan(2);
  });
});
