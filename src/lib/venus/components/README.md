# Venus browser components

This directory owns browser presentation and element lifetimes for the Venus desktop. The top-level [root](../VenusUI.svelte) composes these views and owns the lifetime of the [desktop state](../state/README.md). Separate state owners manage the editor, machine, execution controller, pending syscall input, file workflows, and persisted preferences. Components receive data and callbacks through documented props; menus and toolbars also consume the root's [command context](../context/README.md). The engine never imports this directory.

Components are grouped by their presentation responsibility and imported directly from that group. The root contains this guide, not a barrel or compatibility wrappers.

| Group                            | Responsibility                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| [shell](shell/README.md)         | Application menus, grouped toolbar commands, run speed, appearance, and repository navigation |
| [layout](layout/README.md)       | Reusable pane shells, nested tab strips, and adjustable dividers                              |
| [editor](editor/README.md)       | Source rendering, editing interactions, highlighting, and document tabs                       |
| [debugger](debugger/README.md)   | Execution, register, memory, label, and console presentation                                  |
| [feedback](feedback/README.md)   | Shared loading status, tooltip interactions, and keyboard hints                               |
| [transfers](transfers/README.md) | Clipboard and browser file-transfer behaviors                                                 |
| [dialogs](dialogs/README.md)     | Modal rendering, shared form layouts, and focused workflow variants                           |

Layout and feedback remain independent of desktop context and feature views. Feature components may compose those primitives, the shell's leaf glyphs, and transfer controls; they leave source and machine policy with their state owners. Dialog variants consume context, while the Modal shell and its field/action layouts remain snippet-driven.

Pane composition uses a generic tabbed shell with a body snippet and optional tab-strip actions. Its body snippet receives the selected tab; the caller decides which content stays mounted. CSS custom properties control pane dimensions without reaching through component-scoped styles. The generic tab strip supports both pane tabs and scrollable nested document tabs, with stable keys and per-document action snippets. Selecting a document or closing it delegates to the editor owner; the tab strip does not create or dispose buffers.

Dropdowns render ordered groups of command or checkbox records, with separators between nonempty groups. Menu bars own native-details dismissal within their own element and use an instance-specific details group name. Toolbar groups accept content snippets, reusable buttons own labeling and pressed/disabled presentation, and glyph snippets share SVG variants. The menu and toolbar adapters resolve their command records through the same desktop capability, so reusable controls do not know how to save files or execute a machine.

The run-speed slider owns its label and range input, while its bindable position remains in the desktop for persistence and engine assignment. Both the slider and the desktop use the same presentation utility for the legacy speed mapping.

Source rendering owns its hover and scroll state while delegating edits and selection updates. Its bindable textarea handle lets the desktop focus and select source for find/replace and source navigation. Execution and register panes read parent-owned hardware through public APIs and release their existing subscriptions. The message pane renders output and inline input while simulation state retains the pending resolver and syscall completion rules. Adjustable separators own pointer gesture state and emit size/commit callbacks; their owner clamps viewport geometry and persists the result.

Loading status is a separate component owning the accessible label and continuously rotating spinner. The desktop owns its overlay positioning, initialization, visibility, and pending reveal-frame cleanup.

Tooltip owns hover and keyboard-focus descriptions, viewport placement, accessible description IDs, dismissal, and cleanup. Pointer activation and loss of window focus dismiss it; mouse focus does not retain a tooltip after the pointer leaves. KeyboardShortcut renders the same command hints as theme-aware keycaps. The repository link follows the theme toggle and opens GitHub in a new tab. Clipboard has copy-code and transfer-to-file variants, with exact source text and safe asynchronous feedback.

Modal renders the shared dialog shell and owns focus containment, dismissal, and restoration. [Dialog variants](dialogs/README.md) compose that shell with workflow-specific content and shared field/action layouts. DesktopDialogs selects the active workspace variant through a typed registry; it does not implement forms or workflow conditionals.

FileImporter owns file-picker reads and releases its command registration on unmount; FileExporter has single/all variants and releases or replaces its registration when unmounted or its variant changes. The toolbar and menus invoke those registered capabilities through their existing commands.

This is a browser composition of the responsibilities historically implemented by `mars/venus/VenusUI.java`, `MainPane.java`, `MessagesPane.java`, `ExecutePane.java`, the register windows, and the editor UI. The [module guide](../README.md) records behavior and adaptations, and [ADR 0002](../../../../docs/adrs/0002-port-fidelity.md) governs fidelity.

Add a component when it owns a cohesive view, interaction lifetime, or reusable rendering contract. Place it with the responsibility it extends; retain engine algorithms in the engine, workflows in their state owners, and desktop composition in VenusUI.
