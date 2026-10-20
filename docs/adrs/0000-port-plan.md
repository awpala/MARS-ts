# ADR 0000: Port Plan — MARS (Java/Swing) to SvelteKit

- **Status**: Accepted for implementation. Milestones P0, P1, and P2 are complete; web IDE parity implementation continues through P3.
- **Date**: 2026-10-19

This plan is the authority for the port's scope, stack, layout, milestones, and open decisions. It settles what the human has decided and names what is still open. Later ADRs record each open decision as it is made; when they disagree with this plan, update this plan in the same change.

## 1. Outcome and scope

MARS is a Java/Swing desktop IDE for MIPS assembly programming, written by Pete Sanderson and Kenneth Vollmar and used in Computer Organization courses. The checked-in Java implementation is canonical regardless of legacy version labels. MARS-ts targets version 1.0 of the TypeScript port, delivering the same assembler and simulator as a web application that runs in a browser without a Java installation.

| Settled input | Decision |
| --- | --- |
| Target | SvelteKit web application, TypeScript |
| Target release | MARS-ts 1.0, independent of the Java version |
| Local dev/preview port | `6277` (phoneword "MARS") in Vite, the devcontainer, and the helpers |
| Reference behavior | The original Java sources in this repository, built and run headlessly as an oracle |
| Java toolchain | Provisional: present in the dev container only until the Java sources are offboarded (P5) |
| Development | One devcontainer ([ADR 0001](0001-local-development-environment.md)) |
| Port fidelity | Translate existing algorithms and corresponding classes; initial desktop layout, SVG UI assets, local source library, browser import/export, and same-tab modals ([ADR 0002](0002-port-fidelity.md)) |
| Launch view | Open directly into the main GUI; no splash screen |

**In scope for the full port:** the assembler (including pseudo-instructions, macros, directives, and `.include`), the simulator (step, run, backstep, breakpoints, delayed branching, exceptions, memory configurations), the syscalls, the editor and execution views of the Venus UI, settings, help content, and the bundled MARS tools (`mars/tools/`). The tools' implementation order remains open; the requested full port does not authorize dropping existing functionality.

**Out of scope:** porting `MarsLaunch` or exposing a TypeScript command-line interface, command-line integration and program-argument controls in the web GUI, changing MIPS semantics, extending the instruction set beyond the legacy reference, and reproducing legacy Java packaging (`CreateMarsJar.bat`). The Java command line remains test infrastructure only. The initial web UI uses the Swing desktop layout and appearance as its reference, with the browser adaptations in [ADR 0002](0002-port-fidelity.md).

## 2. Planned stack

The planned baseline matches a current SvelteKit portfolio stack: SvelteKit with Svelte 5 runes, TypeScript in strict mode, Tailwind CSS 4, Vitest, ESLint, Prettier, Node 24, and static output (`@sveltejs/adapter-static`), because a simulator needs no server. The installed P1 scaffold uses SvelteKit 3, Svelte 5, Vite 8, TypeScript 6, Tailwind 4, Vitest 4, ESLint 10, and Prettier 3; exact versions belong to the root manifest and lockfile. Playwright is development-only browser validation tooling; it adds no application runtime.

## 3. Legacy architecture and target mapping

The legacy tree is 217 Java files (about 60,000 lines) in these packages. The target column is the proposed home, not an implemented module.

| Legacy package | Responsibility | Proposed target |
| --- | --- | --- |
| `mars` (root) | Globals, settings, program model (`MIPSprogram`, `ProgramStatement`), errors, CLI launcher | Engine root: program model, errors, settings model; launcher excluded |
| `mars.assembler` | Tokenizer, directives, macros, symbol tables, two-pass assembler | Engine: assembler |
| `mars.mips.instructions` | Basic and extended (pseudo) instructions, `InstructionSet`, `PseudoOps.txt` loader | Engine: instruction set, with `PseudoOps.txt` kept as data |
| `mars.mips.instructions.syscalls` | 40+ syscalls, including dialogs, MIDI, and file I/O | Engine: syscall contracts; I/O through injected host interfaces |
| `mars.mips.hardware` | Memory, register file, Coprocessors 0 and 1, access notices | Engine: hardware, with per-instance state and subscriptions |
| `mars.simulator` | Simulator thread, backstepper, delayed branch, exceptions | Engine: simulator, with a browser-safe execution model |
| `mars.mips.dump` | Memory dump formats | Engine: dump formats |
| `mars.util` | Binary conversions, `SystemIO`, properties, file finding | Engine: numeric/encoding helpers; host I/O interface |
| `mars.venus` (+ `editors/`) | Swing IDE: editor, execute pane, register/memory/label windows, actions, settings | Svelte routes and components |
| `mars.tools` | Pluggable tools (bitmap display, MMIO keyboard/display, cache simulator, ...) | Svelte components over engine subscriptions, per the open decision |

