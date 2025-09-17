# Observability Pre‑flight

## SLOs

- HTTP availability ≥ 99.9%
- p95 latency: < 300 ms (API), < 100 ms (WS ping)
- Error rate: < 1%

## Dashboards

- Golden signals: latency, errors, saturation, traffic
- Feature adoption: flag exposure, % rollout, usage

## Alerts

- Thresholds for error/latency; paging routes tested
- Runbook links included in alert descriptions

## Tracing & Logs

- Request id propagation; sensitive fields redacted
- Deployment markers; correlation of spikes to deploys

## Health & Synthetic

- `/healthz`, `/readyz` return 200 with details
- Synthetic checks for: login, village view, command dispatch, WS ping

## Fire Drill

- Trigger an alert in staging; verify paging/on‑call
- Capture time‑to‑ack and time‑to‑resolve
