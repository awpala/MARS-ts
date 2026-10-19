#!/usr/bin/env bash
# Runs one local application process with persistent lifecycle and application
# logs under __logs/local/. Each run writes a timestamped log file and repoints
# a `<service>-latest.log` symlink at it.
#
# The symlink is what makes the logs usable by a coding agent or by `tail -f`
# without first discovering a timestamp, while the timestamped file keeps the
# previous run's output for comparison rather than truncating it.
#
# The listener port (6277, phoneword "MARS") is owned by the app's Vite
# configuration; this launcher only starts `npm run dev`.
#
set -uo pipefail

# Print the only supported service selectors without starting a process.
usage() {
  echo "Usage: $0 <app>" >&2
}

if [[ $# -ne 1 ]]; then
  usage
  exit 2
fi

SERVICE_NAME=$1
SCRIPT_PATH=$(readlink -f -- "${BASH_SOURCE[0]}")
WORKSPACE_DIR=$(cd -- "$(dirname -- "$SCRIPT_PATH")/../../.." && pwd -P)
LOG_DIR="${WORKSPACE_DIR}/__logs/local"

# npm owns the application command and Vite owns its configuration.
case "$SERVICE_NAME" in
  app)
    SERVICE_DIR="${WORKSPACE_DIR}"
    SERVICE_COMMAND=(npm run dev)
    ;;
  *)
    echo "Unsupported local service: $SERVICE_NAME" >&2
    usage
    exit 2
    ;;
esac

if [[ ! -f "${SERVICE_DIR}/package.json" ]]; then
  echo "SvelteKit app not scaffolded yet (no package.json); see docs/adrs/0000-port-plan.md." >&2
  exit 1
fi

mkdir -p "$LOG_DIR"

STARTED_AT=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
LOG_TIMESTAMP=$(date -u +'%Y%m%dT%H%M%SZ')
LOG_FILE="${LOG_DIR}/${SERVICE_NAME}-${LOG_TIMESTAMP}.log"
LATEST_LOG="${LOG_DIR}/${SERVICE_NAME}-latest.log"
GIT_REVISION=$(git -C "$WORKSPACE_DIR" rev-parse --short=12 HEAD 2>/dev/null || echo unknown)

ln -sfn "$(basename "$LOG_FILE")" "$LATEST_LOG"

# Lifecycle lines are prefixed into the same stream as the application's own
# output, so "when did this start, against which commit, and how did it end" is
# answerable from the log alone.
log_lifecycle() {
  printf '%s service=%s event=%s pid=%s git=%s' \
    "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
    "$SERVICE_NAME" \
    "$1" \
    "$$" \
    "$GIT_REVISION"
  shift
  if [[ $# -gt 0 ]]; then
    printf ' %s' "$*"
  fi
  printf '\n'
}

cd "$SERVICE_DIR" || exit 1

# A separate process group lets the launcher forward termination through npm,
# to the actual Vite listener. Killing only their wrapper PID leaves
# the child service running after the terminal has closed.
exec > >(tee -a "$LOG_FILE") 2>&1
log_lifecycle start "started_at=${STARTED_AT} cwd=${SERVICE_DIR} command=${SERVICE_COMMAND[*]} log=${LOG_FILE}"
setsid "${SERVICE_COMMAND[@]}" &
SERVICE_PROCESS_PID=$!

# on_signal forwards shutdown to the owned process group and waits for teardown.
on_signal() {
  local signal=$1 status=$2
  log_lifecycle signal "name=${signal}"
  kill -s "$signal" -- "-${SERVICE_PROCESS_PID}" 2>/dev/null || true
  wait "$SERVICE_PROCESS_PID" 2>/dev/null || true
  log_lifecycle exit "exit_code=${status}"
  exit "$status"
}
trap 'on_signal INT 130' INT
trap 'on_signal TERM 143' TERM
trap 'on_signal HUP 129' HUP
wait "$SERVICE_PROCESS_PID"
SERVICE_EXIT_CODE=$?
log_lifecycle exit "exit_code=${SERVICE_EXIT_CODE}"
exit "$SERVICE_EXIT_CODE"
