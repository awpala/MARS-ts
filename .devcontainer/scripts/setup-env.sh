#!/usr/bin/env bash
# MARS-ts -- single-container development provisioning.
# Invoked as root by devcontainer.json after its Node, TypeScript, and Java
# features are installed. The checkout is bind-mounted at /workspace; /scripts
# is a symlink to its .devcontainer/scripts, created by postCreateCommand
# before this script runs. Keep ordering explicit: shell profile -> OS tools ->
# toolchain report -> Svelte CLI -> npm lockfile -> handoff. Failed installs
# stop setup; rerun bash /scripts/setup-env.sh to retry.
# This script prepares tools inside the development container; it must never
# be used to provision the host.

# A failed dependency install is a failed setup. Do not turn required commands
# into best-effort `... || echo` steps: that leaves an apparently ready editor
# whose first build fails much later, far from the original cause. Undefined
# variables and failed pipelines also fail rather than silently carrying on.
set -euo pipefail

# Absolute paths work from interactive terminals and agent subprocesses.
# node_modules and npm cache have dedicated volumes. Never mount a volume over
# /usr/local/bin or the Node/JDK installations: it hides newly rebuilt image
# tools behind stale volume contents. Logs append in /tmp across retries.
WORKSPACE_DIR="/workspace"
SCRIPTS_DIR="/scripts"
SCRIPTS_BIN_DIR="${SCRIPTS_DIR}/bin"
BASH_RC="/root/.bashrc"
BASH_ALIASES="/root/.bash_aliases"
LOGFILE="/tmp/setup-env-debug.log"
# postCreateCommand has no operator to answer package configuration or service
# restart prompts. apt's switches and these environment values handle its
# normal unattended paths; closing stdin below is the backstop for an installer
# that still tries to ask. A prompt must encounter EOF, not hang setup forever.
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a
exec < /dev/null

# Preserve installer output for diagnosis while keeping it visible in the
# post-create terminal. Append so a retry does not erase the preceding failure.
# Never add `set -x`, a sorted environment dump, or a trap that prints the
# failing command: future configuration may contain sensitive values.
exec > >(tee -a "$LOGFILE") 2>&1

# on_error reports the failing location and preserves its status without
# echoing BASH_COMMAND or environment values. Keep the log path in the message
# so the concrete installer error can be found without rerunning under tracing.
on_error() {
  local status=$?
  echo "Setup failed at line ${BASH_LINENO[0]} (exit ${status}); see ${LOGFILE}." >&2
  exit "$status"
}
trap on_error ERR

echo
echo "===== setup-env.sh START ====="
date -u
echo "Workspace: $WORKSPACE_DIR"
echo "Setup log: $LOGFILE"
echo

# ---------------------------------------------------------------------------
# Shell configuration and command entry points
# ---------------------------------------------------------------------------
# Repeated setup must replace a definition rather than append another alias.
# Bash accepts duplicates and silently uses the last one, which can keep an old
# command alive after its wrapper has moved. shell-profile.sh owns the upsert
# mechanics; this file owns the intended names and targets. Only add the
# .bash_aliases hook when absent, preserving other root shell customization.
echo "--- Configuring the Bash profile ---"
touch "$BASH_RC" "$BASH_ALIASES"
if ! grep -q 'bash_aliases' "$BASH_RC"; then
  cat >> "$BASH_RC" <<'PROFILE'
if [ -f ~/.bash_aliases ]; then
  . ~/.bash_aliases
fi
PROFILE
fi
# shellcheck source=lib/shell-profile.sh
. "${SCRIPTS_DIR}/lib/shell-profile.sh"

# The base image's .bashrc aliases are not a stable interface: image and
# common-utils revisions may omit them, leave them commented, or use a different
# set. Write the ad hoc directory-listing conveniences into the profile we own
# so `ll` and its companions are available after every fresh container setup.
upsert_alias ls 'ls --color=auto'
upsert_alias ll 'ls -alF'
upsert_alias la 'ls -A'
upsert_alias l 'ls -CF'

