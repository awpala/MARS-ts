# DOM presentation helpers

This directory owns two small browser-presentation rules that several components share: composing an `aria-describedby` value and centering a row beneath a sticky table heading. Neither has legacy provenance, and neither keeps state.

[describedBy.ts](describedBy.ts) joins the nonempty element IDs of a description reference and returns `undefined` when none apply, so the attribute is omitted instead of rendered empty. The generic [Button](../../components/controls/Button.svelte), [LinkedResource](../../components/controls/LinkedResource.svelte), and [SelectorToggle](../../components/controls/SelectorToggle.svelte) use it to combine a caller-supplied `aria-describedby` with the tooltip's ID, in that order, so every control follows one convention.

[scrollReveal.ts](scrollReveal.ts) scrolls only a given viewport so a target row or cell is centered below the table's sticky heading, and answers whether a target's bottom edge lies within the viewport. Native scroll clamping pins the first and last pages, and horizontal position, other panes, and keyboard focus are untouched. The Text Segment follows the highlighted instruction with it, and the Execute view reveals label destinations, restored selections, and observed writes with it, always scrolling the pane that holds the target instead of the desktop.

Add a helper here when it is a DOM-level presentation rule used by more than one component and needs no component state. Element attachments, event listeners, and timers belong to the component that owns the element's lifetime, and tooltip behavior belongs to the [feedback](../../components/feedback/README.md) group.
