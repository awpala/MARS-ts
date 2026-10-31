# Shell and control browser scenarios

This group owns shared desktop controls and presentation: menus and toolbar actions, keyboard and selection feedback, run-speed controls, theme switching, and enabled/disabled styling. Scenarios identify controls through accessible semantics or dedicated hooks and inspect the intended interaction, state, or visual feedback.

Run-speed coverage treats exhaustive stepping, maximum-endpoint theme/layout, and preference persistence/recovery as independent contracts. Keep them in focused cases under the existing scenario deadline so each failure identifies the affected behavior.

Use the shared [browser harness](../harness/README.md) and the [suite's locator contract](../README.md#locator-contracts). Add scenarios here for behavior shared across desktop features; keep source-library policy under [workspace](../workspace/README.md), execution results under [execution](../execution/README.md), and setting-application policy under [settings](../settings/README.md).
