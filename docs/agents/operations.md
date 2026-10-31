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

Port `6277` is exclusively for the human; agents never start, stop, request, or test against it. `npm run test:browser` allocates available group-server ports starting at `6278`; `MARS_VALIDATION=1 run-checks` isolates other generated SvelteKit files and Vite caches. For ad hoc agent servers, bind an available port `6279` or higher, for example `npm run dev -- --mode browser-test --port 6279`, and stop only that process afterward. Do not use `run-app`, `kill-app`, or a bare `npm run dev` or `npm run preview`; each targets `6277`. Install Chromium and its system libraries with `npm run test:browser:install` when browser validation is needed in a fresh environment.

The browser command wrapper collects the requested cases, freezes application/test/harness/configuration inputs once under `__build/browser-runs/<run-id>/inputs`, then gives every queued group a private copy under `__build/browser-runs/<run-id>/<group>/app` in an independent child process. Each group shares read-only installed dependencies through a link but owns its generated output, `__build/browser-vite-cache`, startup check, server, and results under `__build/browser-results/<run-id>/<group>`. Authorized working-tree fixes and fresh impacted-group invocations can proceed while unaffected snapshots finish; preserve captured inputs and shared installed dependencies. Tests, helpers, and Playwright configuration are included in the copies, with root-owned results, report, and log destinations injected into the children. Tailwind scans runtime `src/` files rather than Markdown or browser tests, and Vite stdout/stderr is preserved for reload/invalidation diagnosis. The [suite guide](../../tests/browser/README.md#server-and-browser-ownership) owns the full snapshot and scheduling contract.

## Test run logs

Capture stdout and stderr for every in-flight test or check command under the repository-root `__logs/__test-runs/` directory. Name each log `<timestamp>_<task-scope>.log`: `<timestamp>` is a Unix timestamp in seconds, and `<task-scope>` describes the work being validated. Use this location for full gates, targeted reruns, and formatting/type/lint checks; do not put their logs in `/tmp` or another temporary location. The directory is already covered by the repository's ignored logs tree and holds run evidence, not tracked documentation.

Preserve the command's actual exit status when redirecting output or reporting its log path. For example, this subshell captures both streams and returns the browser command's status:

```sh
(
  mkdir -p __logs/__test-runs
  run_log="__logs/__test-runs/$(date +%s)_browser-selectors.log"
  npm run test:browser -- --project=settings --last-failed >"$run_log" 2>&1
  run_status=$?
  printf 'Log: %s\n' "$run_log"
  exit "$run_status"
)
```

Use distinct descriptive scopes when needed to avoid overwriting an earlier run. Read or tail the saved log for progress, and report the original command, result, and log path as completion evidence. Browser traces, HTML reports, and other structured artifacts retain their configured output locations; they complement these stdout/stderr logs.

Browser runs capture complete child output in `<timestamp>_<pid>_browser-<group>-runner.log` and additionally use the configured project reporter to create `<timestamp>_browser-<project>-<pid>.log` for groups, startup, and infrastructure events. Reporter logs contain live starts, outcomes, errors, worker output, and summaries including `notRun`; retain the full master invocation log for wrapper/npm output too. Keep default reporters when selecting projects rather than overriding `--reporter`. Inventory-only `--list` runs create no snapshots or project logs, and a reporter log-write failure fails validation. The [browser suite guide](../../tests/browser/README.md#running-scenarios) describes project selection and local/CI reporting.

## Gates

[checks.sh](../../.devcontainer/scripts/bin/checks.sh) runs each tier and continues after a failure so the summary is complete:

| Tier      | Gates                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `harness` | [check-harness.sh](../../.devcontainer/scripts/bin/check-harness.sh): `CLAUDE.md` link, role adapters, skill mirror, strict JSON, relative Markdown links, Codex rules (when the CLI is present); then `bash -n` and ShellCheck over every script                                                                                                                                                                                                                                                                                                                                                                                                     |
| `docs`    | [check-adr-index.sh](../../.devcontainer/scripts/bin/check-adr-index.sh): `docs/README.md` indexes exactly the ADRs on disk                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `legacy`  | `build-legacy`, a byte-exact smoke run through `run-legacy`, then `node tests/oracle/run.mjs --check` to verify the captured corpus (the standalone runner rebuilds independently), followed by every registered method-probe comparison: hardware and numeric units, assembler, diagnostics, instruction descriptors, tokenizer, memory, editor highlighting, statements, extended instructions, instruction execution, backstep, program lifecycle, floating runtime, operands, the complete assembler corpus, random/Swing dialog/MIDI and core syscalls, simulator, program arguments, dump formats, settings, and the exception-handler workflow |
| `app`     | `check`, `lint`, `format:check`, `test`, `build`; these run against the scaffolded root application                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

The existing `Verify` workflow ([verify.yml](../../.github/workflows/verify.yml)) runs on push and pull-request events. It installs the same Node and JDK majors, ShellCheck, and the provisional Swing oracle display/font packages, runs `npm ci`, then runs `checks.sh` for harness, documentation, Java oracle, and application gates. Its application tier includes Vitest and the static build; Playwright browser scenarios run separately. A skipped tier is listed separately and never counts as passed.

The dedicated `Browser tests` workflow ([browser.yml](../../.github/workflows/browser.yml)) runs on pushes to `main` and on `merge_group` events of type `checks_requested` targeting `main`. Ordinary feature-branch pushes and pull-request updates do not start this browser runner. Node-only [suite discovery](../../tests/browser/harness/suites.ts) supplies both local Playwright projects and the CI matrix, keeping semantic group membership aligned. CI runs at most four group jobs concurrently on separate Ubuntu runners, with matrix fail-fast disabled so one failure does not cancel the remaining groups.

Each group job installs Node 24, application dependencies with `npm ci`, `unzip`, and Chromium/system dependencies through `npm run test:browser:install`, then selects its project through the same wrapper with `npm run test:browser -- --project=<group>`. Each child owns its application snapshot, available server port starting at 6278, startup check, and isolated browser contexts. Tests within a file retain declaration order. Locally, the wrapper runs two groups concurrently with at least four available CPUs, or one on smaller hosts, and one worker per group. CI selects one group per runner and can parallelize its files with the corresponding two-worker/one-worker budget. The 30-minute job allowance covers provisioning and the assigned group; scenario/readiness deadlines remain independent.

CI retains GitHub, HTML, and project-file reporters and captures complete command output through `tee` with `pipefail`. Non-canceled jobs upload available HTML reports, browser results/failure traces, and run logs as `browser-results-<group>` for 14 days. The stable `Chromium browser suite` aggregate check requires discovery and every matrix group to succeed, so its required-check name remains independent of the discovered group names.

Preserve the browser suite's shared 60-second scenario limit and 30-second desktop readiness wait. Use failure traces to investigate locators, application state, harness behavior, and implementation performance before considering a timeout exception. A longer per-scenario deadline requires a documented, intentionally long workload; do not use it to compensate for an unresolved defect or slow interaction. See the [suite's server and browser contract](../../tests/browser/README.md#server-and-browser-ownership).

Follow the canonical [browser validation scope](workflow.md#browser-validation-scope): local ad hoc feature work selects only impacted groups/cases, while configured CI retains the complete browser sentinel. The suite's [failure triage and confirmation process](../../tests/browser/README.md#failure-triage-and-confirmation) governs monitoring and batched focused confirmation; a local full sanity pass belongs to an explicitly broad assignment or human request. Freeze each runner's captured inputs and shared installed dependencies rather than unrelated working-tree files; finish affected changes and fast gates before launching their fresh snapshot.

The pre-merge path requires an available, configured GitHub merge queue. Enabling that queue and selecting required status checks are human-owned repository settings; the workflow file does neither. An ordinary Merge-button attempt without a queue has no corresponding trigger here, while the resulting push to `main` runs the browser workflow after the merge. The [browser suite guide](../../tests/browser/README.md#continuous-integration) describes how to interpret its evidence and artifacts.

## Helper contracts

Scripts resolve the workspace from their own real path (following the `/usr/local/bin` and `/scripts` links), so they run unchanged in the container, in CI, and from a Linux checkout with the toolchains installed. Do not add environment-variable overrides or workspace discovery beyond that.

The setup script's `upsert_alias` and `upsert_export` calls are authoritative. Profile entries are replaced idempotently, never appended as competing definitions. Command links point at the live scripts and are never copies. Runtime installation directories (`/usr/local/bin`, Node, the SDKMAN JDK) must not be hidden by persistent volumes.

The devcontainer setup installs `unzip` for the browser tests' independent ZIP archive inspection helper.

The app launcher keeps timestamped output with a latest symlink, records the source revision and lifecycle events, and forwards signals to its process group. `kill-app` targets only the configured port and verifies process identity before escalation. Neither helper starts unrelated services or kills processes by name.

`run-legacy` must keep its isolation: headless AWT, a fresh preferences root per run with its store directories pre-created (so the JDK logs nothing to stderr), and MARS's own stdin, stdout, stderr, and exit status. `build-legacy` compiles from `_legacy-app/`, copies runtime resources from that directory and the shared `MARSlicense.txt` from the repository root, and always deletes and rebuilds its output so stale classes cannot mask a source difference. `run-legacy` preserves the caller’s working directory so source arguments and includes keep their existing semantics. Rerun setup to refresh the `$legacy` shortcut in existing containers; the live build/run helpers need no reinstall.

## Provisioning rules

Keep provisioning comments explaining order, dependencies, failures, recovery, ownership, and what is provisional. Required installs fail loudly; never paper over a broken lockfile with `npm install`. No tracing or environment dumps during setup. Setup success means tools are ready, not that any gate passed.

The platform-syscall probe's dialog capture additionally runs actual Swing services through `xvfb-run` with isolated preferences and automated responses; it requires the provisioned Xvfb/xauth, AWT X11 libraries, and fonts. Its random and MIDI captures, like the ordinary CLI oracle, remain headless.

The provisional Swing display/font packages, Java feature, `build-legacy.sh`, `run-legacy.sh`, the `legacy` tier, the `$legacy` export, the Java extension and settings, and the CI Java step are **provisional**. They are removed together at offboarding (milestone P5 of the [port plan](../adrs/0000-port-plan.md#6-milestones)); do not remove part of the set early or leave any of it behind.

`cleanup.sh` runs on the host and removes the `mars-ts-dev-env` container; `cleanup.sh --volumes` also deletes this project's dependency caches and CLI credentials. It never removes the bind-mounted checkout. MARS-ts is live and stable at `mars-ide.portfolio-projects.dev` through the corresponding GitHub App in Coolify. The [Coolify runbook](../runbooks/prod-deployment.md) owns maintenance, routine release checks, configuration changes, and recovery for that existing deployment.
