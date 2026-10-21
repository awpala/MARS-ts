#!/usr/bin/env bash
# Run the repository gates in dependency order and report a single pass/fail
# summary. CI (.github/workflows/verify.yml) runs the same script so local and
# automated checks exercise one contract.
#
# Tiers:
#   harness  agent-harness integrity (check-harness.sh) and shell lint
#   docs     ADR index matches the decision records on disk
#   legacy   build the Java MARS oracle, smoke it, and verify captured fixtures
#   app      svelte-check, ESLint, Prettier, Vitest, production build
#
# Before the SvelteKit app is scaffolded (no package.json), the app tier is
# reported as SKIPPED -- listed in the summary, never counted as passed. Every
# other missing input is a failure: a damaged or wrongly mounted workspace must
# not report success by skipping a tier.
#
# Usage: checks.sh [harness|docs|legacy|app]   (no argument runs everything)
#
# No -e: a failing gate must not hide another diagnostic.
# Functions are passed to run_gate as command arguments. ShellCheck cannot
# resolve those indirect calls and otherwise reports their bodies as dead code.
# shellcheck disable=SC2317
set -uo pipefail

SCRIPT_PATH=$(readlink -f -- "${BASH_SOURCE[0]}")
SCRIPT_DIR=$(dirname -- "$SCRIPT_PATH")
WORKSPACE_DIR=$(cd -- "${SCRIPT_DIR}/../../.." && pwd -P)
APP_DIR="${WORKSPACE_DIR}"
declare -a FAILURES=()
declare -a SKIPPED=()

if [ "$#" -gt 1 ]; then
  echo "Usage: $0 [harness|docs|legacy|app]" >&2
  exit 2
fi

# Run the command after its label and accumulate failures without hiding later
# gates. FAILURES owns the final exit status; individual commands may fail.
run_gate() {
  local label=$1
  shift
  echo
  echo "=== ${label} ==="
  if "$@"; then
    echo "--- PASS: ${label}"
  else
    echo "--- FAIL: ${label}" >&2
    FAILURES+=("$label")
  fi
}

# Lint every checked-in shell script. bash -n catches syntax errors; ShellCheck
# catches quoting and portability defects that only surface on unusual input.
lint_shell() {
  local -a scripts=()
  mapfile -t scripts < <(
    cd "$WORKSPACE_DIR" && find .devcontainer -name '*.sh' -print | LC_ALL=C sort
  )
  scripts+=("cleanup.sh")
  local script failed=0
  for script in "${scripts[@]}"; do
    bash -n "${WORKSPACE_DIR}/${script}" || failed=1
  done
  if ! command -v shellcheck >/dev/null 2>&1; then
    echo "shellcheck is not on PATH; run 'bash /scripts/setup-env.sh' in the dev container." >&2
    return 1
  fi
  (cd "$WORKSPACE_DIR" && shellcheck -x -P .devcontainer/scripts "${scripts[@]}") || failed=1
  [ "$failed" -eq 0 ] && echo "${#scripts[@]} shell script(s) clean."
}

# Assemble and run a fixed program through the legacy jar and compare stdout,
# stderr, and exit status byte for byte. This proves the oracle the port relies
# on is buildable and deterministic, not that any port behavior is correct.
smoke_legacy() {
  local work status
  work=$(mktemp -d)
  cat > "${work}/smoke.asm" <<'ASM'
        .data
msg:    .asciiz "hello from MARS\n"
        .text
main:   li   $v0, 4
        la   $a0, msg
        syscall
        li   $t0, 41
        addi $t0, $t0, 1
        li   $v0, 10
        syscall
ASM
  # MIPS register names are literal text, not shell variables.
  # shellcheck disable=SC2016
  printf 'hello from MARS\n\n8\n\n$t0\t0x0000002a\n' > "${work}/expected.out"
  # shellcheck disable=SC2016
  "${SCRIPT_DIR}/run-legacy.sh" nc ic '$t0' "${work}/smoke.asm" > "${work}/actual.out" 2> "${work}/actual.err"
  status=$?
  if [ "$status" -ne 0 ] || [ -s "${work}/actual.err" ] || ! cmp -s "${work}/expected.out" "${work}/actual.out"; then
    echo "Legacy smoke run differed (exit ${status})." >&2
    diff "${work}/expected.out" "${work}/actual.out" >&2
    cat "${work}/actual.err" >&2
    rm -rf -- "$work"
    return 1
  fi
  rm -rf -- "$work"
  echo "Legacy MARS assembled and ran the smoke program with the expected output."
}

check_harness() {
  run_gate "harness: integrity" "${SCRIPT_DIR}/check-harness.sh"
  run_gate "harness: shell lint" lint_shell
}

check_docs() {
  run_gate "docs: ADR index current" "${SCRIPT_DIR}/check-adr-index.sh"
}

