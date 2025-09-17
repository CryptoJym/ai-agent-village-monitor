# Security Pen-Test Checklist (MVP)

This checklist guides manual and automated verification of core security controls.

Areas covered:

- Input validation and error handling
- Auth and session management
- Headers and transport security
- Rate limiting and abuse controls
- CORS and CSRF protections (where applicable)
- Privacy controls (DNT/GPC, analytics opt-out)
- Logging and redaction

## Automated Checks (Supertest/Vitest)

1. Headers and transport

- GET /api/docs (no auth) returns CSP header and no sensitive headers
- In production mode: HSTS header present on any route (Strict-Transport-Security)
- X-Content-Type-Options: nosniff is present (via helmet)
- Cache-Control: no-store on /auth/\* responses
- WWW-Authenticate: Bearer on 401 responses

2. CORS restrictions

- Origin not in allowlist -> no CORS Access-Control-Allow-Origin
- Allowed origin echoes back with credentials enabled only for configured UI

3. Input validation

- POST invalid JSON to a JSON route -> 400
- POST invalid body to analytics/collect -> 400

4. Auth

- Missing bearer token -> 401 and no data
- Invalid token -> 401

5. Rate limiting

- /api/agents/:id/command hits rate limiter (429 after threshold)

6. Privacy

- POST analytics with DNT: 1 -> 202 and no counters incremented
- POST feedback: enforces honeypot/tts and per-IP limits (429)

## Manual Checks

- HTTPS redirect and HSTS confirmed in an environment with TLS terminated upstream
- WebSocket handshake honors auth bypass in dev only and requires correct token otherwise
- Verify logs in stdout do not include Authorization/Set-Cookie, tokens, or PII (scrubbed)
- Attempt common injection payloads in query/body and verify validation rejects with 400

## Remediation Notes

Create follow-up tasks for any gaps discovered during pen-testing. Include PoC, impacted endpoints, and severity.
