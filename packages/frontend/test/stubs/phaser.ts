// Minimal Phaser stub for jsdom tests
class Base {
  setData() { return this; }
  getData() { return undefined; }
  destroy() {}
  setDepth() { return this; }
  setAlpha() { return this; }
  setVisible() { return this; }
  setPosition() { return this; }
  setScale() { return this; }
  setScrollFactor() { return this; }
  setOrigin() { return this; }
  setBlendMode() { return this; }
}

class Camera {
  x = 0;
  y = 0;
  scrollX = 0;
  scrollY = 0;
  width = 800;
  height = 600;
  zoom = 1;
  private bounds = { x: 0, y: 0, width: 1600, height: 1200 };

  // worldView represents the visible area of the camera in world coordinates
  get worldView() {
    return {
      x: this.scrollX,
      y: this.scrollY,
      width: this.width / this.zoom,
      height: this.height / this.zoom,
      centerX: this.scrollX + (this.width / this.zoom) / 2,
      centerY: this.scrollY + (this.height / this.zoom) / 2
    };
  }

  setBounds(x: number, y: number, width: number, height: number) {
    this.bounds = { x, y, width, height };
    return this;
  }
  setZoom(z: number) { this.zoom = z; return this; }
  zoomTo(z: number) { this.zoom = z; return this; }
  centerOn(x: number, y: number) { this.scrollX = x; this.scrollY = y; return this; }
  pan(x: number, y: number) { this.scrollX = x; this.scrollY = y; return this; }
  startFollow() { return this; }
  stopFollow() { return this; }
  getWorldPoint(x: number, y: number) { return { x, y }; }
  getBounds() { return this.bounds; }
}

class Loader {
  private listeners: Map<string, Set<Function>> = new Map();

  on(event: string, fn: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
    return this;
  }

  emit(event: string, ...args: any[]) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(fn => fn(...args));
    }
    return this;
  }

  spritesheet() { return this; }
  atlas() { return this; }
  image() { return this; }
  audio() { return this; }
}

class Physics {
  world = {
    bounds: { x: 0, y: 0, width: 1600, height: 1200 },
    setBounds(x: number, y: number, w: number, h: number) {
      this.bounds = { x, y, width: w, height: h };
    }
  };
}

class Pointer {
  x = 0;
  y = 0;
  downX = 0;
  downY = 0;
  isDown = false;
  leftButtonDown() { return false; }
  rightButtonDown() { return false; }
}

class InputPlugin {
  keyboard = {
    createCursorKeys() {
      return { left: { isDown: false }, right: { isDown: false }, up: { isDown: false }, down: { isDown: false } };
    },
    addKey() {
      return { on() {}, isDown: false };
    }
  };
  activePointer = new Pointer();
  pointer1 = new Pointer();
  pointer2 = new Pointer();
  on() {}
  off() {}
}

class Registry {
  private data = new Map();
  get(key: string) { return this.data.get(key); }
  set(key: string, value: any) { this.data.set(key, value); }
  has(key: string) { return this.data.has(key); }
}

class Time {
  delayedCall(delay: number, callback: Function) {
    setTimeout(callback, delay);
  }
}

class TweensManager {
  add(config: any) {
    // Immediately call onComplete callback if provided
    // This makes tests pass without waiting for actual animation
    if (config && typeof config.onComplete === 'function') {
      setTimeout(() => config.onComplete(), 0);
    }
    return { stop: () => {}, remove: () => {} };
  }
}

class SceneManager {
  private scenes = new Map();
  private pausedScenes = new Set<string>();
  private activeScenes = new Set<string>();
  private sharedRegistry: Registry;

  constructor(registry?: Registry) {
    this.sharedRegistry = registry || new Registry();
  }

  add(key: string, scene: any, autoStart: boolean = false) {
    this.scenes.set(key, scene);
    // Inject shared registry into scene
    scene.registry = this.sharedRegistry;
    if (scene.scene) {
      scene.scene.key = key;
      // Store reference to this SceneManager for method access
      const manager = this;
      // Use arrow functions that delegate to the manager's methods
      // This allows spying on scene.scene.start to work properly
      scene.scene.start = (k: string, data?: any) => manager.start(k, data);
      scene.scene.stop = (k: string) => manager.stop(k);
      scene.scene.restart = (k: string) => manager.restart(k);
      scene.scene.pause = (k: string) => manager.pause(k);
      scene.scene.resume = (k: string) => manager.resume(k);
      scene.scene.isPaused = (k: string) => manager.isPaused(k);
      scene.scene.isActive = (k: string) => manager.isActive(k);
    }
    return scene;
  }

