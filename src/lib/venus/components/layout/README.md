# Pane layout primitives

This group owns reusable pane structure and resizing interactions. Pane shells render caller-supplied content snippets, tab strips render keyed choices and optional actions, and dividers report geometry changes. Callers own selected tabs, content lifetimes, bounds, and persistence. These components have no desktop context, editor, or machine dependency.

CSS custom properties provide geometry without reaching through scoped component styles. The same tab strip supports pane tabs and nested source-document tabs. Dividers own pointer capture and keyboard adjustment and release their gesture state; the [display preference owner](../../state/README.md) clamps and persists the resulting dimensions.

Tab strips also accept an optional control snippet in place of their default selection button. The caller supplies accessible interaction and presentation while the strip retains stable keys and layout. Source tabs use this contract to switch between a filename button and an inline rename input without teaching the generic strip about file workflows.

These are browser composition primitives for the panes and split boundaries of the legacy Venus desktop, following [ADR 0002](../../../../../docs/adrs/0002-port-fidelity.md). Add reusable geometry or snippet-based structure here; source, debugging, and dialog-specific content belongs with its view.
