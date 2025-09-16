export type Cell = { x: number; y: number };

export class Grid {
  width: number;
  height: number;
  blocked: boolean[];
  constructor(width: number, height: number, blocked?: boolean[]) {
    this.width = width;
    this.height = height;
    this.blocked = blocked ?? new Array(width * height).fill(false);
  }
  idx(x: number, y: number) {
    return y * this.width + x;
  }
  inBounds(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }
  isFree(x: number, y: number) {
    return this.inBounds(x, y) && !this.blocked[this.idx(x, y)];
  }
  setBlocked(x: number, y: number, v = true) {
    if (this.inBounds(x, y)) this.blocked[this.idx(x, y)] = v;
  }
}

export function aStar(grid: Grid, start: Cell, goal: Cell): Cell[] | null {
  const key = (c: Cell) => `${c.x},${c.y}`;
  const open: Cell[] = [start];
  const came = new Map<string, string>();
  const g = new Map<string, number>();
  g.set(key(start), 0);
  const f = new Map<string, number>();
  f.set(key(start), heuristic(start, goal));

  while (open.length) {
    // pop lowest f
    open.sort((a, b) => f.get(key(a))! - f.get(key(b))!);
    const current = open.shift()!;
    if (current.x === goal.x && current.y === goal.y) return reconstruct(came, current);
    for (const n of neighbors(grid, current)) {
      const nk = key(n);
      const ck = key(current);
      const tentative = (g.get(ck) ?? Infinity) + 1;
      if (tentative < (g.get(nk) ?? Infinity)) {
        came.set(nk, ck);
        g.set(nk, tentative);
        f.set(nk, tentative + heuristic(n, goal));
        if (!open.find((c) => c.x === n.x && c.y === n.y)) open.push(n);
      }
    }
  }
  return null;
}

function heuristic(a: Cell, b: Cell) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function neighbors(grid: Grid, c: Cell): Cell[] {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const out: Cell[] = [];
  for (const [dx, dy] of dirs) {
    const nx = c.x + dx,
      ny = c.y + dy;
    if (grid.isFree(nx, ny)) out.push({ x: nx, y: ny });
  }
  return out;
}

function reconstruct(came: Map<string, string>, current: Cell): Cell[] {
  const path: Cell[] = [current];
  const key = (c: Cell) => `${c.x},${c.y}`;
  let ck = key(current);
  while (came.has(ck)) {
    const prev = came.get(ck)!;
    const [x, y] = prev.split(',').map((n) => parseInt(n, 10));
    path.unshift({ x, y });
    ck = prev;
  }
  return path;
}

export function simplify(path: Cell[]): Cell[] {
  if (path.length <= 2) return path.slice();
  const out: Cell[] = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const a = out[out.length - 1];
    const b = path[i];
    const c = path[i + 1];
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const bc = { x: c.x - b.x, y: c.y - b.y };
    if (ab.x === bc.x && ab.y === bc.y) continue; // collinear (same direction)
    out.push(b);
  }
  out.push(path[path.length - 1]);
  return out;
}
