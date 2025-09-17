export type Severity = 'low' | 'medium' | 'high';

export class LayoutOffload {
  private static worker: Worker | null = null;
  static threshold = 200; // use worker when many bots exist

  static init() {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') return;
    try {
      // Vite-friendly worker import
      const w = new Worker(new URL('../workers/layoutWorker.ts', import.meta.url), {
        type: 'module',
      });
      this.worker = w;
    } catch (e) {
      this.worker = null;
      void e;
    }
  }

  static async computeRingPosition(
    cx: number,
    cy: number,
    severity: Severity,
    others: { x: number; y: number; r: number }[],
    rMin = 64,
    rMax = 128,
  ): Promise<{ x: number; y: number } | null> {
    const worker = this.worker;
    if (!worker) return null;
    const sevRadius = severity === 'high' ? 12 : severity === 'medium' ? 10 : 8;
    return new Promise((resolve) => {
      const onMsg = (ev: MessageEvent<{ x: number; y: number }>) => {
        worker.removeEventListener('message', onMsg as any);
        resolve({ x: ev.data.x, y: ev.data.y });
      };
      worker.addEventListener('message', onMsg as any);
      worker.postMessage({ cx, cy, sevRadius, padding: 6, rMin, rMax, others });
      // Timeout fallback
      setTimeout(() => {
        try {
          worker.removeEventListener('message', onMsg as any);
        } catch (e) {
          void e;
        }
        resolve(null);
      }, 8);
    });
  }
}

// Auto-init in browser
LayoutOffload.init();
