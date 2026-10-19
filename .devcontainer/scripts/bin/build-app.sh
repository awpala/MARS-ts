#!/usr/bin/env bash
# Clean generated artifacts, install application dependencies, and build.
# Keep a complete failure summary while respecting cleanup/install ordering.
# The legacy jar under __build/ is owned by build-legacy and is left alone.
# Usage: build-app
set -uo pipefail

SCRIPT_PATH=$(readlink -f -- "${BASH_SOURCE[0]}")
WORKSPACE_DIR=$(cd -- "$(dirname -- "$SCRIPT_PATH")/../../.." && pwd -P)

if [ "$#" -ne 0 ]; then
  echo "Usage: build-app" >&2
  exit 2
fi
if [ ! -f "${WORKSPACE_DIR}/package.json" ]; then
  echo "SvelteKit app not scaffolded yet (no package.json); nothing to build." >&2
  exit 1
fi

declare -a FAILED=()

# run_build preserves build output and records failure without stopping.
run_build() {
  local name=$1
  shift
  printf '\n=== %s ===\n' "$name" >&2
  if "$@"; then
    return 0
  fi
  FAILED+=("$name")
  return 1
}

if run_build "App: clean generated output" rm -rf -- \
  "${WORKSPACE_DIR}/build" "${WORKSPACE_DIR}/.svelte-kit" "${WORKSPACE_DIR}/node_modules/.vite" \
  && run_build "App: npm ci" npm --prefix "${WORKSPACE_DIR}" ci; then
  run_build "App: production build" npm --prefix "${WORKSPACE_DIR}" run build
else
  printf '\nSkipping app build because cleanup or npm ci failed.\n' >&2
fi

if [ ${#FAILED[@]} -eq 0 ]; then
  printf '\nAll application builds passed.\n' >&2
  exit 0
fi
printf '\nFailed application builds (%s):\n' "${#FAILED[@]}" >&2
printf '  - %s\n' "${FAILED[@]}" >&2
exit 1
