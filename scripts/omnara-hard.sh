#!/usr/bin/env bash
set -euo pipefail

# Omnara "hard" wrapper
# Goal: Minimal safety, always non-interactive, and force/restart when possible.
# Strategy: Detect supported flags from `omnara --help` and `<subcmd> --help`,
#           then pass the most aggressive combination that Omnara actually supports.
#
# Usage:
#   scripts/omnara-hard.sh <omnara-subcommand> [args...]
#
# Environment:
#   OMNARA_BIN          - Path/name of Omnara CLI (default: "omnara")
#   OMNARA_EXTRA_FLAGS  - Extra flags always appended verbatim (optional)
#
# pnpm aliases (added in package.json):
#   pnpm oh <subcmd> [args...]           # shortest
#   pnpm omnara:hard <subcmd> [args...]

OMNARA_BIN="${OMNARA_BIN:-omnara}"

if ! command -v "$OMNARA_BIN" >/dev/null 2>&1; then
  echo "error: Omnara binary '$OMNARA_BIN' not found in PATH" >&2
  exit 127
fi

SUBCMD=""
if [[ $# -ge 1 ]]; then
  SUBCMD="$1"; shift || true
fi

# Gather help text for capability detection (best-effort; ignore failures)
HELP_GLOBAL="$($OMNARA_BIN --help 2>&1 || true)"
if [[ -n "$SUBCMD" ]]; then
  HELP_SUBCMD="$($OMNARA_BIN "$SUBCMD" --help 2>&1 || true)"
else
  HELP_SUBCMD=""
fi

flag_supported() {
  local flag="$1"
  # A simple contains check across global and subcommand help.
  # We prefer fixed-string grep to avoid regex surprises.
  if printf '%s\n%s' "$HELP_GLOBAL" "$HELP_SUBCMD" | grep -qF -- " $flag"; then
    return 0
  fi
  # Some CLIs show flags as "--flag," or "--flag)"; do a looser check as fallback.
  if printf '%s\n%s' "$HELP_GLOBAL" "$HELP_SUBCMD" | grep -qF -- "$flag"; then
    return 0
  fi
  return 1
}

# Candidate flags for no prompts/auto-approve
NONINTERACTIVE_CANDIDATES=(
  "--non-interactive"
  "--yes"
  "-y"
  "--assume-yes"
  "--auto-approve"
  "--no-prompt"
  "--no-confirm"
)

# Forceful execution candidates
FORCE_CANDIDATES=(
  "--force"
  "-f"
)

# Hard start / restart semantics candidates (applied for common start/run flows)
RESTART_CANDIDATES=(
  "--restart"
  "--force-restart"
  "--reset"
  "--replace"
  "--fresh"
  "--kill-running"
)

# Extra aggressive knobs some CLIs expose; we only pass if supported.
EXTREME_CANDIDATES=(
  "--unsafe"
  "--dangerous"
  "--no-safety"
  "--no-guardrails"
  "--disable-sandbox"
  "--no-sandbox"
)

FINAL_FLAGS=()

# Always try to eliminate prompts and auto-approve
for f in "${NONINTERACTIVE_CANDIDATES[@]}"; do
  if flag_supported "$f"; then
    FINAL_FLAGS+=("$f")
    break  # add the first one that matches to avoid redundancy
  fi
done

# Also try to add an explicit force flag if available
for f in "${FORCE_CANDIDATES[@]}"; do
  if flag_supported "$f"; then
    FINAL_FLAGS+=("$f")
    break
  fi
done

# If the subcommand name suggests starting/running, add restart-style flags too
case "$SUBCMD" in
  start|run|agent-start|task-start|service-start|pipeline|up)
    for f in "${RESTART_CANDIDATES[@]}"; do
      if flag_supported "$f"; then
        FINAL_FLAGS+=("$f")
        break  # the first matching restart-style flag is typically enough
      fi
    done
    ;;
esac

# Include any extreme flags that are supported (Harsh mode)
for f in "${EXTREME_CANDIDATES[@]}"; do
  if flag_supported "$f"; then
    FINAL_FLAGS+=("$f")
  fi
done

# Append user-provided extras last
if [[ -n "${OMNARA_EXTRA_FLAGS:-}" ]]; then
  # shellcheck disable=SC2206
  FINAL_FLAGS+=( ${OMNARA_EXTRA_FLAGS} )
fi

# If detection yielded nothing, attempt an optimistic pass with common flags,
# and iteratively strip any that error as unknown.
if [[ ${#FINAL_FLAGS[@]} -eq 0 ]]; then
  # Ordered by desirability; keep it short to reduce retries.
  GUESS_FLAGS=(
    "--non-interactive" "--yes" "-y" "--assume-yes" "--no-prompt" "--no-confirm" "--auto-approve" "--force" "-f"
  )
  WORKING_FLAGS=("${GUESS_FLAGS[@]}")

  # Try up to N passes, removing one bad flag at a time if clearly unknown.
  for _ in {1..8}; do
    set +e
    OUTPUT=$("$OMNARA_BIN" "${WORKING_FLAGS[@]}" "$SUBCMD" "$@" 2>&1)
    STATUS=$?
    set -e
    if [[ $STATUS -eq 0 ]]; then
      printf '%s' "$OUTPUT"
      exit 0
    fi

    # Detect an unknown/invalid flag pattern and remove the first offending flag
    if printf '%s' "$OUTPUT" | grep -qiE "unknown (option|flag)|unrecognized (option|argument)|invalid (option|flag)"; then
      # Try to extract the flag token from the error message (best-effort)
      BAD_FLAG=$(printf '%s' "$OUTPUT" | sed -n 's/.*\(--[^[:space:]]\+\).*/\1/p' | head -n1)
      if [[ -z "$BAD_FLAG" ]]; then
        # Fallback: remove the first remaining guess flag
        if [[ ${#WORKING_FLAGS[@]} -gt 0 ]]; then
          WORKING_FLAGS=("${WORKING_FLAGS[@]:1}")
          continue
        else
          break
        fi
      fi
      # Remove BAD_FLAG from WORKING_FLAGS
      TMP=()
      for f in "${WORKING_FLAGS[@]}"; do
        if [[ "$f" != "$BAD_FLAG" ]]; then TMP+=("$f"); fi
      done
      WORKING_FLAGS=("${TMP[@]}")
      continue
    fi

    # Non-flag-related failure; print output and exit with the same status
    printf '%s' "$OUTPUT" >&2
    exit $STATUS
  done

  # If we exhausted retries, just run without any guesses and bubble up errors
  exec "$OMNARA_BIN" "$SUBCMD" "$@"
fi

# Omnara-specific hard defaults: bypass permission prompts
# Only add if caller hasn't already specified their own variants
args_string=" $* "

add_flag_if_missing() {
  local flag="$1"
  if [[ "$args_string" != *" $flag "* && "$args_string" != *" $flag="* ]]; then
    FINAL_FLAGS+=("$flag")
  fi
}

add_pair_if_missing() {
  local key="$1"
  local value="$2"
  if [[ "$args_string" != *" $key "* && "$args_string" != *" $key="* ]]; then
    FINAL_FLAGS+=("$key" "$value")
  fi
}

# Disable permissions aggressively when supported by Omnara CLI
add_flag_if_missing "--dangerously-skip-permissions"
add_pair_if_missing "--permission-mode" "bypassPermissions"

# If running headless, allow core tools unless explicitly overridden by caller
if [[ "$SUBCMD" == "headless" ]]; then
  if [[ "$args_string" != *" --allowed-tools "* && "$args_string" != *" --allowed-tools="* \
     && "$args_string" != *" --disallowed-tools "* && "$args_string" != *" --disallowed-tools="* ]]; then
    FINAL_FLAGS+=("--allowed-tools" "Read,Write,Bash")
  fi
fi

if [[ -n "$SUBCMD" ]]; then
  exec "$OMNARA_BIN" "${FINAL_FLAGS[@]}" "$SUBCMD" "$@"
else
  exec "$OMNARA_BIN" "${FINAL_FLAGS[@]}" "$@"
fi
