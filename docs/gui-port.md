# Venus GUI port mapping

This document maps the existing desktop interface to the requested MARS-ts 1.0 target, which retains MARS as its display name. The checked-in Java implementation is the behavioral authority. This records analysis and implementation work still to do, not a working Svelte application or verified GUI parity. The [port plan](adrs/0000-port-plan.md) remains the milestone authority. The prepared [SVG assets and favicon](../static/README.md) are integrated by the initial Svelte GUI implementation under `src/`.

The user requests a like-for-like translation: retain Java class names and responsibilities in corresponding TypeScript controllers where they carry logic, and use Svelte components for presentation. Do not replace existing behavior with a new IDE design. The initial browser layout should resemble the desktop, including compact controls, bordered panes, tables, menu ordering, and toolbar symbols. Adapt native file access and separate windows to browser file selection and dialogs inside the current tab. The root route opens directly into the main GUI: omit `MarsSplashScreen` and any splash or intermediary launch screen. Application implementation belongs under `src/`, with routes in `src/routes/` and components/controllers in responsibility-specific `src/lib/` directories.

## Layout and class ownership

| Existing source | Planned responsibility and initial presentation |
| --- | --- |
| [VenusUI.java](../mars/venus/VenusUI.java), constructor and `setUpMenuBar` / `setUpToolBar` | `VenusUI` controller owns an IDE instance; its Svelte view renders File, Edit, Run, Settings, Tools, Help, then toolbar and run-speed control. Preserve shared action enablement between menu items and toolbar buttons. |
| [MainPane.java](../mars/venus/MainPane.java) | Top-left Edit / Execute tabs. Preserve the selected view and execution-pane arrangement across tab changes. |
| [EditTabbedPane.java](../mars/venus/EditTabbedPane.java), [EditPane.java](../mars/venus/EditPane.java), [Editor.java](../mars/venus/Editor.java) | Multiple source tabs, dirty markers, current file, cursor line/column, line-number toggle, undo/redo, find/replace, and close/save prompts. Keep file and editing operations in corresponding controllers. |
| [ExecutePane.java](../mars/venus/ExecutePane.java), `setWindowBounds` | Text Segment in the upper half, Data Segment across the lower half; optional Labels window occupies the upper-right quarter and shrinks Text Segment to three quarters of that row. Labels are hidden initially unless the saved setting enables them. |
| [RegistersPane.java](../mars/venus/RegistersPane.java) | Persistent right-hand pane with tabs in exact order: Registers, Coproc 1, Coproc 0. This pane remains visible while editing. |
| [MessagesPane.java](../mars/venus/MessagesPane.java) | Bottom-left Mars Messages / Run I/O tabs, each with Clear. Error activation selects the corresponding source location. Console input belongs to Run I/O unless popup-input mode requests an in-tab dialog. |
| [FileStatus.java](../mars/venus/FileStatus.java), [GuiAction.java](../mars/venus/GuiAction.java) | Preserve file/status constants and action contracts, but scope mutable state to an IDE instance. Derive shared enabled/disabled behavior from the original `VenusUI.setMenuState*` methods. |
| [RunSpeedPanel.java](../mars/venus/RunSpeedPanel.java) | Preserve the slider's 41 positions: 0.05–0.5, 1–30 instructions/second, then repeated unlimited positions. Unlimited is a sentinel, not a 40-instructions/second rate. |

`VenusUI` initializes the left vertical splitter at 75% editor/execution and 25% messages. Its width preferences depend on desktop screen size; in the browser, begin with the equivalent dominant left region and narrower register sidebar, and retain resizable dividers within the current viewport. `ExecutePane.setWindowBounds` supplies the exact internal initial proportions. The source, rather than unrelated web IDE conventions, determines default placement.

Toolbar order from `VenusUI.setUpToolBar`: New, Open, Save, Save As, Dump Memory, Print; Undo, Redo, Cut, Copy, Paste, Find/Replace; Assemble, Go, Step, Backstep, Pause, Stop, Reset; Help. Preserve separators and display Dump Memory only when dump formats are available. Select All exists as an action but is not added to the toolbar. Memory Previous / Next buttons use the two additional prepared SVGs.

## Tables and execution behavior

| Source | Required behavior |
| --- | --- |
| [TextSegmentWindow.java](../mars/venus/TextSegmentWindow.java) | Bkpt, Address, Code, Basic, Source columns; per-instruction breakpoints; breakpoint-header toggle; next-instruction highlighting. Program-argument input is excluded by the web scope decision. Code editing depends on self-modifying-code mode. |
| [DataSegmentWindow.java](../mars/venus/DataSegmentWindow.java) | A 512-byte window, address plus eight word columns, Previous / Next navigation, base selection for extern/data/heap/current `$gp`/current `$sp`/text/kernel/MMIO, ASCII toggle, and shared hexadecimal-address/value controls. Resolve addresses from the selected memory configuration, not hard-coded default addresses. |
| [LabelsWindow.java](../mars/venus/LabelsWindow.java) | Label/address table, label filtering and sort state, navigation to the matching text or data address. |
| [RegistersWindow.java](../mars/venus/RegistersWindow.java) | Name, Number, Value columns, register-purpose tooltips, changed-register highlighting, decimal/hex values. `$zero`, `$ra`, and PC cells are not editable; retain this source restriction. |
| [Coprocessor1Window.java](../mars/venus/Coprocessor1Window.java) | Name, Float, Double columns and condition flags. Float values are editable; double cells are editable only for even-numbered rows because they span register pairs. Keep bit-pattern conversion in the engine. |
| [Coprocessor0Window.java](../mars/venus/Coprocessor0Window.java) | Name, Number, Value columns for the selected exception/interrupt registers; value cells are editable per the source. |
| [RunAssembleAction.java](../mars/venus/RunAssembleAction.java), [RunResetAction.java](../mars/venus/RunResetAction.java) | Assemble current source or the configured source group, publish diagnostics, clear breakpoints on ordinary assembly, initialize execution displays on success, and restore the post-assembly program through the legacy reset flow. |
| [RunGoAction.java](../mars/venus/RunGoAction.java), [RunStepAction.java](../mars/venus/RunStepAction.java), [RunBackstepAction.java](../mars/venus/RunBackstepAction.java), [RunPauseAction.java](../mars/venus/RunPauseAction.java), [RunStopAction.java](../mars/venus/RunStopAction.java) | Preserve run, step, backstep, pause, stop, breakpoint, and terminal-state behavior through engine public APIs. Backstep restores machine state but does not undo console/file I/O. Unlimited execution suppresses per-instruction display updates and refreshes on pause, breakpoint, or termination. |

