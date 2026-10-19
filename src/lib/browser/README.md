# Browser host

This module owns browser platform integrations used by the IDE. Source downloads use a temporary object URL and an anchor in the current document, with URL and DOM cleanup after initiation. [ADR 0003](../../../docs/adrs/0003-browser-file-workflows.md) defines the distinction between downloads and native overwrites.

Browser adapters must remain outside the framework-free engine. Add host implementations here when their engine interfaces exist; assembly, runtime console/file I/O, scheduling, audio, and simulator dialogs are not implemented by this download adapter.

Pane preferences use the versioned `mars-ts:panes:v1` localStorage key. The browser adapter validates numeric values, clamps dimensions to safe lower/fraction limits, and tolerates malformed JSON, denied storage, and quota failures. The presenter applies viewport-dependent bounds, reads preferences on mount, and writes after a completed pointer gesture or keyboard resize. It preserves the current in-memory layout if persistence is unavailable. These preferences contain no source text or engine state.

Working display settings use the separate `mars-ts:display-settings:v1` key: label visibility, line numbers, hexadecimal value/address display, and the legacy run-speed slider position. The adapter accepts exact boolean types and integer slider positions 0–40; malformed, partial, or incompatible records use the GUI defaults. Only supported fields are written, immediately after a preference changes once the view is ready. Source contents, current tabs, selected views, dialogs, and hardware are never persisted by this adapter.
