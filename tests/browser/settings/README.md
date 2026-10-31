# Settings browser scenarios

This group owns the browser's setting-application workflows: persisted choices, live menu/toolbar synchronization, memory-configuration drafts, automatic exception-handler selection, and their interaction with loaded execution. Scenarios exercise real dialogs and preference owners rather than implementing a second settings model.

Exception-handler coverage separates mode/chooser availability, saved-source ordering and canceled drafts, disabled-selection persistence across reloads, and enabled persistence with close-dialog cancellation. Keep these workflows in focused cases under the existing scenario deadline.

Use the shared [browser harness](../harness/README.md) for readiness and controlled source records. Add scenarios here when the contract concerns applying, canceling, restoring, or gating a preference. Shared control mechanics belong under [shell](../shell/README.md), while exact engine setting semantics remain in the [TypeScript and oracle suites](../../README.md). The [suite guide](../README.md) owns run and selector conventions.