The behavioral explanations in [IDE help](../help/MarsHelpIDE.html), [debugging help](../help/MarsHelpDebugging.html), and [settings help](../help/MarsHelpSettings.html) supplement these source contracts. These files were read as reference only; no desktop behavior has yet been exercised in a web UI.

## Browser adaptations and engine contract needs

- File Open replaces `EditTabbedPane.openFile`'s `JFileChooser` with a browser file input. Read the user-selected files into the browser host's virtual filesystem; cancellation leaves the active document and dirty state unchanged. Includes resolve selected virtual files without claiming access to unselected native directories. “Assemble all open files in editor” replaces directory-wide assembly: assemble the current contents of every open editor tab, including unsaved edits and newly created buffers; never scan a native directory.
- Save/Save As need browser downloads or an explicitly supported browser file handle. Preserve the current name and dirty-state contract, but do not claim that initiating a download overwrites the original disk file. The final choice and differences from native overwrite behavior need a browser-host ADR.
- Find/Replace, settings, exception-handler selection, memory configuration, help, About, unsaved-change prompts, and dialog syscalls render inside the current browser view. Preserve each action's choices and returned values; dialogs need focus entry, keyboard dismissal where appropriate, and focus restoration. No separate application windows.
- Settings preserve applicable fields and defaults from `Settings.java` / `Settings.properties`, including display bases, label visibility, popup input, extended instructions, delayed branching, self-modifying code, warnings-as-errors, start-at-main, assemble-on-open, and assemble-all-open-files. Command-line integration and program-argument options are excluded. Fonts, syntax colors, and runtime highlighting are editorial JSON presets bundled at build time, with no Editor/Highlighting settings dialogs. Browser persistence replaces Java Preferences for supported user preferences without making process-wide mutable state.
- The engine owner must expose per-session register, memory, symbol, statement, diagnostic, and execution snapshots; actions for assembly/run/step/backstep/pause/stop/reset and cell writes; settings; breakpoints; and subscriptions returning unsubscribe callbacks. The GUI must never reimplement instruction, numeric, or assembler logic.
- The browser host supplies asynchronous console input, file I/O, dialogs, audio, time, and random seeds through the engine's host interface. Closing/replacing an IDE session cancels pending input and execution and releases every subscription. UI components own interaction state; engine sessions are not Svelte module singletons.
- Browser-reserved shortcuts, native printing, Exit, storage persistence, execution scheduling, the editor implementation, and bundled tools still need explicit implementation decisions. Preserve legacy action meaning where the browser permits it; do not silently add dependencies or invent substitute behavior.

## Implementation and verification checklist

- [x] Read the layout, toolbar, status, table, execution-action, file-dialog, and help references.
- [x] Prepare 20 toolbar SVGs and two memory-navigation SVGs with source attribution; preserve the existing Mars ICO and accompanying license.
- [x] Scaffold installed; Svelte 5 and SvelteKit 3 APIs resolved against official documentation and installed declarations.
- [ ] Implement corresponding controllers and Svelte views against the engine owner's public contracts, with desktop-style initial layout and shared action state.
- [ ] Port editor behavior, browser file workflows, settings, in-tab dialogs, and help; connect favicon and icons.
- [ ] Analyze changed Svelte files with the first-party Svelte MCP, run `run-checks app`, then exercise the isolated test server on port 6278.
- [ ] Exercise New/Open/Cancel, multiple files, dirty close/save prompts, assemble errors and source navigation, successful assembly, step/backstep, breakpoints, pause/continue/stop/reset, register and memory editing, base toggles, console input, settings persistence, and teardown/recreation.
- [ ] Compare desktop and browser layout at the same viewport; check keyboard menu/tab/dialog use and verify no secondary windows are created. Confirm engine oracle tests remain unchanged and passing; visual inspection alone does not establish simulator parity.

The root package and dependencies are installed. Initial desktop layout and editor workflows are being implemented; full GUI parity is not yet established. Remaining raster illustrations, dialog illustrations, and tool-specific imagery are outside this prepared toolbar asset set and remain to be converted during their feature ports.

Source attribution: this mapping and the prepared assets derive from MARS, copyright 2003–2013 Pete Sanderson and Kenneth Vollmar, under the [MIT license](../MARSlicense.txt). The original Java and resource files remain unmodified.
