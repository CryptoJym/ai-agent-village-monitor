export type GridPos = { r: number; c: number };
export type GridTx = {
  rows: number;
  cols: number;
  tileW: number;
  tileH: number;
  originX: number;
  originY: number;
};

// Generate grid positions with given spacing (in tiles)
export function generateGridPositions(
  count: number,
  rows: number,
  cols: number,
  spacing = 2,
): GridPos[] {
  const out: GridPos[] = [];
  for (let r = 0; r < rows; r += spacing) {
    for (let c = 0; c < cols; c += spacing) {
      out.push({ r, c });
      if (out.length >= count) return out;
    }
  }
  return out;
}

// Jitter positions slightly within a 1-tile neighborhood while enforcing boundaries
export function jitterPositions(
  positions: GridPos[],
  rows: number,
  cols: number,
  maxJitter = 1,
): GridPos[] {
  return positions.map(({ r, c }) => {
    const jr = Math.max(
      0,
      Math.min(rows - 1, r + (Math.floor(Math.random() * (2 * maxJitter + 1)) - maxJitter)),
    );
    const jc = Math.max(
      0,
      Math.min(cols - 1, c + (Math.floor(Math.random() * (2 * maxJitter + 1)) - maxJitter)),
    );
    return { r: jr, c: jc };
  });
}

export function toWorld(positions: GridPos[], tx: GridTx): { x: number; y: number }[] {
  const { isoToScreen } = require('./iso');
  return positions.map((p) => isoToScreen(p.r, p.c, tx.tileW, tx.tileH, tx.originX, tx.originY));
}
