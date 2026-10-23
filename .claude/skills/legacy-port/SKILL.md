---
name: legacy-port
description: Port one unit of the legacy Java MARS (a class, instruction group, directive, syscall, or dump format) to framework-free TypeScript, with behavior pinned by golden fixtures from the headless oracle. Use for any engine porting task.
---

Read the [legacy reference and oracle guide](../../../docs/agents/legacy.md) and the [engine boundary](../../../docs/agents/app.md#engine-boundary) for this specialty. Use the [root task directory](../../../AGENTS.md) to select additional guidance only when the assignment crosses that boundary; do not preload all agent guides or skill references.

# Porting a legacy unit

Work one unit at a time and finish each with evidence. A unit is small enough that its fixtures can be reviewed in one sitting: one hardware class, one instruction family, one directive, one syscall group.

## 1. Read the legacy unit and its collaborators

- Find the Java source with the "where behavior lives" table in the legacy guide. Read the whole class, then the callers that define how it is used (`rg -n 'ClassName' mars`).
- List every observable effect: return values, register and memory writes, exceptions and their messages, printed output, and changes to settings or global state.
- Note each Java construct with a known TypeScript trap (32-bit wrap, `long`, float bits, float printing, `java.util.Random`, statics, `Observable`, threads) from the semantics rules.
- Never edit the Java source, even to add a debug print. Probe through programs instead.

## 2. Pin current behavior with the oracle

- Write probe programs that exercise normal cases, boundaries (`0`, `-1`, `0x7fffffff`, `0x80000000`, unaligned addresses, segment edges), and error paths.
- Run them with `run-legacy` (`nc`, plus `ic`, register, memory-range, `se<n>`/`ae<n>`, and other options as needed) and keep the exact command, stdin, stdout, stderr, and exit status.
- Keep nondeterministic syscalls out of exact-match fixtures, or seed them.
- Promote probes into the committed golden-fixture corpus only through the fixture regeneration script once P1 has created it. Never hand-edit an expected output.

## 3. Port

- Place the code by responsibility ([module organization](../module-organization/SKILL.md)), not by Java package name alone. Head each module with the MARS copyright notice and the legacy file(s) it ports.
- Keep state per-instance, I/O behind host interfaces, and notifications as subscriptions with unsubscribe.
- Translate existing Java algorithms and class responsibilities directly, retaining corresponding TypeScript class names, public behavior, and method names where practical. Adapt only what the language and browser require, including `Observable` plumbing and session ownership; document those mappings instead of inventing replacement logic ([ADR 0002](../../../docs/adrs/0002-port-fidelity.md)).
- Document every export with JSDoc, including ownership and teardown.

## 4. Prove parity

- Add focused Vitest unit tests for edge cases the fixtures do not reach.
- Run the fixtures through the engine's parity runner and Vitest. Investigate each difference: fix port defects within the assigned scope, or document an authorized deliberate divergence with its ADR and regression. Do not treat an unexplained mismatch as an approved enhancement.
- Follow the [deviation maintenance contract](../../../docs/agents/documentation.md#deviation-catalog-maintenance): update the relevant Engine behavior or browser/platform entry in the [catalog](../../../docs/deviations.md), reconcile affected ADRs with `src/`, and distinguish unimplemented features from implemented differences. If documentation is outside the delegated ownership, report the exact update needed. Oracle-conforming refactors need no deviation entry.
- Run `run-checks app`, and `run-checks legacy` when fixtures changed.

## 5. Report

State the legacy files ported, the new modules, the fixtures added, the commands run with their results, any behavior left untested against the oracle, and any suspected legacy defect with its file and line.
