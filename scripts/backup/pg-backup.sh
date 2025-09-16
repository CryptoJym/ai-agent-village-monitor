#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/backup/pg-backup.sh /path/to/backup.sql.gz
# Requires: pg_dump, gzip

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL env var is required" >&2
  exit 1
fi

OUT=${1:-}
if [[ -z "$OUT" ]]; then
  echo "Usage: $0 /path/to/backup.sql.gz" >&2
  exit 1
fi

echo "[backup] dumping database to $OUT"
pg_dump "$DATABASE_URL" --no-owner --no-privileges | gzip -9 > "$OUT"
echo "[backup] done"

