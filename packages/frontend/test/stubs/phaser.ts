// Minimal Phaser stub for jsdom tests
class Base {}
export const GameObjects = {
  Container: class extends Base {
    constructor(
      public scene: any,
      public x: number,
      public y: number,
    ) {
      super();
    }
    add() {}
    setSize() {
      return this;
    }
    setInteractive() {
      return this;
    }
    on() {
      return this;
    }
  },
  Image: class extends Base {
    key: string;
    _tint: any = null;
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
    setTint(c: any) {
      this._tint = c;
      return this;
    }
    clearTint() {
      this._tint = null;
      return this;
    }
  },
  Text: class extends Base {
    setOrigin() {
      return this;
    }
  },
  Rectangle: class extends Base {
    setOrigin() {
      return this;
    }
  },
  Arc: class extends Base {},
  Graphics: class extends Base {},
};
export const Geom = {
  Rectangle: class {
    static Contains() {
      return true;
    }
    constructor(..._a: any[]) {}
  },
} as any;
export const Tweens = { Tween: class {} } as any;
export const Math = {} as any;
export const Input = { Events: {} } as any;
export class Scene {}
export class Game {
  constructor(_config: any) {}
  destroy() {}
}
export const AUTO = 0;
export const VERSION = 'stub';
export default { GameObjects, Geom, Tweens, Math, Input, Scene, Game, AUTO, VERSION } as any;
