import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
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
