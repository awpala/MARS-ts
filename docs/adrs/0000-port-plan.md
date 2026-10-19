# ADR 0000: Port Plan — MARS (Java/Swing) to SvelteKit

- **Status**: Proposed. Milestone P0 (development environment and agent harness) is complete; no port code exists.
- **Date**: 2026-10-19

This plan is the authority for the port's scope, stack, layout, milestones, and open decisions. It settles what the human has decided and names what is still open. Later ADRs record each open decision as it is made; when they disagree with this plan, update this plan in the same change.

## 1. Outcome and scope

MARS 4.5 is a Java/Swing desktop IDE for MIPS assembly programming, written by Pete Sanderson and Kenneth Vollmar and used in Computer Organization courses. MARS-ts delivers the same assembler and simulator as a web application that runs in a browser without a Java installation.

| Settled input | Decision |
| --- | --- |
| Target | SvelteKit web application, TypeScript |
| Local dev/preview port | `6277` (phoneword "MARS") in Vite, the devcontainer, and the helpers |
| Reference behavior | The original Java sources in this repository, built and run headlessly as an oracle |
| Java toolchain | Provisional: present in the dev container only until the Java sources are offboarded (P5) |
| Development | One devcontainer ([ADR 0001](0001-local-development-environment.md)) |

**In scope for the port as a whole:** the assembler (including pseudo-instructions, macros, directives, and `.include`), the simulator (step, run, backstep, breakpoints, delayed branching, exceptions, memory configurations), the syscalls, the editor and execution views of the Venus UI, settings, and help content. **Not decided:** which of the 20 bundled MARS tools (`mars/tools/`) are ported, and in what order; see [§8](#8-open-decisions).

**Out of scope:** changing MIPS semantics, extending the instruction set beyond MARS 4.5, and the legacy Java packaging (`CreateMarsJar.bat`, the Swing UI's look and feel).

## 2. Planned stack

The planned baseline matches a current SvelteKit portfolio stack: SvelteKit with Svelte 5 runes, TypeScript in strict mode, Tailwind CSS 4, Vitest, ESLint, Prettier, Node 24, and static output (`@sveltejs/adapter-static`), because a simulator needs no server. Exact majors are fixed by the manifest that the P1 scaffold creates and are recorded in [tooling](../agents/tooling.md) at that point; until then, no document in this repository claims a SvelteKit or Vite major.

## 3. Legacy architecture and target mapping

The legacy tree is 217 Java files (about 60,000 lines) in these packages. The target column is the proposed home, not an implemented module.

| Legacy package | Responsibility | Proposed target |
| --- | --- | --- |
| `mars` (root) | Globals, settings, program model (`MIPSprogram`, `ProgramStatement`), errors, CLI launcher | Engine root: program model, errors, settings model; CLI parity runner |
| `mars.assembler` | Tokenizer, directives, macros, symbol tables, two-pass assembler | Engine: assembler |
| `mars.mips.instructions` | Basic and extended (pseudo) instructions, `InstructionSet`, `PseudoOps.txt` loader | Engine: instruction set, with `PseudoOps.txt` kept as data |
| `mars.mips.instructions.syscalls` | 40+ syscalls, including dialogs, MIDI, and file I/O | Engine: syscall contracts; I/O through injected host interfaces |
| `mars.mips.hardware` | Memory, register file, Coprocessors 0 and 1, access notices | Engine: hardware, with per-instance state and subscriptions |
| `mars.simulator` | Simulator thread, backstepper, delayed branch, exceptions | Engine: simulator, with a browser-safe execution model |
| `mars.mips.dump` | Memory dump formats | Engine: dump formats |
| `mars.util` | Binary conversions, `SystemIO`, properties, file finding | Engine: numeric/encoding helpers; host I/O interface |
| `mars.venus` (+ `editors/`) | Swing IDE: editor, execute pane, register/memory/label windows, actions, settings | Svelte routes and components |
| `mars.tools` | Pluggable tools (bitmap display, MMIO keyboard/display, cache simulator, ...) | Svelte components over engine subscriptions, per the open decision |

The structural rule follows from this table: **the engine is framework-free TypeScript.** It imports nothing from Svelte, SvelteKit, or the DOM, and reaches I/O (console, input, files, dialogs, audio, time) only through interfaces the host passes in. That keeps it testable in Vitest under Node, runnable as a headless CLI for oracle comparison, and movable to a Web Worker without a rewrite.

## 4. Parity strategy

Port correctness is measured against the legacy app, not against reading of its source.

1. **Oracle.** `build-legacy` compiles the unmodified Java sources; `run-legacy` runs MARS in its command-line mode (`nc`, register/memory display, `ic`, `dump`, `se<n>`/`ae<n>` exit codes) with isolated preferences. See [the legacy guide](../agents/legacy.md).
2. **Golden fixtures (P1).** A committed corpus of MIPS programs with stdin, MARS options, and the oracle's stdout, stderr, and exit status. A regeneration script runs the oracle; the fixtures are the durable artifact, so tests keep working after the JDK is removed.
3. **Parity runner (P2).** A Node entry point exposes the engine with the same option vocabulary as `MarsLaunch`, so a fixture runs identically through both. Vitest compares the engine to the committed goldens.
4. **Nondeterminism is declared, not tolerated silently.** Fixtures avoid or mask the time syscall (30), unseeded random syscalls, `sleep`, MIDI, and dialogs. Seeded random syscalls must match, which requires porting the `java.util.Random` algorithm exactly.
5. **Deliberate divergence** from MARS (a bug fix, a browser limitation) needs an ADR naming the fixture that records the new behavior.

## 5. Proposed layout

The SvelteKit app is planned at the repository root (`package.json`, `src/`, `vite.config.ts`), beside the legacy sources until P5. Whether the legacy tree moves under a `legacy/` directory first is open ([§8](#8-open-decisions)). If it moves, `build-legacy.sh`, the `$legacy` export, and the [legacy guide](../agents/legacy.md) change in the same commit.

## 6. Milestones

| Milestone | Delivers | Exit evidence |
| --- | --- | --- |
| **P0 — Environment and harness** (complete) | Devcontainer with Node, the TypeScript CLI, the `sv` CLI, and a provisional JDK; legacy oracle helpers; gates and CI; agent harness | `run-checks` harness, docs, and legacy tiers pass; app tier reported skipped |
| **P1 — Scaffold and fixtures** | `sv create` app at the root with the planned stack, Vite on `6277`, pinned local Svelte MCP, golden-fixture format and regeneration script, a first fixture corpus | Full `run-checks` passes, including the app tier; fixtures regenerate byte-identically |
| **P2 — Engine core** | Numeric helpers, hardware, basic instructions, assembler, pseudo-instructions, simulator (run/step/backstep), deterministic console syscalls, parity runner | The fixture corpus passes against the engine |
| **P3 — Web IDE** | Editor with MIPS highlighting, assemble/run/step/backstep/breakpoints, register, coprocessor, memory, and label views, messages and run I/O, settings | Browser exercise of the core workflows; engine parity unchanged |
| **P4 — Remaining syscalls and tools** | Dialog, file (virtual file system), and MIDI syscalls, dump formats, the selected tools, help content | Per-feature fixtures or documented manual checks |
| **P5 — Offboarding Java** | Remove the Java sources, Javadoc `docs/` HTML, legacy resources not used as data, the Java feature, `build-legacy`/`run-legacy`, the legacy gate, and the Java editor extension | Gates pass without a JDK; fixtures remain; attribution retained |

## 7. Porting hazards

These Java behaviors differ from TypeScript defaults and are the expected sources of parity defects. The [legacy guide](../agents/legacy.md#java-to-typescript-semantics) carries the working rules.

- 32-bit `int` overflow and shifts, `long` arithmetic for `mult`/`div` and HI/LO, and unsigned comparisons.
- Float and double register bit patterns (`Float.intBitsToFloat` and related), NaN payloads, and Java's float-to-string formatting for print syscalls.
- `java.util.Random` sequences for seeded random syscalls.
- Process-wide static state (`Globals`, the static register file and memory) that must become per-instance state.
- `java.util.Observable` notices for memory and register access, which become explicit subscriptions with teardown.
- The simulator's background thread and blocking read syscalls, which must not block the browser's main thread.

## 8. Open decisions

Each becomes an ADR when it is decided.

- Whether to move the legacy sources under `legacy/` before P1.
- Execution model: Web Worker or chunked execution on the main thread, and how blocking input syscalls are surfaced.
- Editor component for P3.
- Which bundled tools are ported, and in what order.
- Deployment target and public origin, if the app is published.

## 9. Consequences

The repository carries two stacks until P5, and the dev container includes a JDK that the shipped product never uses. That cost buys a reproducible oracle. The [offboarding milestone](#6-milestones) is the single place that removes it, so the Java tooling is never left as dormant configuration.
