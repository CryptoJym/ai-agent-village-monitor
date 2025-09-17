# Rollback Strategy and Migration Plan

This document defines rollback decision paths and a forward/backward compatible migration strategy.

## Decision Tree

1. User‑visible defect without data impact → HOTFIX or FLAG‑OFF
2. Performance/SLO breach → FLAG‑OFF, scale out; revert if persists > RTO
3. Migration failure or data corruption risk → DEPLOY ROLLBACK + RESTORE

Escalate to IC to decide between hotfix vs rollback based on severity and RTO/RPO.

## Targets

- RTO: <30 minutes for feature rollback; <2 hours for DB restore
- RPO: ≤ 5 minutes (ensure snapshot + WAL archival / PITR configured)

## Forward/Backward Compatibility

- Deploy schema changes in two phases: additive first (nullable/new tables), then code activation using flags
- Avoid destructive changes until feature adoption confirmed
- Keep old reads/writes operational until cleanup window

## Pre‑Migration Checks

- [ ] Confirm fresh backup/snapshot created and verified
- [ ] Capacity and lock impact assessed; maintenance window communicated
- [ ] Down migration exists or data restore plan documented
- [ ] Integrity checks scripted (row counts, constraints, sample queries)

## Execution

1. Apply migrations (prisma migrate deploy)
2. Run integrity checks
3. Activate code paths via feature flag
4. Monitor error rate and latency; be ready to flag off

## Rollback Procedures

1. Feature: disable via flag; redeploy frontend/backend to ensure config propagation
2. Deploy: revert to previous build (Vercel rollback; Railway previous release)
3. Database: apply down migration OR restore from snapshot (with PITR)
4. Cache: invalidate Redis keys if stale data present

## Verification

- [ ] Health endpoints 200 (`/healthz`, `/readyz`)
- [ ] No error spike in logs; SLOs within thresholds
- [ ] Critical user journeys pass synthetic checks

## Staging Dry‑Run (record timings)

- Migrations: <N> s; Deploy: <N> s; Rollback: <N> s; Restore: <N> m
