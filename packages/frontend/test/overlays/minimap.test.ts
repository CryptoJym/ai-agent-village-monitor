import { describe, it, expect, vi } from 'vitest';
vi.mock('phaser', () => ({
  default: {
    Scale: { Events: { RESIZE: 'resize' } },
    Math: { Clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)) },
  },
}));
import type Phaser from 'phaser';
import { Minimap } from '../../src/overlays/Minimap';

class FakeGO {
  x = 0;
  y = 0;
  width = 0;
  height = 0;
  visible = true;
  name?: string;
  text?: string;
  constructor(public type: string) {}
  setOrigin() {
    return this;
  }
  setStrokeStyle() {
    return this;
  }
  setFillStyle() {
    return this;
  }
  setInteractive() {
    return { on: () => this };
  }
  on() {
    return this;
  }
  setAlpha() {
    return this;
  }
  setScrollFactor() {
    return this;
  }
  setDepth() {
    return this;
  }
  setName(n: string) {
    this.name = n;
    return this;
  }
  setVisible(v: boolean) {
    this.visible = v;
    return this;
  }
  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }
  setSize(w: number, h: number) {
    this.width = w;
    this.height = h;
    return this;
  }
  setText(t: string) {
    this.text = t;
    return this;
  }
  add(_child: any) {
    return this;
  }
}

class FakeRT extends FakeGO {
  constructor() {
    super('rt');
  }
  clear() {
    return this;
  }
  setScale() {
    return this;
  }
  draw() {
    return this;
  }
}

class FakeScene {
  scale = { width: 800, height: 450, on: (_: any, __: any) => void 0 } as any;
  time = { addEvent: (_: any) => ({ remove: () => void 0 }) } as any;
  input = { keyboard: { on: (_: any, __: any) => void 0 } } as any;
  add = {
    rectangle: (x: number, y: number, w: number, h: number) => {
      const r = new FakeGO('rect');
      r.width = w;
      r.height = h;
      r.x = x;
      r.y = y;
      return r;
    },
    text: (x: number, y: number, t: string) => {
      const g = new FakeGO('text');
      g.text = t;
      g.x = x;
      g.y = y;
      return g;
    },
    renderTexture: (_x: number, _y: number, _w: number, _h: number) => new FakeRT(),
    container: (_x: number, _y: number, _children: any[]) => new FakeGO('container'),
    circle: (_x: number, _y: number, _r: number) => new FakeGO('circle'),
  } as any;
  cameras = { main: { worldView: { x: 0, y: 0, width: 800, height: 450 } } } as any;
}

describe('Minimap mapping and viewport', () => {
  it('maps world <-> mini coordinates consistently', () => {
    const scene = new FakeScene() as unknown as Phaser.Scene;
    const mini = new Minimap(scene, { width: 200, height: 100, world: { w: 1600, h: 900 } });
    const anyMini = mini as any;
    const padding = 8;
    const innerW = 200 - padding * 2;
    const innerH = 100 - padding * 2;

    // World center -> mini center
    const m = anyMini.toMini({ x: 800, y: 450 });
    expect(Math.round(m.x)).toBeCloseTo(padding + innerW * 0.5, 0);
    expect(Math.round(m.y)).toBeCloseTo(padding + innerH * 0.5, 0);

    // Reverse mapping from mini center -> world center
    const w = anyMini.fromMini({ x: padding + innerW * 0.5, y: padding + innerH * 0.5 });
    expect(Math.round(w.x)).toBe(800);
    expect(Math.round(w.y)).toBe(450);
  });

  it('draws viewport rectangle using setViewport()', () => {
    const scene = new FakeScene() as unknown as Phaser.Scene;
    const mini = new Minimap(scene, { width: 200, height: 100, world: { w: 1600, h: 900 } });
    const anyMini = mini as any;
    mini.setViewport({ x: 100, y: 50, width: 400, height: 225 });
    const rect = anyMini.viewRect as FakeGO;
    expect(rect).toBeTruthy();
    // Expect rectangle to be placed near the mapped TL
    const tl = anyMini.toMini({ x: 100, y: 50 });
    expect(Math.round(rect.x)).toBe(Math.round(tl.x));
    expect(Math.round(rect.y)).toBe(Math.round(tl.y));
  });

  it('toggles update mode label INT/CAM', () => {
    const scene = new FakeScene() as unknown as Phaser.Scene;
    const mini = new Minimap(scene, { width: 200, height: 100, world: { w: 1600, h: 900 } });
    const anyMini = mini as any;
    expect(anyMini.title.text).toContain('INT');
    mini.setUpdateMode('camera');
    expect(anyMini.title.text).toContain('CAM');
  });
});