  start(key: string, data?: any) {
    const scene = this.scenes.get(key);
    if (scene) {
      this.activeScenes.add(key);
      this.pausedScenes.delete(key);
      if (scene.init) scene.init(data || {});
      if (scene.preload) scene.preload();
      if (scene.create) scene.create();
    }
    return this;
  }

  stop(key: string) {
    const scene = this.scenes.get(key);
    this.activeScenes.delete(key);
    this.pausedScenes.delete(key);
    if (scene && scene.shutdown) scene.shutdown();
    return this;
  }

  restart(key: string) {
    this.stop(key);
    this.start(key);
    return this;
  }

  pause(key: string) {
    if (this.activeScenes.has(key)) {
      this.pausedScenes.add(key);
    }
    return this;
  }

  resume(key: string) {
    this.pausedScenes.delete(key);
    return this;
  }

  isPaused(key: string) {
    return this.pausedScenes.has(key);
  }

  isActive(key: string) {
    return this.activeScenes.has(key) && !this.pausedScenes.has(key);
  }
}

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
    constructor(public scene: any, public x: number, public y: number, public text: string, public style?: any) {
      super();
    }
    setOrigin() {
      return this;
    }
    setScrollFactor() {
      return this;
    }
    setText(text: string) {
      this.text = text;
      return this;
    }
    setColor() {
      return this;
    }
    setFontSize() {
      return this;
    }
    setStyle() {
      return this;
    }
  },
  Rectangle: class extends Base {
    constructor(public x: number, public y: number, public width: number, public height: number, public fillColor?: number) {
      super();
    }
    setOrigin() {
      return this;
    }
    setSize() {
      return this;
    }
    setInteractive() {
      return this;
    }
    setScrollFactor() {
      return this;
    }
    setStrokeStyle() {
      return this;
    }
    setFillStyle() {
      return this;
    }
    on() {
      return this;
    }
    getBounds() {
      return { x: this.x, y: this.y, width: this.width, height: this.height, centerX: this.x + this.width/2, centerY: this.y + this.height/2 };
    }
  },
  Arc: class extends Base {},
  Graphics: class extends Base {
    lineStyle() { return this; }
    lineBetween() { return this; }
    clear() { return this; }
    arc() { return this; }
    strokePath() { return this; }
    beginPath() { return this; }
    closePath() { return this; }
    fillRect() { return this; }
    fillCircle() { return this; }
    strokeCircle() { return this; }
    fillStyle() { return this; }
    setFillStyle() { return this; }
    setRotation() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    stroke() { return this; }
    fill() { return this; }
  },
  Sprite: class extends Base {
    constructor(public scene: any, public x: number, public y: number, public texture: string) {
      super();
    }
  }
};
export const Geom = {
  Rectangle: class {
    x: number;
    y: number;
    width: number;
    height: number;

    static Contains(_rect: any, _x: number, _y: number) {
      return true;
    }

    static Overlaps(rect1: any, rect2: any) {
      // Check if two rectangles overlap using AABB collision detection
      return rect1.x < rect2.x + rect2.width &&
             rect1.x + rect1.width > rect2.x &&
             rect1.y < rect2.y + rect2.height &&
             rect1.y + rect1.height > rect2.y;
    }

    constructor(x: number = 0, y: number = 0, width: number = 0, height: number = 0) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
    }

    contains(x: number, y: number) {
      return x >= this.x && x <= this.x + this.width &&
             y >= this.y && y <= this.y + this.height;
    }

    setTo(x: number, y: number, width: number, height: number) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      return this;
    }
  },
} as any;

// Rename to PhaserMath to avoid shadowing global Math
export const PhaserMath = {
  Clamp: (value: number, min: number, max: number) => {
    return value < min ? min : value > max ? max : value;
  },
  Distance: {
    Between: (x1: number, y1: number, x2: number, y2: number) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      return globalThis.Math.sqrt(dx * dx + dy * dy);
    }
  }
} as any;
// Re-export as Math for Phaser compatibility
export { PhaserMath as Math };
export const Keyboard = {
  KeyCodes: {
    W: 87,
    A: 65,
    S: 83,
    D: 68,
    UP: 38,
    DOWN: 40,
    LEFT: 37,
    RIGHT: 39,
    PLUS: 187,
    MINUS: 189,
  }
};

