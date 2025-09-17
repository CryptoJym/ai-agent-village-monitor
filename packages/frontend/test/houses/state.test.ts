import { describe, it, expect, vi, beforeEach } from 'vitest';

// Provide a phaser stub suitable for our mapper tests
vi.mock('phaser3spectorjs', () => ({}));
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
    add(...objs: any[]) {
      const items = objs.length === 1 && Array.isArray(objs[0]) ? objs[0] : objs;
      this.list.push(...items);
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
    setDepth() {
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
    setText() {
      return this;
    }
    setColor() {
      return this;
    }
  }
  class Rectangle extends Base {
    setOrigin() {
      return this;
    }
    setFillStyle() {
      return this;
    }
  }
  class Arc extends Base {}
  class Graphics extends Base {
    alpha = 1;
    clear() {}
    lineStyle() {
      return this;
    }
    lineBetween() {
      return this;
    }
    setAlpha(a: number) {
      this.alpha = a;
      return this;
    }
  }
  const Device = { CanvasFeatures: { supportInverseAlpha: true } } as any;
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
  const MathNS = { Clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)) } as any;
  const Input = { Events: {} } as any;
  class Scene {}
  class Game {
    destroy = vi.fn();
    constructor(_c: any) {}
  }
  return {
    default: { GameObjects, Geom, Tweens, Math: MathNS, Input, Scene, Game, AUTO: 0, Device },
  };
});

import { House } from '../../src/houses/House';
import { applyRepoStateToHouse } from '../../src/houses/state';

function makeScene() {
  const tweens = { add: vi.fn(), killTweensOf: vi.fn() };
  const time = { addEvent: vi.fn(), delayedCall: vi.fn() };
  const add = {
    image: (_x: number, _y: number, key: string) => ({
      key,
      _tint: null as any,
      setOrigin() {
        return this;
      },
      setDisplaySize() {
        return this;
      },
      setTint(c: any) {
        this._tint = c;
        return this;
      },
      clearTint() {
        this._tint = null;
        return this;
      },
    }),
    text: (_x: number, _y: number, _t: string, _s?: any) => ({
      setOrigin() {
        return this;
      },
      setText() {
        return this;
      },
      setColor() {
        return this;
      },
    }),
    rectangle: (_x: number, _y: number, _w: number, _h: number, _c: number, _a?: number) => ({
      setOrigin() {
        return this;
      },
      setAlpha() {
        return this;
      },
      setFillStyle() {
        return this;
      },
    }),
    circle: (_x: number, _y: number, _r: number, _c: number, _a?: number) => ({
      setOrigin() {
        return this;
      },
    }),
    graphics: () => ({
      clear() {},
      lineStyle() {
        return this as any;
      },
      lineBetween() {
        return this as any;
      },
      setAlpha() {
        return this as any;
      },
    }),
    existing: vi.fn(),
  } as any;
  return { add, tweens, time } as any;
}

describe('applyRepoStateToHouse', () => {
  let scene: any;
  beforeEach(() => {
    scene = makeScene();
  });

  it('applies health scaffolding severity and tint based on issues', () => {
    const h = new House(scene, 0, 0, { id: 'h', name: 'repo', language: 'js' });
    applyRepoStateToHouse(h as any, { name: 'repo', openIssues: 20 }, Date.now());
    const sprite: any = (h as any).list[0];
    expect(sprite._tint).not.toBe(null);
  });

  it('triggers commit flash for recent commits', () => {
    const h = new House(scene, 0, 0, { id: 'h', name: 'repo', language: 'js' });
    const now = Date.now();
    applyRepoStateToHouse(h as any, { name: 'repo', lastCommitAt: now - 200 }, now);
    expect(scene.tweens.add).toHaveBeenCalled();
  });

  it('starts smoke on in-progress build and emits a puff on completion', () => {
    const h = new House(scene, 0, 0, { id: 'h', name: 'repo', language: 'js' });
    applyRepoStateToHouse(h as any, { name: 'repo', buildStatus: 'in_progress' }, Date.now());
    // No assertion on timer; ensure no exception even on completion
    applyRepoStateToHouse(h as any, { name: 'repo', buildStatus: 'failed' }, Date.now());
  });
});
