# ADR 0011: Breakpoint changes during Go

- **Status**: Accepted
- **Date**: 2026-10-23

## Context

Legacy MARS hands the simulator a sorted breakpoint array only when Go starts ([RunGoAction.java](../../_legacy-app/mars/venus/RunGoAction.java) calls `TextSegmentWindow.getSortedBreakPointsArray()`), and `SimThread` keeps that array for the whole run. Its Run menu disables Toggle Breakpoints while running ([VenusUI.java](../../_legacy-app/mars/venus/VenusUI.java) `setMenuStateRunning`). A breakpoint checkbox clicked during unlimited or timed execution changes the table but not the running simulation. The original author describes "instant" recognition of breakpoint changes during a run as desirable but deferred it from release 3.8 because of thread synchronization ([TextSegmentWindow.java](../../_legacy-app/mars/venus/TextSegmentWindow.java), `CheckBoxTableCellRenderer`). MARS-ts previously went further and disabled the breakpoint checkboxes and both breakpoint toolbar actions during execution.

The requested change lets users set, clear, suspend, and restore breakpoints while a program runs, for example to stop a long or infinite loop at a chosen instruction without pausing first. The browser's cooperative scheduler ([ADR 0004](0004-cooperative-simulation.md)) runs the simulator and UI on one thread, so the synchronization concern behind the legacy deferral does not arise: the UI can change breakpoints only while the simulator is suspended at a yield or awaiting input.

## Decision

`Simulator.updateBreakpoints` replaces the active execution's breakpoint list with a sorted copy, or with no breakpoints when the list is empty, and does nothing when no execution is active. The loop's existing breakpoint check reads the current list, so a change takes effect at the next instruction boundary: the stop/pause check, then the breakpoint check against the new PC, then the instruction limit, in the canonical order. Normalization at run start uses the same helper, so the initial list and later replacements follow `SimThread.construct`'s sorting and empty-list rules.

`RunController.updateBreakpoints` forwards a change only while a Go it started still owns the simulator. A pending Step ignores the change, so it still completes with its step-limit result rather than reporting a breakpoint, and the next Go reads the current list as before. `SimulationState` sends the active list (the configured addresses, or none when suspended) after every checkbox change, Toggle all breakpoints, and Clear all breakpoints. The Text Segment checkboxes stay enabled during execution, and Toggle all breakpoints and Clear all breakpoints are enabled whenever breakpoints exist, including during execution; their keyboard shortcuts share that availability. Assembly still clears breakpoints and restores them to enabled, and desktop recovery saves them as before.

At unlimited speed, a change applies after the current batch of at most 1,000 instructions, because the UI handles the click only at the next yield; at limited speeds it applies before the next timed instruction, and during pending input before the instruction after the syscall.

## Consequences

Breakpoints selected before Go, every pause and termination reason, and Step behave as before; only a change made while Go is running behaves differently from MARS. A breakpoint added during unlimited execution can be passed over by up to one batch of instructions before it applies, which still matches the user's view because the display does not update during that batch. No oracle parity is claimed for in-flight changes. Simulator and controller unit tests and a browser workflow pin the behavior; the existing oracle fixtures continue to cover breakpoints supplied at the start of a run.