export const Input = {
  Events: {},
  Keyboard: Keyboard
} as any;
export const Events = {
  EventEmitter: class {
    private listeners: Map<string, Set<Function>> = new Map();

    on(event: string, fn: Function) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, new Set());
      }
      this.listeners.get(event)!.add(fn);
      return this;
    }

    off(event: string, fn: Function) {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(fn);
      }
      return this;
    }

    emit(event: string, ...args: any[]) {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.forEach(fn => fn(...args));
      }
      return this;
    }

    removeAllListeners(event?: string) {
      if (event) {
        this.listeners.delete(event);
      } else {
        this.listeners.clear();
      }
      return this;
    }

    listenerCount(event: string) {
      const eventListeners = this.listeners.get(event);
      return eventListeners ? eventListeners.size : 0;
    }
  }
} as any;

export const Cameras = {
  Scene2D: {
    Camera
  }
};

export const Types = {
  Input: {
    Keyboard: {
      CursorKeys: {}
    }
  }
};

export class Scene {
  scene: any = { key: '' };
  cameras = { main: new Camera() };
  input: any = new InputPlugin();
  load: any = new Loader();
  physics: any = new Physics();
  registry = new Registry();
  add = {
    text: (x: number, y: number, text: string, style?: any) => new GameObjects.Text(this, x, y, text, style),
    rectangle: (x: number, y: number, w: number, h: number, color?: number) => new GameObjects.Rectangle(x, y, w, h, color),
    circle: (x: number, y: number, r: number, color?: number) => new GameObjects.Rectangle(x, y, r*2, r*2, color),
    graphics: () => new GameObjects.Graphics(),
    sprite: (x: number, y: number, texture: string) => new GameObjects.Sprite(this, x, y, texture),
    container: (x: number, y: number) => new GameObjects.Container(this, x, y),
    image: (x: number, y: number, key: string) => new GameObjects.Image(x, y, key),
  };
  scale = { width: 800, height: 600 };
  time = new Time();
  tweens = new TweensManager();

  constructor() {}
  init(_data?: any) {}
  preload() {}
  create() {}
  update(_time?: number, _delta?: number) {}
  shutdown() {}
}

// Shared registry that Game provides to all scenes
let sharedRegistry: Registry | null = null;

export class Game {
  scene: SceneManager;
  registry: Registry;

  constructor(_config: any) {
    // Create a shared registry for all scenes in this game
    this.registry = new Registry();
    sharedRegistry = this.registry;
    this.scene = new SceneManager(this.registry);
  }

  destroy() {
    sharedRegistry = null;
  }
}

export const Tweens = { Tween: class {} } as any;

export const BlendModes = {
  NORMAL: 0,
  ADD: 1,
  MULTIPLY: 2,
  SCREEN: 3,
  OVERLAY: 4,
  DARKEN: 5,
  LIGHTEN: 6,
  COLOR_DODGE: 7,
  COLOR_BURN: 8,
  HARD_LIGHT: 9,
  SOFT_LIGHT: 10,
  DIFFERENCE: 11,
  EXCLUSION: 12,
  HUE: 13,
  SATURATION: 14,
  COLOR: 15,
  LUMINOSITY: 16,
  ERASE: 17,
  SOURCE_IN: 18,
  SOURCE_OUT: 19,
  SOURCE_ATOP: 20,
  DESTINATION_OVER: 21,
  DESTINATION_IN: 22,
  DESTINATION_OUT: 23,
  DESTINATION_ATOP: 24,
  LIGHTER: 25,
  COPY: 26,
  XOR: 27,
};

export const AUTO = 0;
export const HEADLESS = 1;
export const VERSION = 'stub';

export default {
  GameObjects,
  Geom,
  Tweens,
  Math: PhaserMath,
  Input,
  Events,
  Cameras,
  Types,
  Keyboard,
  Scene,
  Game,
  BlendModes,
  AUTO,
  HEADLESS,
  VERSION
} as any;
