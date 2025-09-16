import '@testing-library/jest-dom/vitest';
import '../src/i18n';

// Provide a requestAnimationFrame fallback for tests that batch events on RAF
 
if (!(globalThis as any).requestAnimationFrame) {
   
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(cb, 0) as unknown as number;
}

// jsdom: provide a minimal CanvasRenderingContext2D stub to satisfy Phaser feature checks
try {
  const proto = (globalThis as any).HTMLCanvasElement?.prototype;
  if (proto && !proto.getContext) {
    Object.defineProperty(proto, 'getContext', {
      value: function getContext() {
        // Minimal 2D context shape with settable fillStyle
        return {
          fillStyle: null,
          strokeStyle: null,
          drawImage: Function.prototype,
          getImageData: Function.prototype,
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
      },
    });
  }
} catch {}
