# Project scope and identity

MARS-ts ports the checked-in canonical Java implementation of MARS, the MIPS Assembler and Runtime Simulator, to a SvelteKit web application in TypeScript. The target release is MARS-ts 1.0, independent of legacy version labels. The [port plan](../adrs/0000-port-plan.md) is authoritative for scope, stack, layout, milestones, and open decisions; this guide holds the values every change must keep consistent.

## Current state

Milestones P0, P1, and P2 are complete. The root [package](../../package.json), [Vite configuration](../../vite.config.ts), and [source tree](../../src/) now exist alongside the prepared [oracle fixtures](../../tests/oracle/README.md) and [browser assets](../../static/README.md). All four validation tiers pass, and initial browser workflows are exercised on isolated port 6278. The core assembler, simulator, console/random/dialog syscalls, exception handling, and desktop debugging are implemented. All 21 original whole-program cases, including program arguments and seeded randomness, run against the production engine; CLI integration remains excluded. Module-level Java probes cover assembly, every basic instruction callback, hardware, numeric conversions, console/random syscalls, actual Swing dialogs, execution sequencing, settings, and backstepping. Remaining settings dialogs and platform features are unfinished. The full port remains authorized through the existing milestones, with CLI integration excluded ([ADR 0002](../adrs/0002-port-fidelity.md)).

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
| `docs/` | Port documentation | Authored architecture, port mappings, ADRs, runbooks, and agent guidance |
| `.devcontainer/`, `cleanup.sh`, `.github/` | Development operations | See [operations](operations.md) |
| `AGENTS.md`, `.agents/`, `.claude/`, `.codex/`, `.mcp.json` | Agent harness | See [harness](harness.md) |
| `tests/oracle/` | Parity evidence | Inputs, captured Java outputs, and dependency-free regeneration/check runner |
| `static/` | Browser assets | Prepared SVG toolbar icons, original MARS favicon, and attribution |
| `__refs/`, `__logs/`, `__build/` | Local only | Ignored. Never make an active file depend on them |

`__refs/` holds research material such as reference repositories. Nothing under it is part of the project contract, CI inputs, or the shipped app. Adding a new top-level directory is a layout decision: follow the [port plan](../adrs/0000-port-plan.md#5-proposed-layout) or record an ADR.
