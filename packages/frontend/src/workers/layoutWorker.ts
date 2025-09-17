// Simple layout worker: find non-overlapping ring position
export type WorkIn = {
  cx: number;
  cy: number;
  sevRadius: number;
  padding: number;
  rMin: number;
  rMax: number;
  others: { x: number; y: number; r: number }[];
};

function isNonOverlapping(
  x: number,
  y: number,
  r: number,
  padding: number,
  others: { x: number; y: number; r: number }[],
): boolean {
  for (let i = 0; i < others.length; i++) {
    const o = others[i];
    const min = r + o.r + padding;
    const dx = x - o.x;
    const dy = y - o.y;
    if (dx * dx + dy * dy < min * min) return false;
  }
  return true;
}

onmessage = (ev: MessageEvent<WorkIn>) => {
  const { cx, cy, sevRadius, padding } = ev.data;
  let { rMin, rMax } = ev.data;
  const attempts = 24;
  // Cheap RNG
  function rand() {
    return Math.random();
  }
  for (let a = 0; a < attempts; a++) {
    const angle = rand() * Math.PI * 2;
    const dist = rMin + rand() * (rMax - rMin);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    if (isNonOverlapping(x, y, sevRadius, padding, ev.data.others)) {
      postMessage({ x, y });
      return;
    }
    if (a % 6 === 5) {
      rMin += 8;
      rMax += 8;
    }
  }
  const angle = Math.random() * Math.PI * 2;
  const dist = rMin + Math.random() * (rMax - rMin);
  postMessage({ x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist });
};
