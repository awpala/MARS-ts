#!/usr/bin/env bash
# Stop only the configured local application listener (SvelteKit on 6277,
# phoneword "MARS"). Never targets arbitrary ports or process names.
set -uo pipefail

TERM_WAIT_SECONDS=5
KILL_WAIT_SECONDS=2

declare -A SERVICE_LABEL_BY_PORT=(
  ["6277"]="app"
)

declare -a RESOLVED_PIDS=()
declare -A PROCESS_START_BY_PID=()

# Report the no-argument interface; callers select no arbitrary ports or PIDs.
usage() {
  echo "Usage: $0" >&2
}

# Read Linux process state and start time. Start time distinguishes a surviving
# target from an unrelated process that later reuses its PID.
process_identity() {
  local pid=$1
  local stat rest
  [ -r "/proc/${pid}/stat" ] || return 1
  stat=$(<"/proc/${pid}/stat")
  rest=${stat##*) }
  awk '{ print $1, $20 }' <<<"$rest"
}

# Succeed only for the recorded, non-zombie process; missing PIDs are finished.
process_is_original() {
  local pid=$1
  local expected_start=$2
  local state current_start
  read -r state current_start < <(process_identity "$pid") || return 1
  [ "$state" != "Z" ] || return 1
  [ "$current_start" = "$expected_start" ]
}

# Inspect TCP listeners on one application port, preserving ss failure status.
listener_lines_ss() {
  local port=$1
  ss -H -ltnp "sport = :${port}" 2>/dev/null
}

# List unique listener PIDs when ss cannot expose process ownership.
listener_pids_lsof() {
  local port=$1
  lsof -nP -t -iTCP:"${port}" -sTCP:LISTEN 2>/dev/null | sort -un
}

# Replace RESOLVED_PIDS for one port. Return 1 on inspection failure, 2 when
# listeners lack visible owners, or 3 when neither inspection tool exists.
resolve_listener_pids() {
  local port=$1
  local output=""
  RESOLVED_PIDS=()

  if command -v ss >/dev/null 2>&1; then
    output=$(listener_lines_ss "$port") || return 1
    mapfile -t RESOLVED_PIDS < <(
      grep -oE 'pid=[0-9]+' <<<"$output" | cut -d= -f2 | sort -un
    )
    if [ -n "$output" ] && [ ${#RESOLVED_PIDS[@]} -eq 0 ]; then
      if command -v lsof >/dev/null 2>&1; then
        mapfile -t RESOLVED_PIDS < <(listener_pids_lsof "$port")
        [ ${#RESOLVED_PIDS[@]} -gt 0 ] || return 2
      else
        return 2
      fi
    fi
    return 0
  fi

  command -v lsof >/dev/null 2>&1 || return 3
  mapfile -t RESOLVED_PIDS < <(listener_pids_lsof "$port")
}

# Check the port again after shutdown, including a replacement process that the
# original-PID signal loop deliberately did not kill.
port_has_listener() {
  local port=$1
  if command -v ss >/dev/null 2>&1; then
    [ -n "$(ss -H -ltn "sport = :${port}" 2>/dev/null)" ]
    return
  fi
  [ -n "$(listener_pids_lsof "$port")" ]
}

# Wait up to the supplied seconds for recorded target identities to disappear;
# success means all finished, failure means at least one survived the deadline.
wait_for_original_processes() {
  local timeout_seconds=$1
  shift
  local deadline=$((SECONDS + timeout_seconds))
  local pid

  while [ $SECONDS -lt $deadline ]; do
    local remaining=0
    for pid in "$@"; do
      if process_is_original "$pid" "${PROCESS_START_BY_PID[$pid]}"; then
        remaining=1
        break
      fi
    done
    [ $remaining -eq 0 ] && return 0
    sleep 0.2
  done
  return 1
}

# Discover each supplied port once, deduplicate PIDs, and retain their identity
# across TERM and bounded KILL escalation. Report inspection/signal failures and
# any listeners still present without broadening the targets to new processes.
stop_listeners() {
  local -a ports=("$@")
  local -a target_pids=()
  local port label pid start_time
  local failed=0 resolve_status

  PROCESS_START_BY_PID=()
  for port in "${ports[@]}"; do
    label=${SERVICE_LABEL_BY_PORT[$port]:-"listener"}
    resolve_listener_pids "$port"
    resolve_status=$?
    if [ $resolve_status -ne 0 ]; then
      case $resolve_status in
        2)
          printf '[fail] %-25s :%s is listening, but its PID is not visible and lsof is unavailable\n' "$label" "$port" >&2
          ;;
        3)
          echo "[fail] neither ss nor lsof is available for listener discovery" >&2
          ;;
        *)
          printf '[fail] unable to inspect %-25s :%s\n' "$label" "$port" >&2
          ;;
      esac
      failed=1
      continue
    fi

    if [ ${#RESOLVED_PIDS[@]} -eq 0 ]; then
      printf '[down] %-25s :%s (no listener)\n' "$label" "$port"
      continue
    fi

    printf '[found] %-24s :%s pid(s): %s\n' "$label" "$port" "${RESOLVED_PIDS[*]}"
    for pid in "${RESOLVED_PIDS[@]}"; do
      if [ -n "${PROCESS_START_BY_PID[$pid]+present}" ]; then
        continue
      fi
      read -r _ start_time < <(process_identity "$pid") || {
        printf '[info] pid %s exited before TERM\n' "$pid"
        continue
      }
      PROCESS_START_BY_PID[$pid]=$start_time
      target_pids+=("$pid")
    done
  done

  if [ ${#target_pids[@]} -gt 0 ]; then
    for pid in "${target_pids[@]}"; do
      if process_is_original "$pid" "${PROCESS_START_BY_PID[$pid]}"; then
        if kill -TERM "$pid" 2>/dev/null; then
          printf '[term] pid %s\n' "$pid"
        else
          printf '[fail] TERM pid %s was rejected\n' "$pid" >&2
          failed=1
        fi
      fi
    done

    if ! wait_for_original_processes "$TERM_WAIT_SECONDS" "${target_pids[@]}"; then
      for pid in "${target_pids[@]}"; do
        if process_is_original "$pid" "${PROCESS_START_BY_PID[$pid]}"; then
          if kill -KILL "$pid" 2>/dev/null; then
            printf '[kill] pid %s (grace period expired)\n' "$pid"
          else
            printf '[fail] KILL pid %s was rejected\n' "$pid" >&2
            failed=1
          fi
        fi
      done
      if ! wait_for_original_processes "$KILL_WAIT_SECONDS" "${target_pids[@]}"; then
        echo "[fail] one or more exact target processes survived KILL" >&2
        failed=1
      fi
    fi
  fi

  for port in "${ports[@]}"; do
    label=${SERVICE_LABEL_BY_PORT[$port]:-"listener"}
    if port_has_listener "$port"; then
      printf '[fail] %-25s :%s is still listening (possibly restarted with a new PID)\n' "$label" "$port" >&2
      failed=1
    else
      printf '[closed] %-23s :%s\n' "$label" "$port"
    fi
  done

  return "$failed"
}

# Validate invocation and tools before stopping only the application port.
main() {
  if [ $# -ne 0 ]; then
    usage
    return 2
  fi
  if ! command -v ss >/dev/null 2>&1 && ! command -v lsof >/dev/null 2>&1; then
    echo "kill-app.sh requires ss or lsof" >&2
    return 1
  fi

  stop_listeners "6277"
}

main "$@"
