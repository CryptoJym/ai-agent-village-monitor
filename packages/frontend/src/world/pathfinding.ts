export interface PathOptions {
  width: number;
  height: number;
  isWalkable: (x: number, y: number) => boolean;
}

export interface Point2D {
  x: number;
  y: number;
}

export function findGridPath(start: Point2D, goal: Point2D, opts: PathOptions): Point2D[] | null {
  if (start.x === goal.x && start.y === goal.y) {
    return [start];
  }

  const queue: Point2D[] = [start];
  const visited = new Set<string>([key(start.x, start.y)]);
  const cameFrom = new Map<string, Point2D>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of neighbors(current)) {
      if (
        neighbor.x < 0 ||
        neighbor.y < 0 ||
        neighbor.x >= opts.width ||
        neighbor.y >= opts.height
      ) {
        continue;
      }
      if (!opts.isWalkable(neighbor.x, neighbor.y)) continue;
      const hash = key(neighbor.x, neighbor.y);
      if (visited.has(hash)) continue;
      visited.add(hash);
      cameFrom.set(hash, current);
      if (neighbor.x === goal.x && neighbor.y === goal.y) {
        return reconstructPath(start, goal, cameFrom);
      }
      queue.push(neighbor);
    }
  }

  return null;
}

function neighbors(p: Point2D): Point2D[] {
  return [
    { x: p.x + 1, y: p.y },
    { x: p.x - 1, y: p.y },
    { x: p.x, y: p.y + 1 },
    { x: p.x, y: p.y - 1 },
  ];
}

function reconstructPath(start: Point2D, goal: Point2D, cameFrom: Map<string, Point2D>): Point2D[] {
  const path: Point2D[] = [goal];
  let current = goal;
  while (!(current.x === start.x && current.y === start.y)) {
    const prev = cameFrom.get(key(current.x, current.y));
    if (!prev) break;
    path.push(prev);
    current = prev;
  }
  return path.reverse();
}

const key = (x: number, y: number) => `${x},${y}`;
