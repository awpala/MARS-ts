#!/usr/bin/env bash
# Compile the legacy Java MARS sources into __build/legacy/Mars.jar.
#
# PROVISIONAL: this helper exists only while the original Java/Swing MARS is
# the behavioral reference ("oracle") for the TypeScript port. It is removed,
# together with the Java devcontainer feature and run-legacy.sh, when the Java
# sources are offboarded (docs/adrs/0000-port-plan.md).
#
# The sources are compiled unmodified. The legacy tree has no build descriptor;
# CreateMarsJar.bat (Windows, expects pre-compiled classes) is the historical
# packaging recipe this script reproduces for Linux. Output goes to the ignored
# __build/ directory and is rebuilt from scratch on every invocation, so a
# stale class file can never mask a source difference.
#
# Usage: build-legacy
set -euo pipefail

SCRIPT_PATH=$(readlink -f -- "${BASH_SOURCE[0]}")
WORKSPACE_DIR=$(cd -- "$(dirname -- "$SCRIPT_PATH")/../../.." && pwd -P)
# Java sources and runtime resources are isolated from the port. The original
# license remains at the workspace root and is copied into the jar separately.
LEGACY_DIR="${WORKSPACE_DIR}/_legacy-app"
OUT_DIR="${WORKSPACE_DIR}/__build/legacy"
CLASSES_DIR="${OUT_DIR}/classes"
JAR_FILE="${OUT_DIR}/Mars.jar"
BUILD_INFO="${OUT_DIR}/BUILD_INFO"

# Runtime resources MARS loads from the classpath (Globals, PropertiesFile,
# InstructionSet, the Swing UI). This mirrors CreateMarsJar.bat minus the
# sources, build scripts, and generated Javadoc (_legacy-app/docs/).
# The application never reads Javadoc at runtime; root docs/ holds authored
# port documentation. The shared root license is also a runtime resource.
RESOURCES=(
  PseudoOps.txt
  Config.properties
  Syscall.properties
  Settings.properties
  MipsXRayOpcode.xml
  registerDatapath.xml
  controlDatapath.xml
  ALUcontrolDatapath.xml
  help
  images
)

if [ "$#" -ne 0 ]; then
  echo "Usage: build-legacy" >&2
  exit 2
fi

for command_name in javac jar; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "${command_name} is not on PATH; the dev container's Java feature provides it." >&2
    exit 1
  fi
done

for resource in Mars.java mars "${RESOURCES[@]}"; do
  if [ ! -e "${LEGACY_DIR}/${resource}" ]; then
    echo "Legacy input missing: ${resource} (expected under ${LEGACY_DIR})" >&2
    exit 1
  fi
done

if [ ! -f "${WORKSPACE_DIR}/MARSlicense.txt" ]; then
  echo "Shared license missing: ${WORKSPACE_DIR}/MARSlicense.txt" >&2
  exit 1
fi

rm -rf -- "$OUT_DIR"
mkdir -p "$CLASSES_DIR"

cd "$LEGACY_DIR"

# javac reads the explicit, sorted file list rather than a glob so the input
# set is reproducible and excludes anything outside the legacy tree.
{
  echo "Mars.java"
  find mars -name '*.java' | LC_ALL=C sort
} > "${OUT_DIR}/sources.txt"

printf '\n=== Legacy: javac (%s sources) ===\n' "$(wc -l < "${OUT_DIR}/sources.txt")" >&2
# -nowarn: the 2014-era sources raise many deprecation/unchecked warnings that
# are not actionable here; the sources are a frozen reference, never edited.
javac -nowarn -encoding UTF-8 -d "$CLASSES_DIR" @"${OUT_DIR}/sources.txt"

printf '\n=== Legacy: runtime resources ===\n' >&2
cp -R -- "${RESOURCES[@]}" "$CLASSES_DIR/"
cp -- "${WORKSPACE_DIR}/MARSlicense.txt" "$CLASSES_DIR/"

printf '\n=== Legacy: jar ===\n' >&2
jar --create --file "$JAR_FILE" --main-class Mars -C "$CLASSES_DIR" .

# Provenance for oracle output: which revision and JDK produced this jar.
{
  echo "built_at=$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  echo "git=$(git -C "$WORKSPACE_DIR" rev-parse --short=12 HEAD 2>/dev/null || echo unknown)"
  echo "javac=$(javac -version 2>&1)"
} > "$BUILD_INFO"

printf '\nBuilt %s\n' "${JAR_FILE#"$WORKSPACE_DIR"/}" >&2
