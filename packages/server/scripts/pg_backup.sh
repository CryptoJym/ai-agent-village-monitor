#!/usr/bin/env bash
set -euo pipefail

OUTDIR=""
RETENTION_DAYS=14
DATE=$(date -u +%Y%m%d_%H%M)

usage() { echo "Usage: $0 --outdir /path/to/backups [--retention-days N]"; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --outdir) OUTDIR="$2"; shift 2;;
    --retention-days) RETENTION_DAYS="$2"; shift 2;;
    *) usage;;
  esac
done
[[ -z "$OUTDIR" ]] && usage

mkdir -p "$OUTDIR"

FILE="$OUTDIR/pg_backup_${DATE}.sql.gz"
echo "[pg_backup] writing $FILE"

PGPASSWORD="${PGPASSWORD:-}" pg_dump -h "${PGHOST:-localhost}" -p "${PGPORT:-5432}" -U "${PGUSER:-postgres}" \
  -d "${PGDATABASE:-postgres}" --format=plain --no-owner --no-privileges | gzip -9 > "$FILE"

echo "[pg_backup] completed $(du -h "$FILE" | cut -f1)"

# Optional S3 upload if env is set
if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
  if command -v aws >/dev/null 2>&1; then
    echo "[pg_backup] uploading to $BACKUP_S3_BUCKET"
    aws s3 cp "$FILE" "$BACKUP_S3_BUCKET/"
  else
    echo "[pg_backup] aws cli not found; skipping upload" >&2
  fi
fi

# Retention cleanup
find "$OUTDIR" -type f -name 'pg_backup_*.sql.gz' -mtime +"$RETENTION_DAYS" -print -delete || true

# Heartbeat (optional)
if [[ -n "${BACKUP_HEARTBEAT_URL:-}" && -n "${BACKUP_HEARTBEAT_TOKEN:-}" ]]; then
  curl -s -X POST -H "x-backup-token: $BACKUP_HEARTBEAT_TOKEN" -H "Content-Type: application/json" \
    -d "{\"type\":\"postgres\",\"ts\":$(date +%s)}" "$BACKUP_HEARTBEAT_URL" >/dev/null || true
fi
