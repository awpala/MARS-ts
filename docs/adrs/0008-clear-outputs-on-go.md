# ADR 0008: Optional output clearing on Go

- **Status**: Accepted
- **Date**: 2026-10-21

## Context

The requested “Clear all outputs on Go” setting is a new MARS-ts feature absent from the legacy/JAR Venus UI. Users may want each fresh program run to start with empty console buffers without manually selecting Clear All.

## Decision

Add an unchecked-by-default checkbox immediately after “Initialize Program Counter to global main if defined” in the same Settings subgroup. Store its selection in the per-desktop display preferences and the existing `mars-ts:display-settings:v1` localStorage record as `clearAllOutputsOnGo`. Older records default to false; invalid field types follow the existing preference validation policy. Storage failures retain the in-memory choice. The later browser-specific Prompt to clear all breakpoints setting immediately follows this checkbox in the same subgroup ([UI-0014](../deviations.md#ui-0014-live-breakpoint-controls-at-finite-speeds-locked-at-maximum-speed)).

When selected, clear both Mars Messages and Run I/O immediately before Go starts a fresh program run after assembly or Reset, then append the current Go diagnostics and program output normally. Go resuming after Pause, a breakpoint, Step, or Backstep preserves both outputs, including after backstepping to the first instruction or restoring a started checkpoint. The controller’s existing started flag distinguishes these cases. Step, Assemble, Reset, and Backstep do not trigger this clearing. Changing this browser preference does not invalidate assembly or modify engine settings.

## Consequences

The default preserves existing output accumulation. Enabling it deliberately discards prior output when Go starts a fresh run while leaving machine state and pending-input handling with their existing owners. Browser workflow tests establish this new behavior; no legacy parity is claimed for it.
