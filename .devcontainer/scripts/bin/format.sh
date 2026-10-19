#!/usr/bin/env bash
# Apply ESLint fixes and Prettier formatting to the application.
#
# -e here, unlike build-app/tests/checks: formatting is a write operation, and if
# one formatter fails the tree is half-rewritten. Stopping leaves a smaller mess
# to reason about than continuing into the next rewrite.
#
# The formatters' scope comes from the app's npm scripts. The legacy Java
# sources are a frozen reference and must never be reformatted.
set -euo pipefail

SCRIPT_PATH=$(readlink -f -- "${BASH_SOURCE[0]}")
WORKSPACE_DIR=$(cd -- "$(dirname -- "$SCRIPT_PATH")/../../.." && pwd -P)

# Formatting mutates source files. Handle help before touching any formatter, and
# reject unsupported arguments rather than interpreting them as permission to
# rewrite the workspace.
if [ "$#" -eq 1 ] && { [ "$1" = "--help" ] || [ "$1" = "-h" ]; }; then
  echo "Usage: $0 (no arguments; format the application)"
  exit 0
fi
if [ "$#" -ne 0 ]; then
  echo "Usage: $0 (no arguments; format the application)" >&2
  exit 2
fi
if [ ! -f "${WORKSPACE_DIR}/package.json" ]; then
  echo "SvelteKit app not scaffolded yet (no package.json); nothing to format." >&2
  exit 1
fi

# Print a formatter step to stderr so tool stdout remains available for reports.
info() {
  printf '\n=== %s ===\n' "$1" >&2
}

# Apply ESLint rewrites before Prettier settles the app's final layout.
format_app() {
  info "App: ESLint fixes"
  npm --prefix "${WORKSPACE_DIR}" run lint:fix
  info "App: Prettier formatting"
  npm --prefix "${WORKSPACE_DIR}" run format
}

format_app

printf '\nFormatting complete.\n' >&2
