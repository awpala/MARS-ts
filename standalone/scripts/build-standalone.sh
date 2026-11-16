#!/usr/bin/env bash
# Manually build the tracked single-file HTML using the installed root dependencies.
# Resolve our real checkout path even through /usr/local/bin/build-standalone, and
# isolate every intermediate under __build/. Never reinstall dependencies, clean
# the human's hosted output, start a server, or invoke Git. Setup links this live
# script for interactive and noninteractive shells; no container rebuild is needed
# when the builder changes. Preserve full stdout/stderr and the actual build status.
set -euo pipefail

SCRIPT_PATH=$(readlink -f -- "${BASH_SOURCE[0]}")
WORKSPACE_DIR=$(cd -- "$(dirname -- "$SCRIPT_PATH")/../.." && pwd -P)
if [ "$#" -ne 0 ]; then
  echo 'Usage: build-standalone' >&2
  exit 2
fi
mkdir -p "${WORKSPACE_DIR}/__logs/__test-runs"
BUILD_LOG="${WORKSPACE_DIR}/__logs/__test-runs/$(date +%s)_${BASHPID}_standalone-build.log"
printf 'Build log: %s\n' "$BUILD_LOG"
node "${WORKSPACE_DIR}/standalone/scripts/build.mjs" 2>&1 | tee "$BUILD_LOG"
