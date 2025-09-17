#!/usr/bin/env bash
set -euo pipefail

# Omnara auto wrapper
# - Forwards a customizable set of non-interactive/automation flags to Omnara
# - Configure via env var: OMNARA_FLAGS (e.g., "--non-interactive --yes")
# - Usage: scripts/omnara-auto.sh <omnara-subcommand> [args...]

OMNARA_BIN="${OMNARA_BIN:-omnara}"

if ! command -v "$OMNARA_BIN" >/dev/null 2>&1; then
  echo "error: Omnara binary '$OMNARA_BIN' not found in PATH" >&2
  exit 127
fi

# Allow per-profile flag presets via OMNARA_PROFILE, if desired
# Example:
#   export OMNARA_PROFILE=auto
#   export OMNARA_FLAGS_AUTO="--non-interactive --yes"

PROFILE="${OMNARA_PROFILE:-}"

FLAGS_FROM_PROFILE=""
if [[ -n "$PROFILE" ]]; then
  # Build var name like OMNARA_FLAGS_AUTO
  UPPER=$(echo "$PROFILE" | tr '[:lower:]' '[:upper:]')
  VAR_NAME="OMNARA_FLAGS_${UPPER}"
  FLAGS_FROM_PROFILE="${!VAR_NAME-}"
fi

# Final flags precedence: profile > OMNARA_FLAGS > none
FINAL_FLAGS="${FLAGS_FROM_PROFILE:-${OMNARA_FLAGS:-}}"

exec "$OMNARA_BIN" ${FINAL_FLAGS} "$@"

