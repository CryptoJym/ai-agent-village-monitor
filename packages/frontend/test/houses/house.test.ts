import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('phaser', () => {
  class Base {}
  class Container extends Base {
    scene: any;
    x = 0;
    y = 0;
    list: any[] = [];
    _events: Record<string, Function[]> = {};
    constructor(scene: any, x: number, y: number) {
      super();
      this.scene = scene;
      this.x = x;
      this.y = y;
    }
    add(objs: any[]) {
      this.list.push(...objs);
      return this;
    }
    setSize() {
      return this;
    }
    setInteractive() {
      return this;
    }
    on(name: string, cb: Function) {
      (this._events[name] ||= []).push(cb);
      return this;
    }
  }
  class Image extends Base {
    key: string;
    _tint: number | null = null;
    constructor(_x: number, _y: number, key: string) {
      super();
      this.key = key;
    }
    setOrigin() {
      return this;
    }
    setDisplaySize() {
      return this;
    }
    setTint(c: number) {
      this._tint = c;
      return this;
    }
    clearTint() {
      this._tint = null;
      return this;
    }
  }
  class Text extends Base {
    setOrigin() {
      return this;
    }
  }
  class Rectangle extends Base {
    setOrigin() {
      return this;
    }
  }
  class Arc extends Base {}
  class Graphics extends Base {}
  const GameObjects = { Container, Image, Text, Rectangle, Arc, Graphics };
  const Geom = {
    Rectangle: class {
      static Contains() {
        return true;
      }
      constructor(..._a: any[]) {}
    },
  } as any;
  const Tweens = { Tween: class {} };
  const MathNS = {} as any;
  const Input = { Events: {} } as any;
  class Scene {}
  class Game {
    destroy = vi.fn();
    constructor(_c: any) {}
  }
  return { default: { GameObjects, Geom, Tweens, Math: MathNS, Input, Scene, Game, AUTO: 0 } };
});

import { House } from '../../src/houses/House';

function makeScene() {
  const tweens = { add: vi.fn() };
  const add = {
    image: (_x: number, _y: number, key: string) =>
      new (require('phaser').default.GameObjects.Image as any)(_x, _y, key),
    text: (_x: number, _y: number, _t: string) =>
      new (require('phaser').default.GameObjects.Text as any)(),
    rectangle: (_x: number, _y: number, _w: number, _h: number, _c: number, _a?: number) =>
      new (require('phaser').default.GameObjects.Rectangle as any)(),
    circle: (_x: number, _y: number, _r: number, _c: number, _a?: number) =>
      new (require('phaser').default.GameObjects.Arc as any)(),
    graphics: () => new (require('phaser').default.GameObjects.Graphics as any)(),
    existing: vi.fn(),
  };
  return { add, tweens } as any;
}

describe('House', () => {
  let scene: any;
  beforeEach(() => {
    scene = makeScene();
  });

  it('creates sprite and label with language texture', () => {
    const h = new House(scene, 100, 100, {
      id: 'r1',
      name: 'repo-ts',
      language: 'ts',
      stars: 10,
      issues: 0,
    });
    expect(h).toBeTruthy();
    // first child is sprite image with mapped key
    const sprite: any = (h as any).list[0];
    expect(sprite?.key).toMatch(/house_/);
  });

  it('tints sprite on high issues and clears otherwise', () => {
    const h = new House(scene, 0, 0, { id: 'r2', name: 'repo', language: 'js', issues: 0 });
    const sprite: any = (h as any).list[0];
    expect(sprite._tint).toBe(null);
    h.setHealth(20);
    expect(sprite._tint).not.toBe(null);
    h.setHealth(1);
    // our implementation clears tint for low issues
    expect(sprite._tint).toBe(null);
  });

  it('triggers commit flash and build smoke', () => {
    const h = new House(scene, 0, 0, { id: 'r3', name: 'repo', language: 'py' });
    h.triggerCommitFlash();
    h.triggerBuildSmoke();
    expect(scene.tweens.add).toHaveBeenCalled();
  });

  it('calls pan callback on click when configured', () => {
    const h = new House(scene, 42, 24, { id: 'r4', name: 'zoom', language: 'go' });
    const cb = vi.fn();
    h.onClickZoom(cb);
    // invoke stored event handler manually
    const evs = (h as any)._events['pointerdown'];
    expect(Array.isArray(evs)).toBe(true);
    evs[0]?.();
    expect(cb).toHaveBeenCalledWith(42, 24);
  });
});
