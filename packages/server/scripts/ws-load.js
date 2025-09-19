#!/usr/bin/env node
/*
  Simple Socket.IO load + latency tester for local runs.

  Usage examples:
    node scripts/ws-load.js --url=http://localhost:3000 --clients=200 --ramp=30 --time=60 --transport=websocket
    node scripts/ws-load.js --clients=1000 --ramp=60 --time=120 --transport=polling \
      --jwt-secret="$JWT_SECRET" --village=1 --repo=1

  Notes:
  - Requires JWT_SECRET (env or --jwt-secret) when the server enforces auth.
  - Measures RTT using a client → server "ping" event with ack.
  - Prints aggregate p50/p95 latency and connection stats periodically and on exit.
*/

const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const { monitorEventLoopDelay } = require('perf_hooks');

function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
    else if (a.startsWith('--')) out[a.slice(2)] = 'true';
  }
  return out;
}

function pickTransport(t) {
  if (t === 'polling') return ['polling'];
  if (t === 'websocket') return ['websocket'];
  return ['websocket', 'polling'];
}

function signAccess(userId, username, secret) {
  const payload = { sub: String(userId), username, type: 'access' };
  return jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '1h' });
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * (s.length - 1));
  return s[idx];
}

async function main() {
  const args = parseArgs(process.argv);
  const url = args.url || process.env.SERVER_URL || 'http://localhost:3000';
  const clients = Number(args.clients || 100);
  const ramp = Number(args.ramp || 30); // seconds to ramp up all clients
  const time = Number(args.time || 60); // total test time in seconds
  const transport = pickTransport(args.transport || 'websocket');
  const jwtSecret = args['jwt-secret'] || process.env.JWT_SECRET || '';
  const village = args.village; // optional join target
  const repo = args.repo; // optional join target
  const csvFlag = args.csv; // can be 'true' or a path
  const csvPath = csvFlag
    ? csvFlag === 'true'
      ? args['csv-path'] || 'load-metrics.csv'
      : csvFlag
    : '';
  const csvAppend = args['csv-append'] === 'true' || args['csv-append'] === '1';

  if (!jwtSecret) {
    console.warn(
      '[load] No JWT secret provided; connections will be rejected if server enforces auth.',
    );
  }

  console.log(
    `[load] target=${url} clients=${clients} ramp=${ramp}s time=${time}s transport=${transport.join(',')}`,
  );

  const rtts = new Array(clients).fill(0);
  const sockets = new Array(clients).fill(null);
  const connected = new Set();
  const failed = new Set();
  const loop = monitorEventLoopDelay({ resolution: 20 });
  loop.enable();
  const metrics = [];

  function connectOne(i) {
    const token = jwtSecret ? signAccess(i + 1, `u${i + 1}`, jwtSecret) : undefined;
    const socket = io(url, {
      transports: transport,
      forceNew: true,
      reconnection: false,
      timeout: 8000,
      auth: token ? { token } : undefined,
    });
    sockets[i] = socket;

    socket.on('connect', async () => {
      connected.add(i);
      // Optional joins (ack-based)
      try {
        if (village)
          await new Promise((resolve) =>
            socket
              .timeout(2000)
              .emit('join_village', { villageId: String(village) }, () => resolve(undefined)),
          );
        if (repo)
          await new Promise((resolve) =>
            socket
              .timeout(2000)
              .emit('join_repo', { repoId: String(repo) }, () => resolve(undefined)),
          );
      } catch {}
      // Start periodic RTT checks per client
      const tick = () => {
        const start = Date.now();
        try {
          socket.timeout(2000).emit('ping', () => {
            rtts[i] = Date.now() - start;
          });
        } catch {}
      };
      tick();
      const int = setInterval(tick, 5000);
      socket.on('disconnect', () => clearInterval(int));
    });
    socket.on('connect_error', (err) => {
      failed.add(i);
      console.error('[load] connect_error', { i, code: err?.data?.code || err?.message });
    });
  }

  // Ramp up
  const intervalMs = Math.max(1, Math.floor((ramp * 1000) / clients));
  for (let i = 0; i < clients; i++) {
    setTimeout(() => connectOne(i), i * intervalMs);
  }

  const start = Date.now();
  const print = setInterval(() => {
    const now = Date.now();
    const secs = Math.round((now - start) / 1000);
    const sample = rtts.filter((v) => v > 0);
    const p50n = percentile(sample, 50);
    const p95n = percentile(sample, 95);
    const p50 = p50n.toFixed(1);
    const p95 = p95n.toFixed(1);
    const lagN = loop.max / 1e6; // ns → ms
    const lag = lagN.toFixed(1);
    const rssMBn = process.memoryUsage().rss / 1e6;
    const rssMB = rssMBn.toFixed(1);
    loop.reset();
    console.log(
      `[load] t=${secs}s conns=${connected.size}/${clients} fail=${failed.size} p50=${p50}ms p95=${p95}ms evloop.max=${lag}ms mem.rss=${rssMB}MB`,
    );
    metrics.push({
      timestamp: new Date().toISOString(),
      t_s: secs,
      conns: connected.size,
      clients,
      fail: failed.size,
      p50_ms: Number(p50),
      p95_ms: Number(p95),
      evloop_max_ms: Number(lag),
      mem_rss_mb: Number(rssMB),
      transport: transport.join('+'),
    });
  }, 2000);

  // Stop after test duration
  setTimeout(
    () => {
      clearInterval(print);
      const sample = rtts.filter((v) => v > 0);
      const p50 = percentile(sample, 50).toFixed(1);
      const p95 = percentile(sample, 95).toFixed(1);
      const lag = (loop.max / 1e6).toFixed(1);
      console.log(
        `[load] DONE conns=${connected.size}/${clients} fail=${failed.size} p50=${p50}ms p95=${p95}ms evloop.max=${lag}ms`,
      );
      if (csvPath) {
        const fs = require('fs');
        const header =
          'timestamp,t_s,conns,clients,fail,p50_ms,p95_ms,evloop_max_ms,mem_rss_mb,transport\n';
        const rows =
          metrics
            .map(
              (m) =>
                `${m.timestamp},${m.t_s},${m.conns},${m.clients},${m.fail},${m.p50_ms},${m.p95_ms},${m.evloop_max_ms},${m.mem_rss_mb},${m.transport}`,
            )
            .join('\n') + '\n';
        try {
          if (csvAppend && fs.existsSync(csvPath)) {
            fs.appendFileSync(csvPath, rows);
          } else {
            fs.writeFileSync(csvPath, header + rows);
          }
          console.log(`[load] wrote CSV metrics to ${csvPath} (${metrics.length} rows)`);
        } catch (e) {
          console.error('[load] failed to write CSV', e);
        }
      }
      for (const s of sockets)
        try {
          s?.close();
        } catch {}
      process.exit(0);
    },
    Math.max(1, time) * 1000,
  );
}

main().catch((e) => {
  console.error('[load] fatal', e);
  process.exit(1);
});
