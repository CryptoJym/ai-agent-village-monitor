import type { Point } from './iso';

export type Bounds = { width: number; height: number };

// Jittered grid layout: places up to n points on a grid with given spacing within bounds
export function generateGridLayout(
  n: number,
  spacing: number,
  bounds: Bounds,
  jitter = 0.25,
): Point[] {
  const cols = Math.max(1, Math.floor(bounds.width / spacing));
  const rows = Math.max(1, Math.floor(bounds.height / spacing));
  const points: Point[] = [];
  let placed = 0;
  for (let r = 0; r < rows && placed < n; r++) {
    for (let c = 0; c < cols && placed < n; c++) {
      const jx = (Math.random() * 2 - 1) * spacing * jitter;
      const jy = (Math.random() * 2 - 1) * spacing * jitter;
      const x = Math.min(bounds.width - spacing, Math.max(spacing, c * spacing + jx));
      const y = Math.min(bounds.height - spacing, Math.max(spacing, r * spacing + jy));
      points.push({ x, y });
      placed++;
    }
  }
  return points;
}

// Simple Poisson-like rejection sampling on top of jittered grid for better distribution
export function generatePoissonLayout(
  n: number,
  minDist: number,
  bounds: Bounds,
  maxTries = 30,
): Point[] {
  const points: Point[] = [];
  // Seed with a center point
  points.push({ x: bounds.width / 2, y: bounds.height / 2 });
  while (points.length < n) {
    let placed = false;
    for (let t = 0; t < maxTries && !placed; t++) {
      const p = { x: Math.random() * bounds.width, y: Math.random() * bounds.height };
      if (points.every((q) => dist(p, q) >= minDist)) {
        points.push(p);
        placed = true;
        break;
      }
    }
    if (!placed) break; // cannot place more without overlap
  }
  return points;
}

function dist(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

// Ensures no overlaps by nudging points apart using a few relaxation iterations (boundary enforced)
export function relax(points: Point[], minDist: number, bounds: Bounds, iterations = 2): Point[] {
  const out = points.map((p) => ({ ...p }));
  for (let k = 0; k < iterations; k++) {
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i],
          b = out[j];
        const d = dist(a, b);
        if (d > 0 && d < minDist) {
          const push = (minDist - d) / 2;
          const nx = (a.x - b.x) / d;
          const ny = (a.y - b.y) / d;
          a.x = clamp(a.x + nx * push, 0, bounds.width);
          a.y = clamp(a.y + ny * push, 0, bounds.height);
          b.x = clamp(b.x - nx * push, 0, bounds.width);
          b.y = clamp(b.y - ny * push, 0, bounds.height);
        }
      }
    }
  }
  return out;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
