# Desktop shell controls

This group renders application-wide commands and appearance controls: menus, toolbar groups, run speed, theme selection, and repository navigation. Menus and the toolbar consume the shared [command context](../../context/README.md), while reusable dropdowns, buttons, groups, and glyphs accept records, callbacks, or snippets. They do not save sources, assemble programs, or own simulator execution.

Command metadata and shortcut hints come from [presentation utilities](../../utils/README.md); menu and toolbar availability stays synchronized through the same live capability. Native menu dismissal belongs to the menu bar. Run speed is bound to the desktop's preference owner. Theme selection owns its independent browser preference, and the GitHub link opens a separate tab. Shared hover descriptions and keycaps come from [feedback](../feedback/README.md).

This composes the menu, toolbar, action, and run-speed presentation formerly coordinated by legacy VenusUI and RunSpeedPanel, with browser appearance and repository controls. The [Venus guide](../../README.md) records the adaptations. Add shell-wide command presentation here; put workflow-specific content in its feature group and execution rules in state or the framework-free controller.
