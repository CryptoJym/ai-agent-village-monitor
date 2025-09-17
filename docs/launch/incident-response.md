# Incident Response & Escalation

## Severity Matrix (examples)

- SEV1: Outage or data loss → page IC immediately; update stakeholders; consider rollback
- SEV2: Major degradation or partial outage → page; assess flags; consider hotfix
- SEV3: Minor impact/workaround → schedule fix; no page outside hours

## Roles

- Incident Commander (IC): leads response and decisions
- Comms Lead: internal/external comms and status pages
- Scribe: timeline, decisions, evidence
- Ops/Eng: implement fixes/rollbacks

## Escalation Tree

1. Primary On‑Call → Secondary → EM → Director
2. Vendors: Railway/Fly/Vercel contacts as needed

## Paging Policies

- 24/7 coverage for launch window; rotate weekly thereafter
- Acknowledge within 5 min; engage IC within 10 min (SEV1)

## Communications Templates

- Internal: channel #incidents – situation, impact, actions, ETA
- Status Page: brief, user‑facing; link to updates; postmortem link later
- Customer Email: only for significant/regulated impacts

## Tabletop Exercise

- Simulate migration failure; walk rollback decision; record gaps

## Post‑Incident Review

- Template covering impact, causes, timelines, actions, owners, due dates; publish within 5 business days
