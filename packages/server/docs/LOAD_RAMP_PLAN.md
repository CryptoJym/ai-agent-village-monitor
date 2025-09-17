# Load & Soak Ramp Plan

## Profiles

- Smoke: 10 VUs, 30s, validate basic health and command endpoints
- Ramp: 0 → 100 → 300 VUs over 2.5 minutes (k6)
- Soak: 200 VUs for 30 minutes to surface leaks and GC pressure (optional)

## WebSocket

- Arrival: 20 rps for 30s, then 100 rps for 60s (Artillery)
- Each client joins `village:demo`, emits `ping` every 200ms for 10 iterations

## Targets & SLAs

See PERFORMANCE_SLA.md for full detail. Key targets:

- HTTP p95 < 300ms, p99 < 600ms; error rate < 1%
- WS RTT p95 < 200ms, error rate < 1%
- CPU < 70% avg, memory stable within ±10%

## Datasets

Use `pnpm -F @ai-agent-village-monitor/server db:seed:load` with:

```
SEED_VILLAGES=20 SEED_HOUSES_PER=25 SEED_AGENTS_PER=5 SEED_BUGS_PER=50 pnpm -F @ai-agent-village-monitor/server db:seed:load
```

## Execution

1. Start Postgres/Redis:

```
docker compose up -d postgres redis
```

2. Start server with `.env.staging.example` copied to `.env` and adjusted.

3. Run k6 smoke:

```
BASE_URL=http://localhost:3000 TOKEN=$JWT pnpm -F @ai-agent-village-monitor/server load:k6:smoke
```

4. Run Artillery WS:

```
TOKEN=$JWT pnpm -F @ai-agent-village-monitor/server load:artillery:smoke
```

5. Ramp:

```
BASE_URL=http://localhost:3000 TOKEN=$JWT pnpm -F @ai-agent-village-monitor/server load:k6:ramp
```

## Observability

- Enable `AUDIT_LOG_FILE=./audit.log`
- Monitor CPU/memory (`top`, `docker stats`); capture snapshots at 0/50/100% ramp
- Record p95/p99 latencies and error counts; compare against thresholds.json
