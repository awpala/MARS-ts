# ADR 0001: One Standalone Development Container with a Provisional JDK

- **Status**: Accepted
- **Date**: 2026-10-19

## Context

The port needs a Node toolchain for the SvelteKit app and, temporarily, a JDK that builds and runs the original Java MARS as a behavioral oracle ([port plan](0000-port-plan.md)). Neither needs backing services. A standalone `devcontainer.json` supplies both. The setup script keeps explicit ordering, logging, retry, alias, and process-ownership conventions so provisioning failures remain diagnosable.

## Decision

Use one base-image devcontainer with pinned features:

| Feature | Purpose | Lifetime |
| --- | --- | --- |
| Node (major 24, npm only) | SvelteKit app, npm scripts, the `sv` CLI | Permanent |
| TypeScript | A global `tsc` for ad hoc use; the app's own devDependency stays authoritative for gates | Permanent |
| Java (JDK 21, no Maven or Gradle) | `javac`, `jar`, and `java` for `build-legacy` and `run-legacy` | **Provisional**, removed at offboarding (P5) |
| GitHub CLI, Claude Code, Codex, common-utils | Developer and agent tooling | Permanent |

JDK 21 was chosen because it is an LTS line that compiles the MARS 4.5 sources unmodified (with deprecation notes only) and runs them headlessly. No build tool is installed: the legacy tree has no build descriptor, and `build-legacy` reproduces `CreateMarsJar.bat` with `javac` and `jar`.

Bind the checkout at `/workspace` and link `/scripts` to `/workspace/.devcontainer/scripts` before running `setup-env.sh` after creation. `/scripts` is a symlink rather than a second bind mount because Docker pins a bind mount to the directory present at container start: a branch switch or pull that deletes and recreates `.devcontainer/scripts` would leave the mount attached to the deleted, empty directory until the container is recreated. The symlink resolves through the stable checkout mount on every access.

```text
base image + pinned features (Node, TypeScript, JDK, CLIs)
  -> setup-env.sh
       -> idempotent shell profile and live command links
       -> apt tools (ripgrep, iproute2, shellcheck, build-essential;
          provisional Xvfb, xauth, X11 libraries, and fonts for the Swing dialog oracle)
       -> feature command verification (node, tsc, java, javac, jar, ...)
       -> global sv CLI
       -> npm ci (only once package-lock.json exists)
       -> operator handoff
```

Ordering matters. The feature commands are verified before anything depends on them, so a JRE-only or failed Java feature fails setup instead of failing later inside `build-legacy`. Before the app is scaffolded, the absence of `package.json` is the one state in which `npm ci` is skipped; once a lockfile exists, an install failure fails setup, and a `package.json` without a lockfile is a broken checkout. Setup never builds the legacy jar or starts a listener: those are explicit developer or gate actions. The Xvfb/xauth, AWT X11 libraries, and fonts were added later for the automated Swing dialog probe ([ADR 0014](0014-random-and-dialog-syscalls.md)); they share the JDK's provisional lifetime and are removed with it at P5. Playwright's Chromium is not provisioned here; `npm run test:browser:install` installs it when browser validation is needed ([development operations](../agents/operations.md)).

## Persistence and boundaries

| Storage | Lifecycle |
| --- | --- |
| Checkout bind mount and `/scripts` symlink | Live host source; wrapper edits and recreated script directories require no rebuild |
| npm cache and `node_modules` volumes | Reused downloads; dependency tree reconstructed by `npm ci` |
| CLI configuration volumes (gh, Claude, Codex) | Authentication and state survive rebuilds |
| Toolchains, `/usr/local/bin`, SDKMAN JDK | Image-owned; never hidden behind stale persistent volumes |
| `__build/legacy/` | Ignored; rebuilt from scratch by every `build-legacy` |
| `__logs/local/` | Ignored; timestamped `run-app` logs with a latest symlink |
| `/tmp/setup-env-debug.log` | Container-local setup diagnostics |

No `.env` file is required by container provisioning: the static application has no required runtime secrets or server configuration. The existing `MARS_VALIDATION` build/test switch is supplied by validation commands and does not require an env file. Add `--env-file` together with a real provisioning requirement and a `sample.env`, rather than making first launch depend on an unused file.

The container publishes and forwards port `6277` (phoneword "MARS") for the SvelteKit dev and preview servers. The app's Vite configuration owns the listener; `kill-app` targets only that port.

## Alternatives and consequences

Compose would add a topology with no independent services. Installing the JDK through apt would put a second, differently versioned `java` on `PATH` beside any SDKMAN installation and tie the version to the Debian release; the pinned feature keeps it explicit and removable. Running the oracle on the host would make golden fixtures depend on each developer's JDK and preferences. A Maven or Gradle wrapper around the legacy sources would add a build descriptor the original never had, solely to be deleted at offboarding.

The container carries a JDK the shipped product never uses, until P5. Cleanup removes the named container; deleting its known cache and CLI volumes is a separate, explicit option (`cleanup.sh --volumes`). Setup success means tools are ready, not that any gate passed.
