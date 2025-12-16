#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OMNARA_FACTORY_BIN="${OMNARA_FACTORY_BIN:-/Users/jamesbrady/bin/omnara-factory}"
PROMPT_FILE="${PROMPT_FILE:-$ROOT/docs/kickoffs/prd-eval-gemini-task9.md}"
SESSION_NAME="${SESSION_NAME:-aavm-gemini-task9}"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'HELP'
Usage:
  pnpm omnara:launch:prd-eval:gemini-task9
  ./scripts/omnara/launch-prd-eval-gemini-task9.sh

Environment overrides:
  OMNARA_FACTORY_BIN=/path/to/omnara-factory
  PROMPT_FILE=/path/to/prompt.md
  SESSION_NAME=aavm-gemini-task9
HELP
  exit 0
fi

if [[ ! -x "$OMNARA_FACTORY_BIN" ]]; then
  echo "error: omnara-factory not found or not executable at: $OMNARA_FACTORY_BIN" >&2
  echo "hint: set OMNARA_FACTORY_BIN to the correct path (e.g. ~/bin/omnara-factory)" >&2
  exit 1
fi

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "error: prompt file not found: $PROMPT_FILE" >&2
  exit 1
fi

exec "$OMNARA_FACTORY_BIN" gemini-chat \
  --root "$ROOT" \
  --prompt-file "$PROMPT_FILE" \
  --session-name "$SESSION_NAME" \
  "$@"

