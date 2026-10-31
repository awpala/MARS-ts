# ADR 0012: MARS-ts 1.0 behavioral baseline and deviation catalog

- **Status**: Accepted for cataloging and maintenance; the 1.0 release baseline remains open
- **Date**: 2026-10-23

## Context

MARS-ts targets functional and behavioral parity with the final MARS 4.5 Java/Swing application. The implemented port already contains browser adaptations and additional or changed UI behavior. Several have dedicated ADRs, while others exist only in source, tests, or implementation prose. Without one maintained comparison, release 1.0 could silently mix established port behavior, missing features, and later enhancements.

The current [source tree](../../src/) is authoritative for what the port does. Existing ADRs must be reconciled with that implementation rather than used to describe intended behavior as implemented. The unchanged [legacy application](../../_legacy-app/README.md) remains the behavioral reference for comparison; its [oracle provenance](../../tests/oracle/golden/provenance.json) identifies the captured source baseline. This decision does not equate a source-built oracle with an independently authenticated release-JAR binary.

## Decision

### One catalog with UI and Engine subsets

Maintain [docs/deviations.md](../deviations.md) as the public catalog. Use nested headings for UI and Engine, with behavioral/functional deviations and browser/platform adaptations as distinct subgroups within each. Do not add a table of contents. Keep stable entry IDs with four-digit numbering (`UI-0001`, `UI-P0001`, `ENG-0001`, `ENG-P0001`) so subsequent decisions can refer to the same behavior without duplicating the full comparison.

Each entry states the legacy behavior, the current MARS-ts behavior and its user impact, the relevant implementation paths, a corresponding ADR, and the evidence or an explicit evidence gap. Existing feature ADRs retain their rationale and detailed contracts. This ADR records the retrospective comparison for implemented differences that previously lacked a decision entry; it does not invent a prior user request or silently approve a suspected defect as desirable.

### Retrospective records of current behavior

The catalog records additional source-confirmed differences in source-tab operations, save/close and dirty-state rules, independent Edit/Execute selection, Find/Replace boundaries, command access and bulk controls, pane operations, source navigation, memory-page stride, running-state edit restrictions, settings invalidation, speed interaction, console retention/reporting, numeric-edit feedback, Help/hover behavior, and editor undo retention. These are the current UI contracts documented by the catalog, not functionality introduced by this documentation change. Entries governed by this ADR retain their named source comparisons and test limitations until a focused regression or later behavioral decision supersedes them.

At the platform boundary, record same-tab modality and popup cancellation, shortcut/clipboard ownership including the missing legacy menu mnemonics, and replacement of fatal JVM exits in syscall initialization and Backstep restoration with diagnostics and exceptions. The more specific decisions for browser files, cooperative scheduling, recovery, argument initialization, PWA delivery, and live breakpoints remain [ADR 0003](0003-browser-file-workflows.md), [ADR 0004](0004-cooperative-simulation.md), [ADR 0007](0007-desktop-session-recovery.md), [ADR 0009](0009-program-arguments.md), [ADR 0010](0010-pwa-offline-support.md), and [ADR 0011](0011-in-flight-breakpoints.md).

### Exclusions and evidence

Exclude pending implementations, minor styling liberties, and behavior-preserving refactoring or module reorganization. Do not treat per-instance ownership, explicit subscriptions, or changed source-file locations as deviations merely because the Java structure differs. An intentional removal/replacement of an existing user workflow is eligible; an unfinished feature is not. Classify browser-specific behavior separately even when it has user-visible consequences, and distinguish chosen adaptations from unavoidable browser limitations.

Source comparison is sufficient to disclose an observed current difference, but it is not proof of oracle parity. A new behavioral implementation or deliberate divergence still needs the applicable fixture/regression and ADR in the same change. Preserve the distinction between legacy goldens, TypeScript contract tests, browser scenarios, and dated manual checks. Do not relabel an unexplained mismatch as an accepted enhancement to bypass investigation.

### Living port baseline, then frozen release baseline

During porting, update the catalog and affected ADRs whenever an implemented behavior is added, changed, removed, or newly found to differ. Keep [IMPLEMENTATION.md](../../IMPLEMENTATION.md) and module contracts consistent, and link the catalog from the [root README](../../README.md). Documentation-only audits record the actual code and unresolved evidence; they do not authorize unrelated implementation changes.

At the human-owned 1.0 release cut, reconcile the catalog with the exact release source and record the release identifier/revision and validation evidence. Resolve unapproved behavioral choices before freezing; do not silently convert known defects or pending milestones into parity exceptions. This ADR neither cuts that release nor authorizes Git writes. Until then, “1.0 baseline” means the maintained release candidate comparison, not a shipped guarantee.

After the cut, preserve the frozen 1.0-to-4.5 comparison. Subsequent ADRs identify net enhancements and other behavior changes relative to MARS-ts 1.0, link the affected baseline entries, and state any continuing effect on legacy compatibility. Corrections to historical documentation must be labeled as corrections rather than rewriting what the released source did.

## Consequences and validation

The catalog makes non-trivial UI choices and host adaptations reviewable alongside engine parity. Existing source comparisons without focused regressions stay visible instead of borrowing the credibility of unrelated passing tests. It adds no application behavior, dependency, or milestone, and does not make minor restyling or oracle-conforming refactors require deviation entries.

The [documentation contract](../agents/documentation.md#deviation-catalog-maintenance), [shared workflow](../agents/workflow.md), and canonical port/UI/review skills route ongoing work through this catalog. Harness mirrors and role adapters retain their existing ownership rules. Documentation and harness gates validate discoverability, relative links, ADR indexing, and mirrored skills; they cannot by themselves verify the behavioral assertions. Those assertions retain the source and behavioral evidence linked in each catalog entry.

## Subsequent reconciliation

[ADR 0013](0013-exception-handler-workflow.md) restores the legacy assembly filename-list preamble and implements automatic handler selection. The catalog retires that omission while retaining console clearing and retention differences; handler source selection and diagnostics are documented under the existing virtual-working-text adaptation. Later features added entries under their own decisions: identical-rebuild breakpoint retention (UI-0019) under this ADR, memory dump files (UI-P0008) under [ADR 0003](0003-browser-file-workflows.md), handler selection and the bundled reference (UI-0020, UI-0021) under ADR 0013, random-stream ownership (ENG-P0004) and syscall dialogs (within UI-P0003) under [ADR 0014](0014-random-and-dialog-syscalls.md), and MIDI tones (UI-P0009, ENG-P0005) under [ADR 0015](0015-midi-web-audio-tones.md).
