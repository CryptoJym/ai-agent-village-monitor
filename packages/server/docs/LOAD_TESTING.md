Local WebSocket Load & Latency Testing

This project includes lightweight Socket.IO load scripts to validate connection throughput and latency locally. These are intended for developer machines and CI smoke checks.

Prerequisites
- Start the server: `pnpm -C packages/server build && pnpm -C packages/server start` (or `dev`)
- Auth: If the server enforces JWT (JWT_SECRET set), provide the same secret to the load script via `--jwt-secret` or environment.

Quick Start (websocket transport)
```
pnpm -C packages/server load:ws:websocket -- --url=http://localhost:3000 --clients=200 --ramp=30 --time=60 --jwt-secret="$JWT_SECRET" --village=1
```

Polling fallback
```
pnpm -C packages/server load:ws:polling -- --url=http://localhost:3000 --clients=200 --ramp=30 --time=60 --jwt-secret="$JWT_SECRET" --village=1
```

Polling-only preset with CSV export
```
# Writes metrics to packages/server/load-polling.csv by default
pnpm -C packages/server load:scenario:polling -- --url=http://localhost:3000 --jwt-secret="$JWT_SECRET" --village=1
```

Environment-based runner (minimal)
```
# Uses WS_* envs
WS_URL=http://localhost:3000 WS_CLIENTS=50 WS_DURATION_MS=10000 node scripts/ws-load.mjs
```

Arguments (scripts/ws-load.js)
- `--url` Base server URL (default: `http://localhost:3000`)
- `--clients` Number of concurrent clients (default: 100)
- `--ramp` Seconds to ramp up all clients (default: 30)
- `--time` Total test duration in seconds (default: 60)
- `--transport` `websocket` | `polling` | omit for both
- `--jwt-secret` Secret used to sign test access tokens (required if server enforces auth)
- `--village` Optional village id to join (ack-based)
- `--repo` Optional repo id to join (ack-based)

Output
- Periodic line: `conns=X/Y fail=Z p50=NN.Nms p95=NN.Nms evloop.max=NN.Nms mem.rss=NN.NMB`
  - p50/p95: client→server→client RTT measured via `ping` ack
  - evloop.max: max event-loop delay between prints (coarse health signal)

CSV export
- Add `--csv=path.csv` to write metrics each tick. Use `--csv-append=true` to append to an existing file.
- Columns: `timestamp,t_s,conns,clients,fail,p50_ms,p95_ms,evloop_max_ms,mem_rss_mb,transport`.

Tips
- For stable numbers, close other heavy apps and disable throttling/energy savers.
- Use smaller concurrency in CI (e.g., 20–50). Increase locally.
- Test both transports to ensure polling fallback works under load.

HTTP load with k6
------------------

Scripts: `packages/server/load/k6-http.js`

Run (requires k6 installed):

```
BASE_URL=http://localhost:3000 TOKEN=YOUR_JWT pnpm -F @ai-agent-village-monitor/server load:k6:smoke
```

Ramp profile:

```
BASE_URL=http://localhost:3000 TOKEN=YOUR_JWT pnpm -F @ai-agent-village-monitor/server load:k6:ramp
```

Thresholds:
- http_req_failed < 1%
- p95 http_req_duration < 300ms

WebSocket with Artillery
------------------------

Scenario: `packages/server/load/artillery-ws.yml` (Socket.IO engine)

Run (requires Artillery and socket.io engine):

```
TOKEN=YOUR_JWT pnpm -F @ai-agent-village-monitor/server load:artillery:smoke
```

Customize phases for ramp and soak testing as needed.
