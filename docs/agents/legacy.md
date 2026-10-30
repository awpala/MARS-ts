# Legacy reference and oracle

Read this guide when you need to know what MARS actually does: reading the Java sources, building and running the legacy app, producing expected output for a fixture, or translating Java semantics into TypeScript. The [port plan](../adrs/0000-port-plan.md#4-parity-strategy) owns the overall parity strategy.

## The legacy tree is read-only

The [legacy application](../../_legacy-app/README.md) owns `Mars.java`, `mars/`, the properties and XML resources, `PseudoOps.txt`, `help/`, `images/`, generated `docs/`, `META-INF/`, `CreateMarsJar.bat`, and `mainclass.txt`. Java sources, runtime resources, and generated documentation retain their original contents. The packaging script resolves the shared [MARSlicense.txt](../../MARSlicense.txt) from the repository root. Never edit, reformat, or modernize them, even to silence a warning. When the legacy code has a defect, record it (file, line, behavior, a reproducing program). The port either reproduces it or diverges through an ADR that names the fixture recording the new behavior.

## Building and running the oracle

The dev container provides a provisional JDK ([ADR 0001](../adrs/0001-local-development-environment.md)). Two helpers wrap it:

```sh
build-legacy                       # javac + jar -> __build/legacy/Mars.jar (always from scratch)
run-legacy nc prog.asm             # assemble and run, no copyright banner
run-legacy nc ic se1 ae2 '$t0' '$v0' prog.asm
run-legacy nc a prog.asm           # assemble only
run-legacy nc dump .text HexText text.hex prog.asm
echo 42 | run-legacy nc prog.asm   # stdin feeds read syscalls
run-legacy h                       # MARS's full option reference
```

`run-legacy` runs MARS headlessly with Java Preferences redirected to a fresh temporary directory, so no run's settings leak into another and stderr carries only MARS's own output. Its stdout, stderr, and exit status are MARS's. `__build/legacy/BUILD_INFO` records the Git revision and `javac` version that produced the jar. Do not invoke `java -jar` directly for oracle output; the wrapper's isolation is what makes results comparable.

The checked-in Java implementation is canonical regardless of historical release labels. The TypeScript port targets MARS-ts 1.0; its version is independent of the Java source's version strings.

When a comparison reveals an implemented difference, follow the [deviation maintenance contract](documentation.md#deviation-catalog-maintenance). Name the relevant [UI or Engine catalog entry](../deviations.md), separate host adaptations from machine semantics, and distinguish a source observation from captured oracle evidence. Use the Swing path for GUI comparisons; launcher-only formatting and process behavior are not automatically GUI deviations.

Useful options for fixtures (all from `_legacy-app/mars/MarsLaunch.java`):

| Option | Effect |
| --- | --- |
| `nc` | Suppress the copyright banner (always use for fixtures) |
| `a` | Assemble only |
| `ic` | Print the count of basic instructions executed |
| `<reg>` / `$<reg>` | Print a register at the end of the run (repeatable) |
| `<m>-<n>` | Print a word-aligned memory range at the end of the run |
| `hex` / `dec` / `ascii` | Display base for those values |
| `se<n>` / `ae<n>` | Exit with `<n>` on a simulation or assembly error |
| `db`, `np`, `sm`, `smc`, `we`, `mc <config>` | Delayed branching, no pseudo-instructions, start at `main`, self-modifying code, warnings as errors, memory configuration |
| `<n>` | Maximum number of steps |
| `pa <args...>` | Program arguments (must come last) |

Nondeterministic behavior must stay out of exact-match fixtures: the time syscall (30), random syscalls without a fixed seed (40–44), `sleep` (32), MIDI (31, 33), and interactive dialogs (50–59, which also need a GUI). The [dialog method probe](../../tests/oracle/platform-syscalls/README.md) automates actual Swing responses under Xvfb to capture deterministic dialog outcomes separately, and the MIDI method probe in the same directory records the sequences services 31 and 33 request through a substituted output device, with timing reduced to deterministic orderings and tolerance checks. File syscalls (13–16) touch the real file system and need a scratch directory.

## Where behavior lives

| Question | Start reading |
| --- | --- |
| How a source line is tokenized and assembled | `_legacy-app/mars/assembler/Tokenizer.java`, `Assembler.java`, `Directives.java` |
| What a basic instruction does | `_legacy-app/mars/mips/instructions/InstructionSet.java` (each `BasicInstruction` carries its `SimulationCode`) |
| How a pseudo-instruction expands | `PseudoOps.txt` and `ExtendedInstruction.java` |
| Memory layout and segment bounds | `_legacy-app/mars/mips/hardware/Memory.java`, `MemoryConfigurations.java` |
| Registers and coprocessors | `RegisterFile.java`, `Coprocessor0.java`, `Coprocessor1.java` |
| Run, step, backstep, exceptions | `_legacy-app/mars/simulator/Simulator.java`, `BackStepper.java`, `Exceptions.java` |
| A syscall | `_legacy-app/mars/mips/instructions/syscalls/Syscall<Name>.java`; numbers in `Syscall.properties` |
| Number formatting and conversion | `_legacy-app/mars/util/Binary.java` |
| Console and file I/O | `_legacy-app/mars/util/SystemIO.java` |
| Command-line behavior | `_legacy-app/mars/MarsLaunch.java` |
| A UI behavior | `_legacy-app/mars/venus/` (the Swing IDE) |
| User-facing explanations | `_legacy-app/help/*.html` |

The legacy Javadoc under [_legacy-app/docs/](../../_legacy-app/docs/README.md) is generated from the same sources; read the source when the two disagree.

## Java-to-TypeScript semantics

These rules apply to every engine port. Each is a known source of silent parity defects.

- **32-bit integers.** Java `int` wraps; JavaScript numbers do not. Normalize every arithmetic result with `| 0` (signed) or `>>> 0` (unsigned), use `Math.imul` for 32-bit multiplication, and remember that `>>` and `>>>` take the shift count modulo 32 in both languages.
- **64-bit results.** `mult`, `multu`, `madd`, `div`, and friends use Java `long` for HI/LO. Use `BigInt` or an explicit high/low split; never route 64-bit products through a `number`.
- **Division.** Java integer division truncates toward zero and `%` takes the dividend's sign; `Math.trunc` and the JavaScript `%` match, but division by zero must follow MARS's behavior, not JavaScript's `Infinity`.
- **Floating point.** Coprocessor 1 stores raw bit patterns. Convert with a shared `DataView` or typed arrays, mirroring `Float.intBitsToFloat`, `Float.floatToIntBits`, and the `Double` equivalents, and keep NaN payloads where MARS keeps them. Single-precision arithmetic must round through `Math.fround`.
- **Printing floats.** Print syscalls use Java's `Float.toString` and `Double.toString`, which differ from JavaScript's `Number.prototype.toString` in exponent thresholds and digit selection. Port the formatting algorithm and pin it with fixtures.
- **Strings and characters.** Java `char` is UTF-16 and MARS reads bytes in places; port the byte-level behavior of string syscalls and `.ascii`/`.asciiz`, not a JavaScript string shortcut.
- **Randomness.** `java.util.Random` is a specified 48-bit linear congruential generator. Seeded random syscalls must reproduce its sequence exactly.
- **Global state.** `Globals`, `RegisterFile`, `Memory`, and the coprocessors are process-wide statics in Java. In the port they are per-instance and owned by a simulator session; see [application engineering](app.md#engine-boundary).
- **Observers.** `java.util.Observable` access notices become explicit subscriptions that return an unsubscribe function, and every subscriber releases them.
- **Threads.** The simulator runs on a `SwingWorker` thread and blocking reads wait on it. The port preserves its sequencing through injected cooperative scheduling and asynchronous input ([ADR 0004](../adrs/0004-cooperative-simulation.md)).

## Skills and roles

The [`legacy-port`](../../.agents/skills/legacy-port/SKILL.md) skill carries the step-by-step workflow for porting one legacy unit with oracle evidence. The [`legacy-analyst`](../../.agents/agents/legacy-analyst.md) role investigates legacy behavior without writing port code; the [`core-porter`](../../.agents/agents/core-porter.md) role ports engine units.
