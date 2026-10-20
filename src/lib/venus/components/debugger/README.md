# Debugger and console views

This group presents assembled statements, data memory, symbols, register banks, execution location, and message/console output. The [simulation owner](../../state/README.md) and framework-free [RunController](../../RunController.ts) retain execution state and scheduling. Components consume public hardware APIs and controller snapshots; edits report through owner callbacks and existing hardware contracts.

The Labels view preserves the engine's symbol-table ownership: the global table appears under `(global)`, followed by program-local tables headed by their source basenames. These full-width group headings are centered. Filtering and sorting operate within each group, and source filenames come from assembled programs. Rendering does not merge or mutate the underlying tables.

Register and execution views release their subscriptions with their component lifetime. Numeric cell formatting is shared through [presentation utilities](../../utils/README.md). The console view renders inline input and reports submission or Stop; simulation state retains the pending syscall resolver, echo rules, and cancellation. Generic tabbed geometry comes from [layout](../layout/README.md), and descriptions use [feedback](../feedback/README.md).

These views compose legacy ExecutePane, TextSegmentWindow, DataSegmentWindow, LabelsWindow, RegistersPane and its register windows, and MessagesPane responsibilities. The [Venus guide](../../README.md) documents supported debugging and browser adaptations. Add machine-inspection or execution-output presentation here; keep engine algorithms and simulation lifetime outside components.
