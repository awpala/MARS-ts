# Venus presentation utilities

This directory owns rules shared by multiple browser views or by a view and the desktop coordinator. It currently centralizes command metadata used by menus, toolbars, and keyboard shortcuts; the legacy-compatible run-speed conversion used by both its label and machine assignment, plus the distinct-speed UI endpoint; and integer-cell display and Enter-to-commit conventions shared by memory and register tables.

These helpers carry no mutable session state. Command metadata describes presentation, while [context](../context/README.md) connects it to session-owned execution and enablement. Integer display delegates hexadecimal conversion to the engine's `Binary` API and preserves unsigned decimal addresses versus signed register/data values. Floating-point parsing, memory access, register writes, and edit errors remain with their existing engine APIs and view owners.

Add a helper only when callers share the same rule. Browser storage belongs in the [browser adapters](../../browser/README.md), buffers and history in the [editor](../../editor/README.md), and machine algorithms in the [engine](../../engine/README.md). A utility is not an alternate location for a controller, Svelte state singleton, or UI-owned machine model. The [Venus guide](../README.md) retains the legacy mapping and behavior contracts.
