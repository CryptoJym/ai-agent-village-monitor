#!/usr/bin/env bash
set -euo pipefail

DIR=${1:-}
RETENTION_DAYS=${2:-14}
if [[ -z "$DIR" ]]; then
  echo "Usage: $0 /path/to/backups [retention_days]"; exit 1
fi
find "$DIR" -type f \( -name 'pg_backup_*.sql.gz' -o -name 'redis_dump_*.rdb' \) -mtime +"$RETENTION_DAYS" -print -delete || true

