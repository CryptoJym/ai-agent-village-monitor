# Load Test Report (Template)

- Date:
- Commit:
- Environment: (local/staging + machine specs)

## Summary
- HTTP p95: ___ ms (target < 300ms)
- HTTP error rate: ___% (target < 1%)
- WS RTT p95: ___ ms (target < 200ms)
- WS error rate: ___% (target < 1%)
- CPU avg/max: ___ / ___
- Memory delta: ___%

## Methodology
- k6 smoke/ramp profiles
- Artillery WS scenario (Socket.IO engine)
- Dataset: villages=__, houses/v=__, agents/v=__, bugs/v=__

## Findings
- Bottleneck 1: …
- Bottleneck 2: …

## Recommendations
- Change A → expected impact …
- Change B → expected impact …

## Raw Outputs
- k6 output: path/to/file
- artillery output: path/to/file
- ws-load result: path/to/file
