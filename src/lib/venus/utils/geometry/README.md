# Clamping and pane geometry constants

This directory owns inclusive range clamping and the pane geometry constants that only the Venus layout needs. These are browser layout rules without a direct legacy counterpart.

[clamp.ts](clamp.ts) limits a value to an inclusive range and lets the lower bound win when the bounds cross. Pane dividers, the source editor's popup placement, tooltip placement, run-speed steps, and the display preferences' pane sizes share it, as does Data Segment paging, so every caller resolves a crossed range the same way.

[layout.ts](layout.ts) names the shortest Edit/Execute pane height, the height kept below that pane so Messages stay usable, the width kept for the source and Execute panes when the register sidebar widens, and the sidebar's initial width. The desktop root and the display preferences derive pane bounds from them, and the register pane reads the initial width for its default. Limits that validate persisted records, such as the narrowest register width and the shortest Data Segment height, are owned by the [pane-layout adapter](../../../browser/README.md) and imported from there instead of repeated here.

Add a constant here when two or more Venus views or state owners derive geometry from it and no persisted record depends on it. A divider's gesture state belongs to the [layout components](../../components/layout/README.md), measured sizes and persistence to the display preferences and browser adapters, and a rule that merely resembles clamping but encodes a different policy stays with its caller.
