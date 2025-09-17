export class SpatialHash {
  private cellSize: number;
  private cells: Map<string, Set<string>> = new Map();
  private positions: Map<string, { x: number; y: number }> = new Map();

  constructor(cellSize = 96) {
    this.cellSize = Math.max(8, cellSize);
  }

  private cellKeyFor(x: number, y: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }

  private cellsInRect(x1: number, y1: number, x2: number, y2: number): string[] {
    const minX = Math.floor(x1 / this.cellSize);
    const minY = Math.floor(y1 / this.cellSize);
    const maxX = Math.floor(x2 / this.cellSize);
    const maxY = Math.floor(y2 / this.cellSize);
    const keys: string[] = [];
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        keys.push(`${cx},${cy}`);
      }
    }
    return keys;
  }

  insert(id: string, x: number, y: number): void {
    const key = this.cellKeyFor(x, y);
    let set = this.cells.get(key);
    if (!set) {
      set = new Set();
      this.cells.set(key, set);
    }
    set.add(id);
    this.positions.set(id, { x, y });
  }

  remove(id: string): void {
    const pos = this.positions.get(id);
    if (!pos) return;
    const key = this.cellKeyFor(pos.x, pos.y);
    const set = this.cells.get(key);
    if (set) {
      set.delete(id);
      if (set.size === 0) this.cells.delete(key);
    }
    this.positions.delete(id);
  }

  update(id: string, x: number, y: number): void {
    const prev = this.positions.get(id);
    if (!prev) {
      this.insert(id, x, y);
      return;
    }
    const prevKey = this.cellKeyFor(prev.x, prev.y);
    const nextKey = this.cellKeyFor(x, y);
    if (prevKey !== nextKey) {
      const set = this.cells.get(prevKey);
      if (set) {
        set.delete(id);
        if (set.size === 0) this.cells.delete(prevKey);
      }
      let next = this.cells.get(nextKey);
      if (!next) {
        next = new Set();
        this.cells.set(nextKey, next);
      }
      next.add(id);
    }
    this.positions.set(id, { x, y });
  }

  queryRect(x1: number, y1: number, x2: number, y2: number): Set<string> {
    const result = new Set<string>();
    for (const key of this.cellsInRect(x1, y1, x2, y2)) {
      const set = this.cells.get(key);
      if (set) for (const id of set) result.add(id);
    }
    return result;
  }
}
