# Load Testing Plan: Ramp-up Profiles and Soak Tests

This document defines performance validation profiles for the AI Agent Village Monitor backend and WebSocket server.

## Objectives

- Verify steady-state performance under typical and peak loads
- Detect memory leaks and connection churn issues with soak tests
- Validate autoscaling behavior (if enabled) and Redis adapter correctness

## Tools

- HTTP: k6, Playwright API, simple curl loops
- WebSocket: `packages/server/scripts/ws-load.js`, Artillery WS, k6 WS

## Environments

- Staging with representative DB size and Redis enabled
- `PUBLIC_SERVER_URL`, `WS_ALLOWED_ORIGINS` configured

## Profiles

### 1) HTTP API Ramp (15 min)

- Start: 10 RPS → Ramp to 200 RPS over 15 minutes
- Mix: 70% GET `/api/villages/:id`, 20% GET `/api/agents/:id/stream?limit=2`, 10% POST `/api/feedback`
- Targets: p95 ≤ 300ms, error rate < 1%

### 2) WS Connect Ramp (10 min)

- Start: 50 concurrent → Ramp to 2,000 concurrent sockets
- Transport: `websocket` preferred; fallback `polling`
- Behavior: join room `village:1`, receive broadcast every 3s
- Targets: connect success ≥ 99%, p95 join ack ≤ 200ms

### 3) Command Bursts (spikey)

- 60 seconds: 50 concurrent users send `POST /api/agents/:id/command` at 3 QPS per user
- Validate rate-limit responses (429) under stress and absence of 5xx

### 4) Soak (2 hours)

- 1,000 WS clients with periodic reconnects (every 10–15 minutes)
- Log memory/CPU; assert no unbounded growth
- Verify broadcast delivery ≥ 95% within 2s

## Running Locally

- HTTP (k6):

```
cd packages/server
k6 run load/k6-http.js             # smoke
K6_RAMP=1 k6 run load/k6-http.js   # ramp
```

- WebSocket harness:

```
cd packages/server
node scripts/ws-load.js --transport=websocket --clients=1000 --ramp=600 --time=1200 --csv=load.csv
```

- Artillery WS (smoke):

```
cd packages/server
artillery run load/artillery-ws.yml
```

## Metrics & Dashboards

- Prometheus `/metrics`
  - `http_requests_total`, `http_response_ms_bucket`
  - `ws_rtt_ms`, `ws.join_*` counters
  - `backup_*` (unrelated to perf, but aids health)
- Suggested charts: p95 latency, error rate, active sockets, memory/CPU

## Success Criteria

- All targets met across profiles
- No leak signatures in soak (heap, handles)
- Autoscaling behaves as expected with Redis adapter (no room delivery gaps)
