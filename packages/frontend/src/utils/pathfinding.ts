export type Grid = { rows: number; cols: number; blocked: (r: number, c: number) => boolean };
export type Node = { r: number; c: number; g: number; f: number; parent?: Node };

function key(r: number, c: number) {
  return `${r},${c}`;
}

export function astar(
  grid: Grid,
  start: { r: number; c: number },
  goal: { r: number; c: number },
): { r: number; c: number }[] | null {
  const open: Map<string, Node> = new Map();
  const openPQ: Node[] = [];
  const closed: Set<string> = new Set();
  const h = (r: number, c: number) => Math.abs(r - goal.r) + Math.abs(c - goal.c);
  const pushOpen = (n: Node) => {
    open.set(key(n.r, n.c), n);
    openPQ.push(n);
  };
  const popBest = (): Node | undefined => {
    if (openPQ.length === 0) return undefined;
    let bi = 0;
    for (let i = 1; i < openPQ.length; i++) if (openPQ[i].f < openPQ[bi].f) bi = i;
    const n = openPQ.splice(bi, 1)[0];
    open.delete(key(n.r, n.c));
    return n;
  };

  const startNode: Node = { r: start.r, c: start.c, g: 0, f: h(start.r, start.c) };
  pushOpen(startNode);

  const inBounds = (r: number, c: number) => r >= 0 && c >= 0 && r < grid.rows && c < grid.cols;
  const neighbors = (r: number, c: number): { r: number; c: number }[] => [
    { r: r - 1, c },
    { r: r + 1, c },
    { r, c: c - 1 },
    { r, c: c + 1 },
  ];

  while (true) {
    const current = popBest();
    if (!current) return null;
    if (current.r === goal.r && current.c === goal.c) {
      // Reconstruct path
      const path: { r: number; c: number }[] = [];
      let n: Node | undefined = current;
      while (n) {
        path.push({ r: n.r, c: n.c });
        n = n.parent;
      }
      return path.reverse();
    }
    closed.add(key(current.r, current.c));
    for (const nb of neighbors(current.r, current.c)) {
      if (!inBounds(nb.r, nb.c) || grid.blocked(nb.r, nb.c)) continue;
      const k = key(nb.r, nb.c);
      if (closed.has(k)) continue;
      const tentativeG = current.g + 1;
      const existing = open.get(k);
      if (!existing || tentativeG < existing.g) {
        const f = tentativeG + h(nb.r, nb.c);
        const node: Node = { r: nb.r, c: nb.c, g: tentativeG, f, parent: current };
        if (existing) {
          existing.g = tentativeG;
          existing.f = f;
          existing.parent = current;
        } else {
          pushOpen(node);
        }
      }
    }
  }
}

export function simplifyPath(path: { r: number; c: number }[]): { r: number; c: number }[] {
  if (path.length <= 2) return path;
  const out: { r: number; c: number }[] = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const a = out[out.length - 1];
    const b = path[i];
    const c = path[i + 1];
    const dr1 = b.r - a.r;
    const dc1 = b.c - a.c;
    const dr2 = c.r - b.r;
    const dc2 = c.c - b.c;
    if (dr1 === dr2 && dc1 === dc2) continue; // colinear, skip b
    out.push(b);
  }
  out.push(path[path.length - 1]);
  return out;
}
