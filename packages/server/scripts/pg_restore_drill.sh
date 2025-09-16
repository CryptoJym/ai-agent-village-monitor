#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE=""
TARGET_DB=""

usage() { echo "Usage: $0 --backup /path/pg_backup.sql.gz --target-db <database>"; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backup) BACKUP_FILE="$2"; shift 2;;
    --target-db) TARGET_DB="$2"; shift 2;;
    *) usage;;
  esac
done
[[ -z "$BACKUP_FILE" || -z "$TARGET_DB" ]] && usage

echo "[restore_drill] starting restore to $TARGET_DB from $BACKUP_FILE"
START=$(date +%s)

if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" | PGPASSWORD="${PGPASSWORD:-}" psql -h "${PGHOST:-localhost}" -p "${PGPORT:-5432}" -U "${PGUSER:-postgres}" -d "$TARGET_DB"
else
  cat "$BACKUP_FILE" | PGPASSWORD="${PGPASSWORD:-}" psql -h "${PGHOST:-localhost}" -p "${PGPORT:-5432}" -U "${PGUSER:-postgres}" -d "$TARGET_DB"
fi

END=$(date +%s)
ELAPSED=$((END-START))
echo "[restore_drill] completed in ${ELAPSED}s"

# Optional heartbeat for drill timing as a gauge
if [[ -n "${BACKUP_HEARTBEAT_URL:-}" && -n "${BACKUP_HEARTBEAT_TOKEN:-}" ]]; then
  curl -s -X POST -H "x-backup-token: $BACKUP_HEARTBEAT_TOKEN" -H "Content-Type: application/json" \
    -d "{\"type\":\"postgres\",\"ts\":$(date +%s)}" "$BACKUP_HEARTBEAT_URL" >/dev/null || true
fi

