Performance Thresholds & SLAs

Scope

- HTTP API (Express)
- WebSocket (Socket.IO)
- Background jobs (BullMQ)
- GitHub integrations (webhooks, Probot)

Targets (Default)

- Availability: 99.9% monthly (≤ 43.2 min downtime/month)
- Error rate: < 1% (5‑minute rolling window) across API and WS
- Throughput baseline: 300 RPS sustained on staging scale (single instance)

Latency (p95 / p99)

- HTTP API overall: p95 < 300 ms, p99 < 600 ms
- Health/readiness: p95 < 50 ms
- Villages/bugs list: p95 < 250 ms
- Agent command enqueue (202): p95 < 200 ms
- WebSocket RTT (ping): p95 < 200 ms, p99 < 350 ms
- Queue-to-emit latency (agent command → first work_stream): p95 < 2 s

Resource Budgets

- Server CPU: < 70% average during ramp/soak
- Memory: stable within ±10% over 30‑min soak (no linear growth)
- DB queries: p95 < 50 ms for hot paths (index-backed), p99 < 200 ms
- Redis ops: p95 < 5 ms for cache/dedupe operations

Webhooks & Probot

- Delivery handling p95 < 250 ms (simple events)
- Dedupe: no duplicate side effects for replay within 24 h
- Signature validation enforced when secrets configured

Load Profiles (reference)

- k6 HTTP:

```
# Smoke
BASE_URL=<url> TOKEN=<jwt> pnpm -C packages/server load:k6:smoke
# Ramp (0→100→300 VUs)
BASE_URL=<url> TOKEN=<jwt> pnpm -C packages/server load:k6:ramp
```

- Artillery WS:

```
TOKEN=<jwt> pnpm -C packages/server load:artillery:smoke
```

Acceptance Criteria

- Meet or beat latency/error budgets across smoke/ramp.
- Zero leaked connections/goroutines; memory returns to baseline post-ramp.
- WebSocket join/ping success > 99%, no message loss detected on soak.
- No duplicate bots from re-deliveries; metrics show dedupe working.

Measurement & Reporting

- k6 thresholds configured in load/k6-http.js (p95/p99, error rate).
- Use server logs + metrics endpoints for corroboration.
- Capture run metadata (VUs, durations, env) and produce a load report using LOAD_REPORT_TEMPLATE.md.
