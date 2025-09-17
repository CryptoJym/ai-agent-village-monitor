type Listener = () => void;

const travelStarts: number[] = [];
const samples: number[] = [];
const listeners = new Set<Listener>();

export function startTravel() {
  travelStarts.push(performance.now());
}

export function endTravel() {
  const start = travelStarts.shift();
  if (typeof start === 'number') {
    const dur = performance.now() - start;
    samples.push(dur);
    if (samples.length > 200) samples.shift();
    for (const l of listeners) l();
    return dur;
  }
  return undefined;
}

export function getTravelStats() {
  const count = samples.length;
  const last = count ? samples[count - 1] : undefined;
  const avg = count ? samples.reduce((a, b) => a + b, 0) / count : undefined;
  let p95: number | undefined = undefined;
  if (count) {
    const sorted = [...samples].sort((a, b) => a - b);
    p95 = sorted[Math.max(0, Math.floor(count * 0.95) - 1)];
  }
  return { count, last, avg, p95 };
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