# Enable the color and listing aliases supplied by the base image. Explicit
# aliases above guarantee the commands; this pass also preserves the image's
# related shell conveniences.
echo
echo "--- Post-processing .bashrc ---"
if [ -f "$BASH_RC" ]; then
  echo "Patching $BASH_RC (uncommenting colorized LS aliases)"
  sed -i -E 's/^#\s*export\s+/export /' "$BASH_RC" || true
  sed -i -E 's/^#\s*eval\s+/eval /' "$BASH_RC" || true
  sed -i -E 's/^#\s*alias\s+l/alias l/' "$BASH_RC" || true
fi

# Directory shortcuts are paths, not shell startup `cd` commands. A terminal
# stays where its caller opened it; `cd "$app"` is an explicit convenience.
# The legacy Java sources currently live at the repository root (Mars.java and
# mars/), so $legacy and $app are the same directory until the port decides a
# layout; both names exist so commands read by intent.
echo
echo "--- Writing directory exports and helper aliases ---"
upsert_export app "$WORKSPACE_DIR"
upsert_export legacy "$WORKSPACE_DIR"

# `pe` is an explicit operator diagnostic, never something setup invokes or
# logs automatically: printenv exposes inherited configuration.
upsert_alias pe 'printenv'

# The application launcher owns npm's process group and timestamped logs.
# Setup never starts an extra listener behind the developer's terminal.
upsert_alias run-app "${SCRIPTS_BIN_DIR}/run-local-service.sh app"

# Verification and diagnostics share the checked-in wrappers used by agents.
# The stop helper targets only the configured application listener.
upsert_alias run-checks "${SCRIPTS_BIN_DIR}/checks.sh"
upsert_alias build-app "${SCRIPTS_BIN_DIR}/build-app.sh"
upsert_alias tests "${SCRIPTS_BIN_DIR}/tests.sh"
upsert_alias format "${SCRIPTS_BIN_DIR}/format.sh"
upsert_alias kill-app "${SCRIPTS_BIN_DIR}/kill-app.sh"

# Legacy oracle helpers (provisional; removed with the Java sources).
upsert_alias build-legacy "${SCRIPTS_BIN_DIR}/build-legacy.sh"
upsert_alias run-legacy "${SCRIPTS_BIN_DIR}/run-legacy.sh"

