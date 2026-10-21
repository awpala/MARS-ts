# Shared interaction feedback

This group owns reusable loading status, hover descriptions, and keyboard-shortcut presentation. Callers supply labels and trigger content. These components do not require desktop context, dispatch commands, or own application preferences.

The loading spinner supplies an accessible status while its parent owns loading state and placement. Tooltips own trigger listeners, delayed opening on hover, immediate dismissal on pointer exit, keyboard-visible focus, viewport placement, dismissal, and cleanup; pointer activation does not retain a description after leaving the control. A transparent bridge across the visual gap keeps descriptions reachable by pointer without retaining stale tooltips over adjacent controls. Keyboard hints render the caller's shortcut string as theme-aware keycaps while preserving an accessible text alternative.

These browser presentation primitives support the menus, toolbar, debugger, dialogs, and transfer controls described in the [Venus guide](../../README.md). They replace browser-native title hints without moving command policy into feedback. Add reusable status or descriptive interaction here; feature-specific messages and decisions stay with their view or state owner.
