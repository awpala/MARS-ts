# Project scope and identity

MARS-ts ports the checked-in canonical Java implementation of MARS, the MIPS Assembler and Runtime Simulator, to a SvelteKit web application in TypeScript. The target release is MARS-ts 1.0, independent of legacy version labels. The [port plan](../adrs/0000-port-plan.md) is authoritative for scope, stack, layout, milestones, and open decisions; this guide holds the values every change must keep consistent.

## Current state

Milestones P0, P1, and P2 are complete. The root [package](../../package.json), [Vite configuration](../../vite.config.ts), and [source tree](../../src/) now exist alongside the prepared [oracle fixtures](../../tests/oracle/README.md) and [browser assets](../../static/README.md). All four validation tiers are active, and browser workflows are exercised on isolated port 6278; report the result of an actual run rather than relying on this summary. The core assembler, simulator, console/random/dialog/MIDI syscalls, exception handling with the automatic handler workflow, memory configuration, all six enabled dump formats, Help, and desktop debugging are implemented. All 21 original whole-program cases, including program arguments and seeded randomness, run against the production engine; CLI integration remains excluded. Module-level Java probes cover assembly, every basic instruction callback, hardware, numeric conversions, console/random syscalls, actual Swing dialogs, MIDI sequences, execution sequencing, settings, backstepping, dump formats, and the exception-handler workflow. Every legacy Settings entry is implemented except the Editor and Highlighting dialogs, deliberately replaced by bundled presets, and the removed assemble-all setting. The file, time, and sleep syscalls, the bundled Tools, and editor instruction popup completion are unfinished. The full port remains authorized through the existing milestones, with CLI integration excluded ([ADR 0002](../adrs/0002-port-fidelity.md)).

## Identity

| Role | Value | Constraint |
| --- | --- | --- |
| Display name | `MARS` | Human-facing title of the application ("MARS — MIPS Assembler and Runtime Simulator") |
| Machine slug | `mars-ts` | npm package name, Docker resource names (`mars-ts-dev-env`, `mars-ts_*` volumes) |
| Target release | `1.0` | TypeScript port release target; does not claim implementation completion |
| Repository | `awpala/MARS-ts` | GitHub owner `awpala` |
| Local dev/preview port | `6277` | Phoneword "MARS"; Vite `server.port` and `preview.port`, devcontainer publish/forward, `kill-app` |
| Production port and origin | Internal `80`; `https://mars-ide.portfolio-projects.dev` | Live, stable Coolify static hosting through the corresponding GitHub App; [ADR 0005](../adrs/0005-coolify-deployment.md) |

Keep display names out of machine identifiers, and update related configuration together when a value changes. The port number appears in `devcontainer.json`, `kill-app.sh`, `setup-env.sh`'s handoff text, these guides, and (from P1) `vite.config.ts`.

## Attribution

MARS is copyright 2003–2013 Pete Sanderson and Kenneth Vollmar, under the MIT license in [MARSlicense.txt](../../MARSlicense.txt). The port is a derivative work: keep that license file, carry the copyright notice in ported source modules and copied data files (for example `PseudoOps.txt`), and credit the original authors in the application's About content.

## Repository layout

| Path | Owner | Notes |
| --- | --- | --- |
| `_legacy-app/` | Legacy application | Java sources, resources, packaging, and Javadoc; see the [legacy guide](legacy.md) |
| `MARSlicense.txt` | Shared attribution | Original license retained at the root through offboarding; packaged into both applications |
| `README.md`, `IMPLEMENTATION.md` | Port documentation | Brief entry point and the current-system [implementation guide](../../IMPLEMENTATION.md) |
| `docs/` | Port documentation | Authored architecture, port mappings, the deviation catalog, ADRs, runbooks, and agent guidance |
| `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `playwright.config.ts`, lint and format configuration | Application | The single root SvelteKit package and its tooling; see [application engineering](app.md) |
| `src/` | Application | The engine, browser adapters, editor, Help, Venus desktop, routes, and service worker; see the [library guide](../../src/lib/README.md) |
| `.devcontainer/`, `cleanup.sh`, `.github/` | Development operations | See [operations](operations.md) |
| `AGENTS.md`, `.agents/`, `.claude/`, `.codex/`, `.mcp.json` | Agent harness | See [harness](harness.md) |
| `tests/` | Validation | Cross-module Vitest suites, Playwright browser scenarios, and the [oracle fixtures](../../tests/oracle/README.md) with their dependency-free regeneration/check runners; see the [tests guide](../../tests/README.md) |
| `static/` | Browser assets | SVG icons, the original MARS favicon, the license, the web app manifest, `llms.txt`/`robots.txt`, bundled assembly references, and attribution |
| `build/`, `.svelte-kit/`, `node_modules/` | Generated | Ignored build output, SvelteKit sync output, and installed dependencies |
| `__refs/`, `__logs/`, `__build/` | Local only | Ignored. Never make an active file depend on them |

`__refs/` holds research material such as reference repositories. Nothing under it is part of the project contract, CI inputs, or the shipped app. Adding a new top-level directory is a layout decision: follow the [port plan](../adrs/0000-port-plan.md#5-proposed-layout) or record an ADR.