The structural rule follows from this table: **the engine is framework-free TypeScript.** It imports nothing from Svelte, SvelteKit, or the DOM, and reaches I/O (console, input, files, dialogs, audio, time) only through interfaces the host passes in. That keeps it testable directly through its API in Vitest under Node and movable to a Web Worker without a rewrite.

## 4. Parity strategy

Port correctness is measured against the legacy app, not against reading of its source.

1. **Oracle.** `build-legacy` compiles the unmodified Java sources; `run-legacy` runs MARS in its command-line mode (`nc`, register/memory display, `ic`, `dump`, `se<n>`/`ae<n>` exit codes) with isolated preferences. See [the legacy guide](../agents/legacy.md).
2. **Golden fixtures (P1).** A committed corpus of MIPS programs with stdin, MARS options, and the oracle's stdout, stderr, and exit status. A regeneration script runs the oracle; the fixtures are the durable artifact, so tests keep working after the JDK is removed.
3. **Parity runner (P2).** Vitest calls engine APIs directly with explicit fixture settings and injected I/O, then compares results to the committed goldens. Test adapters interpret fixture metadata; they do not port the `MarsLaunch` parser or ship a CLI in the web application. CLI-only cases remain reference captures and are excluded explicitly from the web parity gate.
4. **Nondeterminism is declared, not tolerated silently.** Fixtures avoid or mask the time syscall (30), unseeded random syscalls, `sleep`, MIDI, and dialogs. Seeded random syscalls must match, which requires porting the `java.util.Random` algorithm exactly.
5. **Deliberate divergence** from MARS (a bug fix, a browser limitation) needs an ADR naming the fixture that records the new behavior.

## 5. Proposed layout

The SvelteKit package and configuration are at the repository root (`package.json`, `vite.config.ts`), with all application implementation under `src/` (`/workspace/src` in the devcontainer): engine classes in `src/lib/engine/`, GUI and browser adapters in `src/lib/`, and routes in `src/routes/`. Root scripts and TypeScript/SvelteKit configuration resolve that source tree, including the `$lib` alias. The legacy Java sources and runtime resources stay at their current root paths until P5; generated Javadoc and its supporting files live separately under [docs-legacy/](../../docs-legacy/README.md), leaving `docs/` for authored port documentation. [ADR 0002](0002-port-fidelity.md) also assigns browser assets to `static/` and oracle fixtures and their runner to `tests/oracle/`.

## 6. Milestones

| Milestone | Delivers | Exit evidence |
| --- | --- | --- |
| **P0 — Environment and harness** (complete) | Devcontainer with Node, the TypeScript CLI, the `sv` CLI, and a provisional JDK; legacy oracle helpers; gates and CI; agent harness | `run-checks` harness, docs, and legacy tiers pass; app tier reported skipped |
| **P1 — Scaffold and fixtures** (complete) | `sv create` app at the root with the planned stack, Vite on `6277`, pinned local Svelte MCP, golden-fixture format and regeneration script, a first fixture corpus | All four `run-checks` tiers pass; fixtures regenerate byte-identically; initial browser workflows pass on isolated port `6278` |
| **P2 — Engine core** (complete) | Numeric helpers, hardware, basic instructions, assembler, pseudo-instructions, simulator (run/step/backstep), deterministic console syscalls, parity runner | All 19 in-scope core corpus cases pass through production engine APIs, alongside unit oracle probes; CLI arguments are excluded and seeded random remains in P4 |
| **P3 — Web IDE** | Editor with MIPS highlighting, assemble/run/step/backstep/breakpoints, register, coprocessor, memory, and label views, messages and run I/O, settings | Browser exercise of the core workflows; engine parity unchanged |
| **P4 — Remaining syscalls and tools** | Dialog, file (virtual file system), and MIDI syscalls, dump formats, bundled tools, help content | Per-feature fixtures or documented manual checks |
| **P5 — Offboarding Java** | Remove the Java sources, legacy Javadoc archive `docs-legacy/`, legacy resources not used as data, the Java feature, `build-legacy`/`run-legacy`, the legacy gate, and the Java editor extension | Gates pass without a JDK; fixtures remain; attribution retained |

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

- Execution model resolved in [ADR 0004](0004-cooperative-simulation.md): cooperative execution through an injected scheduler and asynchronous input services.
- Editor component for P3.
- Implementation order of the bundled tools.
- Deployment target and public origin resolved in [ADR 0005](0005-coolify-deployment.md): static hosting on Coolify at `https://mars-ide.portfolio-projects.dev` through the corresponding GitHub App.

## 9. Consequences

The repository carries two stacks until P5, and the dev container includes a JDK that the shipped product never uses. That cost buys a reproducible oracle. The [offboarding milestone](#6-milestones) is the single place that removes it, so the Java tooling is never left as dormant configuration.
