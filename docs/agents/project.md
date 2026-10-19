# Project scope and identity

MARS-ts ports the checked-in canonical Java implementation of MARS, the MIPS Assembler and Runtime Simulator, to a SvelteKit web application in TypeScript. The target release is MARS-ts 1.0, independent of legacy version labels. The [port plan](../adrs/0000-port-plan.md) is authoritative for scope, stack, layout, milestones, and open decisions; this guide holds the values every change must keep consistent.

## Current state

Milestone P0 is complete: the [development container](../adrs/0001-local-development-environment.md), the legacy oracle helpers, the gates, CI, and this harness. P1 preparation adds [oracle fixtures](../../tests/oracle/README.md) and [browser assets](../../static/README.md); **the app and engine are not implemented yet**. There is no `package.json`, `src/`, or `vite.config.ts` yet; app commands report "not scaffolded" and `run-checks` reports the app tier as skipped. The human has authorized the full port through the existing milestones ([ADR 0002](../adrs/0002-port-fidelity.md)) and updated rules to allow scaffolding and npm dependency changes. The previous running session still rejected those commands; a new session must check its effective policy rather than assume the old restriction persists.

## Identity

| Role | Value | Constraint |
| --- | --- | --- |
| Display name | `MARS` | Human-facing title of the application ("MARS — MIPS Assembler and Runtime Simulator") |
| Machine slug | `mars-ts` | npm package name, Docker resource names (`mars-ts-dev-env`, `mars-ts_*` volumes) |
| Target release | `1.0` | TypeScript port release target; does not claim implementation completion |
| Repository | `awpala/MARS-ts` | GitHub owner `awpala` |
| Local dev/preview port | `6277` | Phoneword "MARS"; Vite `server.port` and `preview.port`, devcontainer publish/forward, `kill-app` |
| Production port and origin | Not decided | An [open decision](../adrs/0000-port-plan.md#8-open-decisions) |

Keep display names out of machine identifiers, and update related configuration together when a value changes. The port number appears in `devcontainer.json`, `kill-app.sh`, `setup-env.sh`'s handoff text, these guides, and (from P1) `vite.config.ts`.

## Attribution

MARS is copyright 2003–2013 Pete Sanderson and Kenneth Vollmar, under the MIT license in [MARSlicense.txt](../../MARSlicense.txt). The port is a derivative work: keep that license file, carry the copyright notice in ported source modules and copied data files (for example `PseudoOps.txt`), and credit the original authors in the application's About content.

## Repository layout

| Path | Owner | Notes |
| --- | --- | --- |
| `Mars.java`, `mars/`, root `*.properties`, `*.xml`, `PseudoOps.txt`, `help/`, `images/` | Legacy reference | Read-only; see the [legacy guide](legacy.md) |
| `docs/*.html`, `docs/mars/`, `docs/resources/` | Legacy Javadoc | Read-only, generated, removed at P5 |
| `docs/README.md`, `docs/adrs/`, `docs/agents/` | Port documentation | Authored |
| `.devcontainer/`, `cleanup.sh`, `.github/` | Development operations | See [operations](operations.md) |
| `AGENTS.md`, `.agents/`, `.claude/`, `.codex/`, `.mcp.json` | Agent harness | See [harness](harness.md) |
| `tests/oracle/` | Parity evidence | Inputs, captured Java outputs, and dependency-free regeneration/check runner |
| `static/` | Browser assets | Prepared SVG toolbar icons, original MARS favicon, and attribution |
| `__refs/`, `__logs/`, `__build/` | Local only | Ignored. Never make an active file depend on them |

`__refs/` holds research material such as reference repositories. Nothing under it is part of the project contract, CI inputs, or the shipped app. Adding a new top-level directory is a layout decision: follow the [port plan](../adrs/0000-port-plan.md#5-proposed-layout) or record an ADR.
