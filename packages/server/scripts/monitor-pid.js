/*
 Monitor a process's CPU and memory over time and write samples to JSON.

 Usage:
  node scripts/monitor-pid.js --pid 12345 --duration 65 --interval 1000 --out /tmp/metrics.json
*/
/* eslint-disable no-console */
const fs = require('node:fs');
const pidusage = require('pidusage');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { pid: 0, duration: 60, interval: 1000, out: '' };
  for (let i = 0; i < args.length; i++) {
    const k = args[i];
    const v = args[i + 1];
    if (k === '--pid' && v) out.pid = Number(v);
    if (k === '--duration' && v) out.duration = Number(v);
    if (k === '--interval' && v) out.interval = Number(v);
    if (k === '--out' && v) out.out = v;
  }
  return out;
}

async function run() {
  const opts = parseArgs();
  if (!opts.pid) { console.error('[monitor] --pid required'); process.exit(1); }
  const endAt = Date.now() + opts.duration * 1000;
  const samples = [];
  console.log(`[monitor] start pid=${opts.pid} duration=${opts.duration}s interval=${opts.interval}ms`);
  while (Date.now() < endAt) {
    try {
      // pidusage returns cpu (percent) and memory (bytes)
      const stat = await pidusage(opts.pid);
      samples.push({ ts: Date.now(), cpu: stat.cpu, memoryBytes: stat.memory });
    } catch (e) {
      // likely process exited; record and break
      samples.push({ ts: Date.now(), error: String(e && e.message) });
      break;
    }
    await new Promise((r) => setTimeout(r, opts.interval));
  }
  // Summary
  const cpus = samples.filter(s => typeof s.cpu === 'number').map(s => s.cpu);
  const mems = samples.filter(s => typeof s.memoryBytes === 'number').map(s => s.memoryBytes);
  const avg = (arr) => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
  const max = (arr) => arr.length ? Math.max(...arr) : 0;
  const result = {
    pid: opts.pid,
    intervalMs: opts.interval,
    durationSec: opts.duration,
    samples,
    summary: {
      cpu: { avgPct: Number(avg(cpus).toFixed(2)), maxPct: Number(max(cpus).toFixed(2)) },
      memory: { avgBytes: Math.round(avg(mems)), maxBytes: Math.round(max(mems)) },
    },
  };
  console.log('[monitor] done');
  if (opts.out) {
    try { fs.writeFileSync(opts.out, JSON.stringify(result, null, 2)); } catch {}
  }
}

run().catch((e) => { console.error('[monitor] error', e); process.exit(1); });

