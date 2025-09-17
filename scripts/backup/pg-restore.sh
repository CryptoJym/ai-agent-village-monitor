#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/backup/pg-restore.sh /path/to/backup.sql.gz
# WARNING: Restores into DATABASE_URL database. Use with caution.

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL env var is required" >&2
  exit 1
fi

IN=${1:-}
if [[ -z "$IN" || ! -f "$IN" ]]; then
  echo "Usage: $0 /path/to/backup.sql.gz" >&2
  exit 1
fi

echo "[restore] restoring $IN into target database"
gunzip -c "$IN" | psql "$DATABASE_URL"
echo "[restore] done"

