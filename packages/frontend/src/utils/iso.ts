import Phaser from 'phaser';

export type IsoGridOptions = {
  rows: number;
  cols: number;
  tileW: number;
  tileH: number;
  originX: number;
  originY: number;
  fill?: number;
  stroke?: number;
};

export function isoToScreen(
  r: number,
  c: number,
  tileW: number,
  tileH: number,
  originX: number,
  originY: number,
): { x: number; y: number };
export function isoToScreen(
  r: number,
  c: number,
  opts: { tileW: number; tileH: number; originX: number; originY: number },
): { x: number; y: number };
export function isoToScreen(
  r: number,
  c: number,
  a: number | { tileW: number; tileH: number; originX: number; originY: number },
  b?: number,
  originX?: number,
  originY?: number,
) {
  const tileW = typeof a === 'number' ? a : a.tileW;
  const tileH = typeof a === 'number' ? (b as number) : a.tileH;
  const ox = typeof a === 'number' ? (originX as number) : a.originX;
  const oy = typeof a === 'number' ? (originY as number) : a.originY;
  const x = (c - r) * (tileW / 2) + ox;
  const y = (c + r) * (tileH / 2) + oy;
  return { x, y };
}

export function screenToIso(
  x: number,
  y: number,
  tileW: number,
  tileH: number,
  originX: number,
  originY: number,
) {
  // Inverse transform for diamond iso grid
  const dx = x - originX;
  const dy = y - originY;
  const c = Math.round((dx / (tileW / 2) + dy / (tileH / 2)) / 2);
  const r = Math.round((dy / (tileH / 2) - dx / (tileW / 2)) / 2);
  return { r, c };
}

export function drawDiamond(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  tileW: number,
  tileH: number,
) {
  const pts = [
    new Phaser.Geom.Point(x, y - tileH / 2),
    new Phaser.Geom.Point(x + tileW / 2, y),
    new Phaser.Geom.Point(x, y + tileH / 2),
    new Phaser.Geom.Point(x - tileW / 2, y),
  ];
  g.fillPoints(pts, true);
  g.strokePoints(pts, true);
}

export function buildIsoGrid(scene: Phaser.Scene, opts: IsoGridOptions) {
  const { rows, cols, tileW, tileH, originX, originY, fill = 0x0b1220, stroke = 0x1f2937 } = opts;
  const g = scene.add.graphics();
  g.lineStyle(1, stroke, 1);
  g.fillStyle(fill, 1);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const { x, y } = isoToScreen(r, c, tileW, tileH, originX, originY);
      drawDiamond(g, x, y, tileW, tileH);
    }
  }
  return g;
}
