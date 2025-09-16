# Privacy and Compliance (MVP)

This document summarizes how AI Agent Village Monitor handles personal data in the MVP.

## Analytics & KPIs (MVP)

We collect minimal, privacy‑preserving analytics to power KPIs in the PRD (daily active villages, dialogue opens, command executions, session duration).

- Event schema is strictly validated server‑side (Zod). Only the following event types are accepted:
  - `session_start`, `session_end` (with `durationMs`)
  - `village_view`
  - `dialogue_open`
  - `command_executed` (command name limited to 64 chars)
- Unknown fields are stripped; unknown event types are rejected.
- `userId` and `clientId` are hashed using SHA‑256 with a server salt (never stored raw).
- Respect user privacy controls:
  - Client respects browser DNT/GPC and local preference; if present, analytics are disabled client‑side.
  - Server ignores analytics when `DNT: 1` or `Sec-GPC: 1`/`GPC: 1` headers are present.
  - Server also consults authenticated user preferences (`preferences.analytics.enabled === false`) and drops batches.
- No raw events are persisted. If Redis is configured, we aggregate counters only:
  - `kpi:day:<date>:villages` (unique set of village IDs)
  - `kpi:day:<date>:dialogue_opens` (counter)
  - `kpi:day:<date>:commands` (counter)
  - `kpi:day:<date>:session_ms` (counter)
- If Redis is not configured, the collector returns 202 without aggregation.

User controls:

- UI toggle under Settings → Preferences → Analytics (default on). Toggle updates server and local preference.
- DNT/GPC always override any opt‑in setting.

## Data Inventory

- Users
  - `id` (internal id)
  - `email` (nullable)
  - `githubId` (nullable, BigInt)
  - `name` (GitHub login or display name)
  - `preferences` (JSON)
- OAuth Tokens
  - Stored encrypted at rest when `TOKEN_ENCRYPTION_KEY` is set; otherwise a salted hash reference is stored (non-retrievable)
- Villages, Houses, Agents, Sessions, WorkStreamEvents
  - Operational metadata only; avoid PII beyond names/logins required for collaboration

## Tokens

- GitHub OAuth access tokens are never logged and are persisted encrypted at rest using AES‑256‑GCM when `TOKEN_ENCRYPTION_KEY` is configured. Otherwise, only a salted hash reference is stored.
- JWTs are issued with 1h access and 30d refresh; refresh rotation with reuse detection is enabled.

## Logs and Retention

- Request logs redact `authorization`, `cookie`, and `set-cookie` headers and truncate oversized values.
- Metrics respect DNT/GPC and are skipped when `DNT: 1` or `Sec-GPC: 1` headers are present.
- Audit logs include event type and minimal identifiers; no tokens or PII.

## Account Deletion

- Endpoint: `DELETE /api/account` with JSON body `{ "confirm": "<your name or email>" }`.
- Effects: revokes provider tokens, removes access, detaches agents, and anonymizes the user record (`name=deleted-<id>`, `email=null`, `preferences=null`, `githubId=null`).

## Configuration

- `TOKEN_ENCRYPTION_KEY`: 32-byte (base64/hex) key to enable token encryption at rest.
- `AUDIT_LOG_FILE`: optional path to write audit logs (one JSON line per event). When unset, audit logs go to stdout.

## Do Not Track

- Requests with `DNT: 1` or `Sec-GPC: 1` disable metrics collection.

## Future Work

- Expand user preferences for analytics opt-in/out UI.
- Add data export endpoint for user data portability.
- Formalize log retention windows and rotation.

## Incident Response (MVP)

- If a data issue is suspected:
  - Triage within 24h; disable affected features if necessary.
  - Review audit logs (set `AUDIT_LOG_FILE`) and server logs for scope without exposing PII.
  - Rotate secrets if compromise suspected (`JWT_SECRET`, `TOKEN_ENCRYPTION_KEY`).
  - Notify affected users if required by severity and applicable policy.

## Checklist (MVP)

- [x] Token minimization (encrypt/hash)
- [x] Account deletion endpoint
- [x] PII scrubbing in logs
- [x] DNT/GPC respected for analytics (client + server)
- [x] Server Zod validation for analytics events
- [x] Hash user/client identifiers server‑side
- [x] Enforce command length limits and strip unknown fields
- [x] Privacy notice drafted
