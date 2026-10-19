#!/usr/bin/env bash
# Run the legacy Java MARS headlessly in its command-line mode.
#
# PROVISIONAL: the legacy app is the behavioral reference ("oracle") for the
# TypeScript port; see build-legacy.sh. Arguments pass straight through to
# MARS's own command-line parser (mars/MarsLaunch.java), for example:
#
#   run-legacy nc prog.asm                 # run, without the copyright banner
#   run-legacy nc ic se1 ae2 '$t0' prog.asm
#   run-legacy nc a dump .text HexText out.txt prog.asm
#   run-legacy h                           # MARS's option reference
#
# Every run is isolated and deterministic with respect to host state:
# - java.awt.headless prevents any Swing/AWT initialization. MARS with no
#   file argument would open its GUI, which cannot start in this container,
#   so an empty argument list is rejected here instead.
# - java.util.prefs is pointed at a fresh temporary directory. MARS persists
#   its settings through Java Preferences (mars/Settings.java); sharing
#   ~/.java between runs would let one run's settings change another's
#   behavior. The directory is removed when the run ends.
#
# stdin, stdout, stderr, and the exit status are MARS's own, so read-syscall
# input can be piped in and `se<n>`/`ae<n>` exit codes reach the caller.
#
# Usage: run-legacy <MARS options...> <file.asm> [pa <program args...>]
set -uo pipefail

SCRIPT_PATH=$(readlink -f -- "${BASH_SOURCE[0]}")
WORKSPACE_DIR=$(cd -- "$(dirname -- "$SCRIPT_PATH")/../../.." && pwd -P)
JAR_FILE="${WORKSPACE_DIR}/__build/legacy/Mars.jar"

if [ "$#" -eq 0 ]; then
  echo "Usage: run-legacy <MARS options...> <file.asm>  (run-legacy h lists options)" >&2
  echo "Without arguments MARS starts its Swing GUI, which is unavailable headless." >&2
  exit 2
fi
if ! command -v java >/dev/null 2>&1; then
  echo "java is not on PATH; the dev container's Java feature provides it." >&2
  exit 1
fi
if [ ! -f "$JAR_FILE" ]; then
  echo "Legacy jar missing at ${JAR_FILE#"$WORKSPACE_DIR"/}; run build-legacy first." >&2
  exit 1
fi

PREFS_DIR=$(mktemp -d)
trap 'rm -rf -- "$PREFS_DIR"' EXIT
# Pre-create the store directories Java appends to each root. Otherwise the
# JDK logs "INFO: Created user preferences directory." to stderr on every run,
# which would pollute stderr comparisons between MARS and the port.
mkdir -p "${PREFS_DIR}/user/.java/.userPrefs" "${PREFS_DIR}/system/.systemPrefs"

java \
  -Djava.awt.headless=true \
  -Djava.util.prefs.userRoot="${PREFS_DIR}/user" \
  -Djava.util.prefs.systemRoot="${PREFS_DIR}/system" \
  -jar "$JAR_FILE" "$@"
