export type Point = { x: number; y: number };

export type IsoConfig = {
  tileW: number;
  tileH: number;
  originX?: number;
  originY?: number;
};

// Basic 2:1 isometric transform helpers
// World grid (tile) to screen coordinates assuming tileWidth:tileHeight = 2:1
export function isoToScreen(p: Point, tileW = 64, tileH = 32): Point {
  const x = (p.x - p.y) * (tileW / 2);
  const y = (p.x + p.y) * (tileH / 2);
  return { x, y };
}

export function screenToIso(p: Point, tileW = 64, tileH = 32): Point {
  const isoX = (p.y / (tileH / 2) + p.x / (tileW / 2)) / 2;
  const isoY = (p.y / (tileH / 2) - p.x / (tileW / 2)) / 2;
  return { x: isoX, y: isoY };
}

export function gridToScreen(q: number, r: number, cfg: IsoConfig): Point {
  const { tileW, tileH, originX = 0, originY = 0 } = cfg;
  const p = isoToScreen({ x: q, y: r }, tileW, tileH);
  return { x: p.x + originX, y: p.y + originY };
}
