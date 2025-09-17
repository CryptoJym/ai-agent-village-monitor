export class SpatialHash<T extends { x: number; y: number }> {
  private cellSize: number;
  private cells = new Map<string, Set<string>>();
  private items = new Map<string, T>();
  private keyFn: (item: T) => string;

  constructor(cellSize = 64, keyFn: (item: T) => string) {
    this.cellSize = cellSize;
    this.keyFn = keyFn;
  }

  private cellKey(cx: number, cy: number) {
    return `${cx}:${cy}`;
  }

  private coords(x: number, y: number) {
    return { cx: Math.floor(x / this.cellSize), cy: Math.floor(y / this.cellSize) };
  }

  insert(item: T) {
    const id = this.keyFn(item);
    this.items.set(id, item);
    const { cx, cy } = this.coords(item.x, item.y);
    const k = this.cellKey(cx, cy);
    let set = this.cells.get(k);
    if (!set) this.cells.set(k, (set = new Set()));
    set.add(id);
  }

  remove(id: string) {
    const item = this.items.get(id);
    if (!item) return;
    const { cx, cy } = this.coords(item.x, item.y);
    const k = this.cellKey(cx, cy);
    const set = this.cells.get(k);
    if (set) set.delete(id);
    this.items.delete(id);
  }

  update(id: string, newX: number, newY: number) {
    const item = this.items.get(id);
    if (!item) return;
    const { cx: ocx, cy: ocy } = this.coords(item.x, item.y);
    const { cx, cy } = this.coords(newX, newY);
    if (ocx !== cx || ocy !== cy) {
      const ok = this.cellKey(ocx, ocy);
      const nk = this.cellKey(cx, cy);
      const oset = this.cells.get(ok);
      if (oset) oset.delete(id);
      let nset = this.cells.get(nk);
      if (!nset) this.cells.set(nk, (nset = new Set()));
      nset.add(id);
    }
    item.x = newX;
    item.y = newY;
  }

  queryRect(x: number, y: number, w: number, h: number, out: string[] = []): string[] {
    out.length = 0;
    const { cellSize } = this;
    const x0 = Math.floor(x / cellSize);
    const y0 = Math.floor(y / cellSize);
    const x1 = Math.floor((x + w) / cellSize);
    const y1 = Math.floor((y + h) / cellSize);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const set = this.cells.get(this.cellKey(cx, cy));
        if (!set) continue;
        for (const id of set) out.push(id);
      }
    }
    return out;
  }
}