# Bash aliases normally exist only in interactive shells. CI-like commands and
# agent subprocesses must also find the shared gates, so expose real commands
# on PATH as symlinks to the live /scripts link. Do not copy the wrappers:
# copied versions silently drift from the repository on the next edit.
# The run-app convenience remains an alias; a noninteractive caller invokes
# /scripts/bin/run-local-service.sh app.
# chmod repairs execute bits on the writable checkout where necessary.
echo
echo "--- Installing command links for non-interactive shells ---"
chmod +x "${SCRIPTS_BIN_DIR}"/*.sh
ln -sf "${SCRIPTS_BIN_DIR}/build-app.sh" /usr/local/bin/build-app
ln -sf "${SCRIPTS_BIN_DIR}/format.sh" /usr/local/bin/format
ln -sf "${SCRIPTS_BIN_DIR}/kill-app.sh" /usr/local/bin/kill-app
ln -sf "${SCRIPTS_BIN_DIR}/checks.sh" /usr/local/bin/run-checks
ln -sf "${SCRIPTS_BIN_DIR}/tests.sh" /usr/local/bin/tests
ln -sf "${SCRIPTS_BIN_DIR}/build-legacy.sh" /usr/local/bin/build-legacy
ln -sf "${SCRIPTS_BIN_DIR}/run-legacy.sh" /usr/local/bin/run-legacy

# ---------------------------------------------------------------------------
# OS tooling
# ---------------------------------------------------------------------------
# ca-certificates/curl/gnupg support vendor downloads, ripgrep supports source
# search across the large legacy tree, iproute2 supplies the listener
# diagnostics kill-app.sh relies on (ss), shellcheck backs the harness gate in
# checks.sh, and build-essential supplies native compilation tools for npm
# dependency builds.
#
# No browser is installed yet. Chromium becomes necessary only when the app
# adds browser-driven tests or diagram rendering; add it then, together with
# the gate that consumes it, rather than carrying dormant tooling.
#
# The JDK is NOT installed here: the pinned Java feature in devcontainer.json
# owns it (SDKMAN under /usr/local/sdkman). Do not add an apt JDK -- two JDKs
# on PATH make `javac` and `java` resolve to different versions depending on
# shell initialization.
echo
echo "--- Refreshing package metadata ---"
apt-get update
echo
echo "--- Installing search, diagnostics, lint, and build tools ---"
apt-get install --yes --no-install-recommends \
  ca-certificates curl gnupg ripgrep iproute2 shellcheck build-essential

# ---------------------------------------------------------------------------
# Toolchain report
# ---------------------------------------------------------------------------
# Fail now, with a clear message, if a feature did not deliver its command.
# The legacy oracle needs all three JDK commands: javac and jar to build
# Mars.jar, java to run it. A JRE-only installation would pass a `java` probe
# and fail later inside build-legacy.
echo
echo "--- Verifying feature-provided commands ---"
for command_name in node npm tsc java javac jar gh claude codex; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required command '${command_name}' is missing; check the devcontainer features." >&2
    exit 1
  fi
done
node --version
npm --version
tsc --version
java -version
javac -version

# ---------------------------------------------------------------------------
# First-party Svelte CLI
# ---------------------------------------------------------------------------
# Install sv globally for ad hoc use inside the development container. The
# explicit /usr/local prefix puts its executable on the shared command path,
# including noninteractive shells, without adding it to the app's dependencies.
# npm installs the published release and safely refreshes it when setup reruns.
# This runs only in the disposable dev container; it is not a host installer.
# Setup installs the CLI and reports its version. Project creation (`sv
# create`), add-ons, and migrations are commands the developer invokes
# separately -- scaffolding the app is a port milestone, not a setup step.
echo
echo "--- Installing the Svelte CLI globally ---"
npm install --global --prefix /usr/local --no-audit --no-fund sv
sv --version

# ---------------------------------------------------------------------------
# Application dependencies and operator handoff
# ---------------------------------------------------------------------------
# npm ci reconstructs the checked-in dependency tree in the container volume.
# Never fall back to npm install on failure: that conceals lockfile drift.
#
# Before the SvelteKit app is scaffolded there is no package.json, and that is
# the only case this step skips. Once package-lock.json exists, an `npm ci`
# failure is a setup failure like any other. A package.json without a lockfile
# is a broken checkout, not a pre-scaffold state, so it fails too.
echo
if [ -f "${WORKSPACE_DIR}/package-lock.json" ]; then
  echo "--- Installing application dependencies from the npm lockfile ---"
  npm ci --prefix "$WORKSPACE_DIR"
elif [ -f "${WORKSPACE_DIR}/package.json" ]; then
  echo "package.json exists without package-lock.json; commit a lockfile before provisioning." >&2
  exit 1
else
  echo "--- SvelteKit app not scaffolded yet; skipping npm ci ---"
  echo "See docs/adrs/0000-port-plan.md (milestone P1) for the scaffold step."
fi

echo
echo "===== setup-env.sh END ====="
# Writing the profile does not update an already-open shell. Only announce
# readiness after every install succeeds. Readiness is not build validation.
cat <<'HELP'

Development setup completed. Open a new terminal to load these commands.
Setup log: /tmp/setup-env-debug.log

  run-app              Start SvelteKit on 6277 ("MARS"); Ctrl-C owns shutdown
  run-checks          Run harness, docs, legacy, and app gates, with a failure summary
  tests               Run the Vitest suite
  format              Apply ESLint fixes, then Prettier
  build-app            Clean generated output, npm ci, and build
  kill-app             Stop only the configured application listener
  build-legacy         Compile the legacy Java MARS into __build/legacy/Mars.jar
  run-legacy           Run legacy MARS headlessly (CLI mode), e.g. run-legacy nc prog.asm

App commands report "not scaffolded" until package.json exists.
Directory shortcuts: cd "$app" (/workspace), cd "$legacy" (/workspace).
Port plan: docs/adrs/0000-port-plan.md.
HELP
