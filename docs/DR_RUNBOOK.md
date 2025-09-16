# Backup and Disaster Recovery Runbook

This runbook documents the backup strategy, RTO/RPO targets, automation, and restore procedures for Postgres and Redis used by the AI Agent Village Monitor.

## Objectives

- RTO (Recovery Time Objective): ≤ 60 minutes for Postgres/Redis (staging or production scale).
- RPO (Recovery Point Objective): ≤ 24 hours for daily snapshots; ≤ 15 minutes for Redis if AOF is enabled.

## Scope

- Postgres primary database (application state, villages, houses, agents, events).
- Redis (queues and transient state). Redis is generally reconstructable; persistence is optional based on use case.

## Strategy

- Postgres
  - Daily logical backups using `pg_dump` (globals excluded), compressed with gzip.
  - Retention: keep last 14 daily snapshots.
  - Storage: encrypted object storage (e.g., S3 with SSE-S3 or SSE-KMS). Local disk is acceptable for dev.
  - Integrity: periodic restore drill to staging DB and checksum verification.

- Redis
  - Enable RDB snapshots at 15min intervals (or as appropriate) and/or AOF every 1sec (fsync every second) if durability is desired.
  - Retention: keep last 7 RDB snapshots.
  - Storage: same encrypted object storage; otherwise local RDB snapshots.

## Automation

Scripts are provided under `packages/server/scripts`:

- `pg_backup.sh`: Creates a timestamped `.sql.gz` via `pg_dump`. Optionally uploads to S3 if AWS env vars are set.
- `redis_backup.sh`: Triggers `redis-cli --rdb` or `SAVE` to produce an RDB snapshot and optionally uploads.
- `cleanup_backups.sh`: Deletes local backups older than a configured retention period.

Crontab examples (server time UTC):

```
# Daily Postgres backup at 02:00 UTC, keep last 14 days
0 2 * * * /path/to/repo/packages/server/scripts/pg_backup.sh \ 
  --outdir /var/backups/app --retention-days 14 >> /var/log/app/pg_backup.log 2>&1

# Redis snapshot every 4 hours (if persistence enabled), keep 7 days
0 */4 * * * /path/to/repo/packages/server/scripts/redis_backup.sh \ 
  --outdir /var/backups/app --retention-days 7 >> /var/log/app/redis_backup.log 2>&1

# Cleanup any stale local backups (defense-in-depth)
30 3 * * * /path/to/repo/packages/server/scripts/cleanup_backups.sh /var/backups/app 14
```

Environment variables (set in `.env` or host env):

```
# Postgres
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGDATABASE=appdb
PGPASSWORD=your_password

# Optional S3 upload
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=us-east-1
BACKUP_S3_BUCKET=s3://your-bucket/app-backups

# Redis
REDIS_URL=redis://localhost:6379
```

## Restore Procedures

### Postgres (staging drill or production)

1. Identify the backup to restore (filename: `pg_backup_YYYYmmdd_HHMM.sql.gz`).
2. Provision an empty target database (e.g., `appdb_restore`).
3. Run restore:

```
gunzip -c /path/to/pg_backup_YYYYmmdd_HHMM.sql.gz | \
  PGPASSWORD="$PGPASSWORD" psql -h "$PGHOST" -U "$PGUSER" -d appdb_restore
```

4. Validate:
   - Row counts of critical tables (`village`, `house`, `agent`, `bug_bots`)
   - Application readiness against staging config

5. Cutover (production only):
   - Gate writes, confirm maintenance window
   - Swap connection strings or promote restored DB

### Redis

1. Locate RDB snapshot (`redis_dump_YYYYmmdd_HHMM.rdb`).
2. Stop Redis instance, replace `dump.rdb` with snapshot, or use `--dbfilename` and `--dir` accordingly.
3. Start Redis; verify data presence (keys, lengths) and application connectivity.
4. If using AOF, configure `appendonly yes` (optional) and rebuild.

## Monitoring and Alerts

- Expose `/metrics` from server (Prometheus format). Add scrape to observability system.
- Backup heartbeat: backup scripts optionally POST to `/internal/backup/heartbeat` with header `x-backup-token: $BACKUP_HEARTBEAT_TOKEN` and JSON `{ "type": "postgres" | "redis", "ts": <epoch_seconds> }`.
- Exported metrics include:
  - `backup_last_seconds{type="postgres|redis"}` — last heartbeat (epoch seconds)
  - `backup_success_total{type="postgres|redis"}` — count of successful runs
  - `http_requests_total{method,route,status}` and `http_response_ms_bucket` — HTTP KPIs
- Sample PromQL alerts:
  - Postgres backup stale (36h): `time() - max(backup_last_seconds{type="postgres"}) > 36 * 3600`
  - Redis backup stale (6h): `time() - max(backup_last_seconds{type="redis"}) > 6 * 3600`
  - Missing heartbeats: `absent(backup_last_seconds)`

## RTO/RPO Validation Drill

1. Execute staging restore monthly, using `packages/server/scripts/pg_restore_drill.sh --backup /path/pg_backup_*.sql.gz --target-db appdb_restore`.
2. Record timings from backup selection to application verification; compare to RTO (≤ 60 minutes).
3. Verify backup age is within RPO threshold (≤ 24 hours for Postgres).
4. Document issues and improvements; update this runbook with results.

## Security & Privacy

- Encrypt at rest using S3 SSE and transport via TLS.
- Do not persist secrets in backups.
- Restrict access to backup bucket via IAM least privilege (write-only for backup agents; read for restore operators).
