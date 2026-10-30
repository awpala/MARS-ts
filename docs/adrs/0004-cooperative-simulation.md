# ADR 0004: Cooperative browser simulation

- **Status**: Accepted
- **Date**: 2026-10-19

## Context

The canonical simulator executes on a SwingWorker and can block for console input while the desktop event loop stays responsive. The framework-free TypeScript engine must preserve instruction ordering, delay slots, exception dispatch, breakpoints, and undo recording while allowing the browser to process pause/stop and input. This resolves the execution-model decision in the [port plan](0000-port-plan.md).

## Decision

Translate Simulator's execution loop directly and run it cooperatively through an injected scheduling host. The engine requests an initial yield, bounded yields during unlimited execution, and the canonical delay between instructions at a limited speed. The browser host supplies timers; tests supply a deterministic scheduler. No timer or DOM API belongs in the engine. A session permits one active simulation and waits for that operation to finish before starting another or replacing its machine state.

SimulationCode returns `void | Promise<void>` so input syscalls can suspend without blocking the browser. Simulator and MIPSprogram simulation entry points return `Promise<boolean>` resolving to the canonical completion result. Synchronous instructions execute without an extra asynchronous boundary; a pending syscall completes before delay-slot, stop, breakpoint, and step-limit checks. SimulatorAction replaces Swing action objects with the original named completion callbacks, preserving the reason and diagnostic data. Stop listeners allow the input adapter to release a pending read. The UI owns listener teardown and awaits completion before reset or disposal.

Retain execution ownership until completion even after a stop request, while honoring only the first stop action as Java does. The input host can inspect a pending stop request before installing a new read, covering a stop during the initial scheduling yield. It returns the current input text just as the canonical console stop listener does; invalid numeric text still produces the original diagnostic. This prevents a pending browser read from surviving a stop or component teardown without changing the instruction/check ordering. [ADR 0015](0015-midi-web-audio-tones.md) extends the same stop-listener release to pending MidiOutSync tone waits.

Keep the canonical state machine and checks in their original order. Scheduling and the asynchronous method return are explicit platform adaptations, not replacements for instruction execution. Java command-line parsing remains excluded; tests invoke the same engine APIs as the browser.

## Validation

Compare normal termination, invalid fetches, exceptions, handler dispatch, delayed branches, breakpoints, and step limits to headless Java oracle captures. Exercise yields, asynchronous input, pause/stop, callbacks, undo, and disposal with deterministic host tests and browser workflows. A responsive UI alone does not establish MIPS behavior parity.
