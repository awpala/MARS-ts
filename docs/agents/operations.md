# Development operations and validation

The port runs in one container described by [devcontainer.json](../../.devcontainer/devcontainer.json); the decision and its persistence model are in [ADR 0001](../adrs/0001-local-development-environment.md). [setup-env.sh](../../.devcontainer/scripts/setup-env.sh) installs OS tools, verifies the feature toolchains (Node, TypeScript, JDK, CLIs), installs the global `sv` CLI, runs `npm ci` once a lockfile exists, writes shell entries, and exposes live helpers for interactive and noninteractive shells. There is no service orchestration layer.

## Commands

| Command                                   | Behavior                                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| `run-checks [harness\|docs\|legacy\|app]` | Run gates and report every failure and skip; no selector runs all tiers                      |
| `build-legacy`                            | Compile the legacy Java MARS into `__build/legacy/Mars.jar`, from scratch (provisional)      |
| `run-legacy <options> <file.asm>`         | Run legacy MARS headlessly with isolated preferences (provisional)                           |
| `run-app`                                 | Start `npm run dev` on `6277` with timestamped `__logs/local/app-*.log` and a latest symlink |
| `tests`                                   | Run Vitest                                                                                   |
| `format`                                  | ESLint fixes, then Prettier (stops at the first failure)                                     |
| `build-app`                               | Clean generated output, `npm ci`, and build                                                  |
| `kill-app`                                | Stop only the listener on `6277`, preserving PID identity through bounded escalation         |
| `cd "$app"`, `cd "$legacy"`               | `/workspace` for the port; `/workspace/_legacy-app` for the Java reference                   |

The root package is scaffolded and app commands are active. Noninteractive callers (agents, CI) can use `run-checks`, `tests`, `format`, `build-app`, `kill-app`, `build-legacy`, and `run-legacy` from `PATH`; `run-app` is an interactive alias, and noninteractive callers run `/scripts/bin/run-local-service.sh app`.

Port `6277` is exclusively for the human; agents never start, stop, request, or test against it. Agents use `npm run test:browser` on `6278` and `MARS_VALIDATION=1 run-checks` to isolate generated SvelteKit files and Vite caches. For ad hoc agent servers (manual probes, screenshots, smoke checks), bind port `6279` or higher, for example `npm run dev -- --mode browser-test --port 6279`, stop only that process afterwards, and do not run it alongside `npm run test:browser`, which shares its isolated build output. Do not use `run-app`, `kill-app`, or a bare `npm run dev` or `npm run preview`; each targets `6277`. Install Chromium and its system libraries with `npm run test:browser:install` when browser validation is needed in a fresh environment.

## Gates

[checks.sh](../../.devcontainer/scripts/bin/checks.sh) runs each tier and continues after a failure so the summary is complete:

| Tier      | Gates                                                                                                                                                                                                                                                                                                                       |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `harness` | [check-harness.sh](../../.devcontainer/scripts/bin/check-harness.sh): `CLAUDE.md` link, role adapters, skill mirror, strict JSON, relative Markdown links, Codex rules (when the CLI is present); then `bash -n` and ShellCheck over every script                                                                           |
| `docs`    | [check-adr-index.sh](../../.devcontainer/scripts/bin/check-adr-index.sh): `docs/README.md` indexes exactly the ADRs on disk                                                                                                                                                                                                 |
| `legacy`  | `build-legacy`, a byte-exact smoke run through `run-legacy`, then `node tests/oracle/run.mjs --check` to verify the captured corpus (the standalone runner rebuilds independently), followed by all registered hardware, numeric, assembler, instruction, syscall, simulator, settings, and editor method-probe comparisons |
| `app`     | `check`, `lint`, `format:check`, `test`, `build`; these run against the scaffolded root application                                                                                                                                                                                                                         |

CI ([verify.yml](../../.github/workflows/verify.yml)) installs the same Node and JDK majors and ShellCheck, then runs `checks.sh`. A skipped tier is listed separately and never counts as passed.

## Helper contracts

Scripts resolve the workspace from their own real path (following the `/usr/local/bin` and `/scripts` links), so they run unchanged in the container, in CI, and from a Linux checkout with the toolchains installed. Do not add environment-variable overrides or workspace discovery beyond that.

The setup script's `upsert_alias` and `upsert_export` calls are authoritative. Profile entries are replaced idempotently, never appended as competing definitions. Command links point at the live scripts and are never copies. Runtime installation directories (`/usr/local/bin`, Node, the SDKMAN JDK) must not be hidden by persistent volumes.

The app launcher keeps timestamped output with a latest symlink, records the source revision and lifecycle events, and forwards signals to its process group. `kill-app` targets only the configured port and verifies process identity before escalation. Neither helper starts unrelated services or kills processes by name.

`run-legacy` must keep its isolation: headless AWT, a fresh preferences root per run with its store directories pre-created (so the JDK logs nothing to stderr), and MARS's own stdin, stdout, stderr, and exit status. `build-legacy` compiles from `_legacy-app/`, copies runtime resources from that directory and the shared `MARSlicense.txt` from the repository root, and always deletes and rebuilds its output so stale classes cannot mask a source difference. `run-legacy` preserves the caller’s working directory so source arguments and includes keep their existing semantics. Rerun setup to refresh the `$legacy` shortcut in existing containers; the live build/run helpers need no reinstall.

## Provisioning rules

Keep provisioning comments explaining order, dependencies, failures, recovery, ownership, and what is provisional. Required installs fail loudly; never paper over a broken lockfile with `npm install`. No tracing or environment dumps during setup. Setup success means tools are ready, not that any gate passed.

The random/dialog method probe additionally runs actual Swing services through `xvfb-run` with isolated preferences and automated responses; it requires the provisioned Xvfb/xauth, AWT X11 libraries, and fonts. The ordinary CLI oracle remains headless.

The provisional Swing display/font packages, Java feature, `build-legacy.sh`, `run-legacy.sh`, the `legacy` tier, the `$legacy` export, the Java extension and settings, and the CI Java step are **provisional**. They are removed together at offboarding (milestone P5 of the [port plan](../adrs/0000-port-plan.md#6-milestones)); do not remove part of the set early or leave any of it behind.

`cleanup.sh` runs on the host and removes the `mars-ts-dev-env` container; `cleanup.sh --volumes` also deletes this project's dependency caches and CLI credentials. It never removes the bind-mounted checkout. MARS-ts is live and stable at `mars-ide.portfolio-projects.dev` through the corresponding GitHub App in Coolify. The [Coolify runbook](../runbooks/prod-deployment.md) owns maintenance, routine release checks, configuration changes, and recovery for that existing deployment.
