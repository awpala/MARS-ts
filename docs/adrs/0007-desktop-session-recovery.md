# ADR 0007: Desktop session recovery

- **Status**: Accepted
- **Date**: 2026-10-21

## Context

Incidental reloads must preserve the working IDE, including the distinction between the selected Edit source and the program loaded into Execute. Source recovery and display preferences already survive reloads, but they do not describe a machine or its console output. Saving arbitrary live hardware would capture partially completed instructions or suspended syscalls and could replay output or change program behavior after restoration.

## Decision

Keep the existing committed-source library, working-buffer recovery, engine preferences, and display/layout preferences. Add a versioned browser-local desktop recovery record under `mars-ts:desktop-session:v1`. The per-desktop persistence owner coordinates existing state owners; it creates no machine, editor, or execution loop.

Recover the selected Edit/Execute view, register and message tabs, current source caret/viewport, editor undo/redo branches matched to exact source identities and contents, Data Segment range/page, the loaded program’s selected label, breakpoints and suspension, both console buffers, the tabbed Help browser's visibility and tab/article selection, and the loaded program's last stable machine checkpoint. Save presentation changes after reactive state updates. Restore after source recovery and machine creation, before enabling recovery writes or revealing the desktop.

Capture hardware only when the controller and simulator are idle: successful assembly, reset, completed step, pause, breakpoint, termination, runtime error, or an idle manual machine edit published through a controller revision. Keep the preceding checkpoint while execution is running or input is pending. Console buffers stay paired with that stable state; partial output after the last checkpoint is not restored during an interrupted run. No pending input request, JavaScript promise, timer, active execution, or confirmation dialog is persisted or automatically resumed. The tabbed Help browser is the one recovered dialog: it is read-only reference with no pending operation, so reopening it after reload only restores presentation. It appears once the desktop is revealed; single Help-menu articles and About are not recovered. Older records without Help state remain valid and leave Help closed.

A checkpoint contains the exact source dependencies read by assembly, engine settings, memory-layout identity, allocated raw memory blocks, live instruction words, integer/exception/floating registers, raw floating condition bits, heap position and byte order, PC, delayed-branch state, pending device interrupt, controller status, random-stream internal seeds, and bounded Backstep history with explicit statement identity groups. Restoration first assembles the captured sources to recover source metadata, symbols, and Reset inputs, then silently replaces hardware and history. It never replays simulation, input, or console effects. The label selection is stored within the saved execution record using its owning source filename (null for global symbols), case-sensitive name, and signed address. Older records without selection restore as unselected. Selection is restored only when that symbol and address exist in the reconstructed loaded program; a missing symbol clears selection without discarding usable execution. Switching Edit sources does not change loaded-program selection, and a new assembly or executable invalidation clears it. Edit selection and buffers are not changed to reconstruct the loaded program. Source edits and failed assembly invalidate the saved executable checkpoint; assembly errors and their console diagnostics remain recoverable.

Keep these portable capture/restore APIs framework-free and per-instance. They are browser recovery extensions, not translations of an additional legacy feature or changes to MIPS execution algorithms. Existing oracle comparisons continue to establish legacy behavior; round-trip and browser tests establish the added recovery contract.

Validate serialized records and bounded hardware structures before applying them. Malformed or unavailable recovery storage falls back to normal source/preferences restoration. A failed checkpoint reconstruction clears executable state and retains console diagnostics with an added recovery error. Writes replace the complete recovery record atomically. Quota/access failures keep the previous successfully saved record and current in-memory state, and show a recoverability error; they never mark source buffers saved or overwrite committed sources.

## Consequences

Recovery survives page/tab reload and browser restart on the same origin while browser storage is retained. Different origins, devices, and browser profiles do not share the record. Concurrent tabs use the most recently completed storage write; this is recovery, not synchronization. Large allocated memory or edit histories can exceed browser storage quotas, so persistence failure remains visible. Explicitly clearing browser storage removes recovery.

Machine and console recovery no longer depend on reexecuting a program. A restored terminated machine remains terminated, paused execution can continue, Reset uses the captured original assembly, and Backstep retains its bounded machine history. Undoing machine state still does not retract console effects. Source undo/redo is recovered separately from hardware history. Transient menus, confirmation dialogs, single Help articles, hover descriptions, and pending external operations start closed; an open Help browser reopens on its recovered tab.

[ADR 0014](0014-random-and-dialog-syscalls.md) extends stable checkpoints with exact JSON-safe 48-bit random seeds. Restoration continues each stream without drawing host entropy; checkpoints predating this field restore an empty map. Pending dialogs, like console input, retain the prior stable checkpoint rather than serializing a resolver or draft.
