# Desktop dialog composition

This directory owns workflow-specific dialog presentation. Each variant reads the nearest [desktop context](../../context/README.md), renders one workflow through [Modal](Modal.svelte), and delegates actions to the existing [state owner](../../state/README.md). Source opening, deletion, import collisions, saving, dirty closure, search, Help, and prompted syscall input have independent views. The workspace, search, and simulation owners retain their rules, pending data, and cancellation behavior.

[DesktopDialogs](DesktopDialogs.svelte) selects workspace dialogs through a registry checked against the workspace's modal type. Help and input views observe their separate owners. A change of workspace variant mounts the corresponding component; save-target changes also remount the save shell to preserve initial focus between queued saves.

Open derives a case-insensitive lexicographic filename listing from the saved sources, using exact spelling only to break ties between names that differ solely in case. Sorting affects presentation without mutating storage or editor tab order; checkbox selection continues to use the exact source identity.

Invalid renames have a focused warning variant showing the validation failure and the latest valid filename. Inline tab editing and Save As Rename share this presentation through the workspace; neither the warning nor the modal shell validates names or mutates source records.

Modal owns native dialog lifetime, the accessible heading, backdrop and Escape dismissal, focus containment, and focus restoration. It accepts a content snippet and has no knowledge of workflow variants. Shared action and field components provide compact, theme-aware layouts through snippets while preserving native form submission, input bindings, validation, and labeling. Variant-specific lists, errors, and conditional choices stay with their own view.

These are browser compositions of the file actions, search, Help, and syscall input presentation formerly coordinated by the legacy Venus desktop, following [ADR 0002](../../../../../docs/adrs/0002-port-fidelity.md) and the [browser file workflows](../../../../../docs/adrs/0003-browser-file-workflows.md). Add a variant for a distinct workflow and reuse the shell and layouts; keep domain rules in their state owner rather than adding a switch to Modal.
