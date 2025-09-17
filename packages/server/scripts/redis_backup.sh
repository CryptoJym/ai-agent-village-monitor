#!/usr/bin/env bash
set -euo pipefail

OUTDIR=""
RETENTION_DAYS=7
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
FILE="$OUTDIR/redis_dump_${DATE}.rdb"

if command -v redis-cli >/dev/null 2>&1; then
  echo "[redis_backup] generating RDB at $FILE"
  # Prefer --rdb when available (saves without replacing running dump)
  if redis-cli --version 2>/dev/null | grep -q 'redis-cli'; then
    redis-cli --rdb "$FILE"
  else
    # Fallback: trigger SAVE and copy dump.rdb from server dir (requires permissions)
    redis-cli SAVE
    SRCDIR=${REDIS_DIR:-/var/lib/redis}
    cp "$SRCDIR/dump.rdb" "$FILE"
  fi
else
  echo "[redis_backup] redis-cli not found" >&2
  exit 1
fi

echo "[redis_backup] completed $(du -h "$FILE" | cut -f1)"

if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
  if command -v aws >/dev/null 2>&1; then
    echo "[redis_backup] uploading to $BACKUP_S3_BUCKET"
    aws s3 cp "$FILE" "$BACKUP_S3_BUCKET/"
  else
    echo "[redis_backup] aws cli not found; skipping upload" >&2
  fi
fi

find "$OUTDIR" -type f -name 'redis_dump_*.rdb' -mtime +"$RETENTION_DAYS" -print -delete || true

# Heartbeat (optional)
if [[ -n "${BACKUP_HEARTBEAT_URL:-}" && -n "${BACKUP_HEARTBEAT_TOKEN:-}" ]]; then
  curl -s -X POST -H "x-backup-token: $BACKUP_HEARTBEAT_TOKEN" -H "Content-Type: application/json" \
    -d "{\"type\":\"redis\",\"ts\":$(date +%s)}" "$BACKUP_HEARTBEAT_URL" >/dev/null || true
fi
