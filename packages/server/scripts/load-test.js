/*
 Local load and latency test for Socket.IO server

 Usage examples:
  node scripts/load-test.js --url http://localhost:3000 --clients 50 --duration 15 --village demo

 Options:
  --url        Base URL of server (default: http://localhost:3000)
  --clients    Number of concurrent connections (default: 25)
  --duration   Test duration in seconds (default: 15)
  --pingInt    Ping interval in ms (default: 1000)
  --village    Village id to join (optional)
*/
const { io } = require('socket.io-client');

const fs = require('node:fs');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    url: 'http://localhost:3000',
    clients: 25,
    duration: 15,
    pingInt: 1000,
    village: '',
    out: '',
  };
  for (let i = 0; i < args.length; i++) {
    const k = args[i];
    const v = args[i + 1];
    if (k === '--url' && v) out.url = v;
    if (k === '--clients' && v) out.clients = Number(v);
    if (k === '--duration' && v) out.duration = Number(v);
    if (k === '--pingInt' && v) out.pingInt = Number(v);
    if (k === '--village' && v) out.village = v;
    if (k === '--out' && v) out.out = v;
  }
  return out;
}

function pct(arr, p) {
  if (!arr.length) return 0;
  const a = [...arr].sort((a, b) => a - b);
  const idx = Math.min(a.length - 1, Math.max(0, Math.floor((p / 100) * a.length)));
  return a[idx];
}

async function run() {
  const opts = parseArgs();
  console.log(`[load] start url=${opts.url} clients=${opts.clients} duration=${opts.duration}s`);

  const sockets = [];
  const stats = {
    connected: 0,
    errors: 0,
    pings: [], // rtt ms across all clients
    workStream: 0,
    spawns: 0,
    resolved: 0,
  };

  const endAt = Date.now() + opts.duration * 1000;

  function connectOne() {
    const s = io(opts.url, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 500,
    });
    let pingTimer = null;
    let lastPingStart = 0;

    s.on('connect', () => {
      stats.connected++;
      if (opts.village) s.emit('join_village', { villageId: opts.village });
      // periodic ping RTT using socket.io custom ack
      pingTimer = setInterval(() => {
        if (!s.connected) return;
        lastPingStart = performance.now();
        s.timeout(2000).emit('ping', () => {
          const rtt = performance.now() - lastPingStart;
          stats.pings.push(rtt);
        });
      }, opts.pingInt);
    });

    s.on('connect_error', () => {
      stats.errors++;
    });
    s.on('disconnect', () => {
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
    });
    s.on('work_stream', () => {
      stats.workStream++;
    });
    s.on('bug_bot_spawn', () => {
      stats.spawns++;
    });
    s.on('bug_bot_resolved', () => {
      stats.resolved++;
    });

    sockets.push(s);
  }

  for (let i = 0; i < opts.clients; i++) connectOne(i);

  // Wait until end
  const remain = endAt - Date.now();
  if (remain > 0) await new Promise((r) => setTimeout(r, remain));

  // Cleanup
  await Promise.allSettled(
    sockets.map(
      (s) =>
        new Promise((res) => {
          try {
            s.close();
          } catch {}
          setTimeout(res, 10);
        }),
    ),
  );

  const mean = stats.pings.length ? stats.pings.reduce((a, b) => a + b, 0) / stats.pings.length : 0;
  const med = pct(stats.pings, 50);
  const p95 = pct(stats.pings, 95);

  const result = {
    url: opts.url,
    clients: opts.clients,
    durationSec: opts.duration,
    connected: stats.connected,
    connectErrors: stats.errors,
    pings: {
      count: stats.pings.length,
      meanMs: Number(mean.toFixed(2)),
      medianMs: Number(med.toFixed(2)),
      p95Ms: Number(p95.toFixed(2)),
    },
    events: {
      work_stream: stats.workStream,
      bug_bot_spawn: stats.spawns,
      bug_bot_resolved: stats.resolved,
    },
    startedAt: new Date(Date.now() - opts.duration * 1000).toISOString(),
    endedAt: new Date().toISOString(),
  };
  console.log('\n[load] results');
  console.log(JSON.stringify(result, null, 2));
  if (opts.out) {
    try {
      fs.writeFileSync(opts.out, JSON.stringify(result, null, 2));
    } catch {}
  }
}

run().catch((e) => {
  console.error('[load] error', e);
  process.exit(1);
});
