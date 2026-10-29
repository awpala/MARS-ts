# ADR 0009: Program arguments in the web IDE

- **Status**: Accepted
- **Date**: 2026-10-21

## Context

The human now requests the legacy “Program arguments provided to MIPS program” setting, its Text Segment input, and an Args toolbar toggle. This supersedes only the program-argument-control exclusion in [ADR 0002](0002-port-fidelity.md) and the [port plan](0000-port-plan.md). Command-line integration and a TypeScript `MarsLaunch` remain excluded.

## Decision

Port `mars/simulator/ProgramArgumentList.java` into the framework-free simulator boundary. Parse exactly Java StringTokenizer's space, tab, newline, carriage-return, and form-feed delimiters. Quotes and backslashes are literal; there is no shell parsing, executable-name argument, or UTF-8 encoding. Store each UTF-16 code unit's low byte, retaining the legacy truncation behavior. Use the configured stack base and initial stack pointer, including the original lower-word-alignment rule for large arguments and compact layouts. Initialize argc, argv, and `$sp`, `$a0`, `$a1` without adding Backstep entries. Empty or whitespace-only input does nothing.

`RunController` performs this initialization immediately before the first Go or Step after assembly or Reset, only when the setting is enabled. Resume, subsequent steps, Backstep, and recovery of started execution do not apply the draft again. Changing the setting or draft does not invalidate assembly or rewrite a running program's arguments. Reset and a new assembly retain the draft and permit the next initial execution to apply it.

Default the setting to unchecked, as in Java. Place its Settings item immediately after Show Labels Window, and its Args icon immediately after the Labels toggle in the same toolbar group, as explicitly requested. Show the labeled input between the Text Segment heading and its table header. The additional row stays outside the scrolling table and retains the legacy input tooltip. Menu and toolbar share the engine preference. The argument draft belongs to the desktop simulation owner and persists in browser-local desktop recovery independently of applied machine state; older records default to an empty draft.

Java's memory-write failure prints an internal-error diagnostic and exits the process. The browser cannot exit its host. Preserve the diagnostic as a thrown error reported through the existing Mars Messages boundary, without executing an instruction. Partial memory writes are not rolled back, matching the original write sequence. This host-lifecycle adaptation does not silently truncate arguments or alter the configured memory bounds.

## Evidence

The [argument method probes](../../tests/oracle/program-arguments-units/README.md) record exact stack words, string bytes, and registers for empty input, all five delimiters, literal quotes, non-delimiter whitespace, non-ASCII code units, the stack-gap boundary, and both compact layouts. A separate fatal-path capture pins the legacy diagnostic and exit status. [Session comparisons](../../tests/session/program-arguments.test.ts) consume these captures and exercise first-execution, Reset, Backstep, and checkpoint behavior. The original `program-arguments` whole-program fixture is now enabled through production engine/controller APIs; seeded randomness is subsequently enabled by [ADR 0014](0014-random-and-dialog-syscalls.md). [Browser scenarios](../../tests/browser/program-arguments.spec.ts) exercise input placement, shared toggles, persistence, and execution without introducing a CLI.
