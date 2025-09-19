type Labels = Record<string, string>;

const counters = new Map<string, number>();
const gauges = new Map<string, { value: number; labels: Labels }>();
const histograms = new Map<
  string,
  { sum: number; count: number; buckets: number[]; counts: number[]; labels: Labels }
>();

function keyFor(name: string, labels?: Labels) {
  if (!labels || Object.keys(labels).length === 0) return name;
  const parts = Object.keys(labels)
    .sort()
    .map((k) => `${k}=${labels[k]}`)
    .join('|');
  return `${name}|${parts}`;
}

// Overloads: inc(name, by) or inc(name, labels, by?)
export function inc(name: string, by?: number): void;
export function inc(name: string, labels?: Labels, by?: number): void;
export function inc(name: string, a?: number | Labels, b?: number) {
  let labels: Labels | undefined;
  let value = 1;
  if (typeof a === 'number') {
    value = a;
  } else if (typeof a === 'object' && a) {
    labels = a as Labels;
    if (typeof b === 'number') value = b;
  }
  const k = keyFor(name, labels);
  counters.set(k, (counters.get(k) || 0) + value);
}

export function observe(
  name: string,
  value: number,
  labels?: Labels,
  buckets: number[] = [5, 10, 25, 50, 100, 250, 500, 1000, 2000],
) {
  const k = keyFor(name, labels);
  let h = histograms.get(k);
  if (!h) {
    h = {
      sum: 0,
      count: 0,
      buckets: [...buckets],
      counts: new Array(buckets.length + 1).fill(0),
      labels: labels || {},
    };
    histograms.set(k, h);
  }
  h.sum += value;
  h.count += 1;
  let idx = h.buckets.findIndex((b) => value <= b);
  if (idx < 0) idx = h.counts.length - 1; // +Inf bucket
  h.counts[idx] += 1;
}

export function recordEvent(name: string) {
  inc(name, 1);
}

export function getMetrics() {
  const obj: Record<string, any> = {};
  for (const [k, v] of counters.entries()) obj[k] = v;
  for (const [k, g] of gauges.entries()) obj[k] = { value: g.value, labels: g.labels };
  for (const [k, h] of histograms.entries())
    obj[k] = { sum: h.sum, count: h.count, buckets: h.buckets, counts: h.counts };
  return obj;
}

export function getPrometheus(): string {
  const lines: string[] = [];
  for (const [k, v] of counters.entries()) {
    const [name, labelsStr] = k.split('|', 2);
    const lbls = labelsStr
      ? '{' +
        labelsStr
          .split('|')
          .map((p) => {
            const [lk, lv] = p.split('=');
            return `${lk}="${lv}"`;
          })
          .join(',') +
        '}'
      : '';
    lines.push(`${name}${lbls} ${v}`);
  }
  for (const [k, g] of gauges.entries()) {
    const [name, labelsStr] = k.split('|', 2);
    const lbls = labelsStr
      ? '{' +
        labelsStr
          .split('|')
          .map((p) => {
            const [lk, lv] = p.split('=');
            return `${lk}="${lv}"`;
          })
          .join(',') +
        '}'
      : '';
    lines.push(`${name}${lbls} ${g.value}`);
  }
  for (const [k, h] of histograms.entries()) {
    const [name, labelsStr] = k.split('|', 2);
    const baseLabels = labelsStr
      ? (Object.fromEntries(labelsStr.split('|').map((p) => p.split('='))) as Labels)
      : {};
    let cum = 0;
    for (let i = 0; i < h.counts.length; i++) {
      cum += h.counts[i];
      const le = i < h.buckets.length ? h.buckets[i] : '+Inf';
      const allLabels = { ...baseLabels, le: String(le) };
      const lbls =
        '{' +
        Object.keys(allLabels)
          .sort()
          .map((lk) => `${lk}="${allLabels[lk]}"`)
          .join(',') +
        '}';
      lines.push(`${name}_bucket${lbls} ${cum}`);
    }
    const baseLblStr = labelsStr
      ? '{' +
        Object.keys(baseLabels)
          .sort()
          .map((lk) => `${lk}="${baseLabels[lk]}"`)
          .join(',') +
        '}'
      : '';
    lines.push(`${name}_sum${baseLblStr} ${h.sum}`);
    lines.push(`${name}_count${baseLblStr} ${h.count}`);
  }
  return lines.join('\n') + '\n';
}

export function setGauge(name: string, value: number, labels?: Labels) {
  const k = keyFor(name, labels);
  gauges.set(k, { value, labels: labels || {} });
}

// Convenience HTTP metrics helper
export function httpInc(method: string, route: string, status: number) {
  try {
    inc('http_requests_total', { method, route, status: String(status) });
  } catch {
    // Metrics emission failures are non-fatal for request tracking.
  }
}
