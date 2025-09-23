import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import '../src/i18n';

// Provide a requestAnimationFrame fallback for tests that batch events on RAF

if (!(globalThis as any).requestAnimationFrame) {
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(cb, 0) as unknown as number;
}

// Ensure any pending micro/macro tasks (e.g., deferred dynamic imports) settle between tests
afterEach(async () => {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
});

// jsdom: provide a minimal CanvasRenderingContext2D stub to satisfy Phaser feature checks
try {
  const proto = (globalThis as any).HTMLCanvasElement?.prototype;
  if (proto) {
    const stub = function getContext() {
      return {
        fillStyle: null,
        strokeStyle: null,
        drawImage: Function.prototype,
        getImageData: (_x: number, _y: number, w: number, h: number) => ({
          data: new Uint8ClampedArray(Math.max(1, w) * Math.max(1, h) * 4),
          width: Math.max(1, w),
          height: Math.max(1, h),
        }),
        putImageData: Function.prototype,
        fillRect: Function.prototype,
        clearRect: Function.prototype,
        beginPath: Function.prototype,
        closePath: Function.prototype,
        moveTo: Function.prototype,
        lineTo: Function.prototype,
        fill: Function.prototype,
        stroke: Function.prototype,
      } as unknown as CanvasRenderingContext2D;
    };
    Object.defineProperty(proto, 'getContext', { value: stub, configurable: true, writable: true });
  }
} catch (e) {
  void e;
}

// Provide a minimal AudioContext stub so ambient-synth helpers do not explode in Vitest
if (!(globalThis as any).AudioContext) {
  class FakeOscillator {
    frequency = { value: 0 };
    connect() {}
    start() {}
    stop() {}
    disconnect() {}
  }
  class FakeGain {
    gain = { value: 0 };
    connect() {}
    disconnect() {}
  }
  class FakeFilter extends FakeGain {
    type = 'lowpass';
    frequency = { value: 0 };
  }
  class FakeAudioContext {
    destination = {};
    resume() {
      return Promise.resolve();
    }
    createGain() {
      return new FakeGain();
    }
    createOscillator() {
      return new FakeOscillator();
    }
    createBiquadFilter() {
      return new FakeFilter();
    }
  }
  (globalThis as any).AudioContext = FakeAudioContext;
  (globalThis as any).webkitAudioContext = FakeAudioContext;
}

// Lightweight mock for NpcManager so scene tests don't pull Phaser internals
vi.mock('../src/npc/NpcManager', () => ({
  NpcManager: class {
    constructor() {}
    update() {}
    destroy() {}
  },
}));
