#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OMNARA_FACTORY_BIN="${OMNARA_FACTORY_BIN:-/Users/jamesbrady/bin/omnara-factory}"
KICKOFF_FILE="${KICKOFF_FILE:-$ROOT/docs/kickoffs/execution-plane.txt}"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'HELP'
Usage:
  pnpm omnara:launch:execution-plane
  ./scripts/omnara/launch-execution-plane.sh

Environment overrides:
  OMNARA_FACTORY_BIN=/path/to/omnara-factory
  KICKOFF_FILE=/path/to/kickoff.txt
HELP
  exit 0
fi

if [[ ! -x "$OMNARA_FACTORY_BIN" ]]; then
  echo "error: omnara-factory not found or not executable at: $OMNARA_FACTORY_BIN" >&2
  echo "hint: set OMNARA_FACTORY_BIN to the correct path (e.g. ~/bin/omnara-factory)" >&2
  exit 1
fi

if [[ ! -f "$KICKOFF_FILE" ]]; then
  echo "error: kickoff file not found: $KICKOFF_FILE" >&2
  exit 1
fi

exec "$OMNARA_FACTORY_BIN" launch-coo-lead \
  --force-opus \
  --root "$ROOT" \
  --kickoff-file "$KICKOFF_FILE" \
  "$@"