check_legacy() {
  run_gate "legacy: build Mars.jar" "${SCRIPT_DIR}/build-legacy.sh"
  run_gate "legacy: oracle smoke run" smoke_legacy
  # The fixture runner also rebuilds so its standalone --check/--update modes
  # never accept stale classes. Keep that invariant when calling it from CI;
  # this extra build is provisional and disappears with Java at offboarding.
  run_gate "legacy: oracle fixtures" node "${WORKSPACE_DIR}/tests/oracle/run.mjs" --check
  # Method probes call the same freshly built classes without editing Java.
  # Vitest consumes these committed captures without requiring the JDK.
  run_gate "legacy: hardware and numeric probes" node "${WORKSPACE_DIR}/tests/oracle/units/run.mjs" --check
  run_gate "legacy: assembler probes" node "${WORKSPACE_DIR}/tests/oracle/assembler-units/run.mjs" --check --reuse-build
  run_gate "legacy: diagnostic probes" node "${WORKSPACE_DIR}/tests/oracle/diagnostics-units/run.mjs" --check
  run_gate "legacy: instruction descriptor probes" node "${WORKSPACE_DIR}/tests/oracle/instruction-units/run.mjs" --check
  run_gate "legacy: tokenizer probes" node "${WORKSPACE_DIR}/tests/oracle/tokenizer-units/run.mjs" --check
  run_gate "legacy: memory probes" node "${WORKSPACE_DIR}/tests/oracle/memory-units/run.mjs" --check
  run_gate "legacy: editor highlighting probes" node "${WORKSPACE_DIR}/tests/oracle/highlighting/run.mjs" --check
  run_gate "legacy: statement probes" node "${WORKSPACE_DIR}/tests/oracle/statement-units/run.mjs" --check
  run_gate "legacy: extended instruction probes" node "${WORKSPACE_DIR}/tests/oracle/extended-instruction-units/run.mjs" --check
  run_gate "legacy: instruction execution probes" node "${WORKSPACE_DIR}/tests/oracle/instruction-set/run.mjs" --check
  run_gate "legacy: backstep probes" node "${WORKSPACE_DIR}/tests/oracle/backstep-units/run.mjs" --check
  run_gate "legacy: program lifecycle probes" node "${WORKSPACE_DIR}/tests/oracle/program-units/run.mjs" --check
  run_gate "legacy: floating runtime probes" node "${WORKSPACE_DIR}/tests/oracle/floating-units/run.mjs" --check
  run_gate "legacy: operand probes" node "${WORKSPACE_DIR}/tests/oracle/operand-format-units/run.mjs" --check
  run_gate "legacy: complete assembler probes" node "${WORKSPACE_DIR}/tests/oracle/assembler-programs/run.mjs" --check
  run_gate "legacy: core syscall probes" node "${WORKSPACE_DIR}/tests/oracle/core-syscalls/run.mjs" --check
  run_gate "legacy: simulator probes" node "${WORKSPACE_DIR}/tests/oracle/simulator-units/run.mjs" --check
  # GUI argument parsing and stack initialization remain pinned to the untouched Java implementation.
  run_gate "legacy: program argument probes" node "${WORKSPACE_DIR}/tests/oracle/program-arguments-units/run.mjs" --check
  run_gate "legacy: settings probes" node "${WORKSPACE_DIR}/tests/oracle/settings-units/run.mjs" --check
}

# Run each app gate independently so the summary names every failed command.
check_app() {
  if [ ! -f "${APP_DIR}/package.json" ]; then
    echo
    echo "=== app ==="
    echo "--- SKIPPED: app (SvelteKit app not scaffolded; no package.json)"
    SKIPPED+=("app (not scaffolded)")
    return
  fi
  run_gate "app: svelte-check" npm --prefix "${APP_DIR}" run check
  run_gate "app: eslint" npm --prefix "${APP_DIR}" run lint
  run_gate "app: prettier" npm --prefix "${APP_DIR}" run format:check
  run_gate "app: vitest" npm --prefix "${APP_DIR}" run test
  run_gate "app: build" npm --prefix "${APP_DIR}" run build
}

case "${1:-all}" in
  harness) check_harness ;;
  docs) check_docs ;;
  legacy) check_legacy ;;
  app) check_app ;;
  all)
    check_harness
    check_docs
    check_legacy
    check_app
    ;;
  *)
    echo "Usage: $0 [harness|docs|legacy|app]" >&2
    exit 2
    ;;
esac

echo
if [ ${#SKIPPED[@]} -gt 0 ]; then
  echo "Skipped gates (${#SKIPPED[@]}; not passed):"
  printf '  - %s\n' "${SKIPPED[@]}"
fi
if [ ${#FAILURES[@]} -eq 0 ]; then
  echo "All executed gates passed."
  exit 0
fi
echo "Failed gates (${#FAILURES[@]}):" >&2
printf '  - %s\n' "${FAILURES[@]}" >&2
exit 1
