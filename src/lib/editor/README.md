# Source editor

This module owns per-IDE source buffers, tab selection, filenames, dirty state, and edit history. Its controller adapts the responsibilities of `mars/venus/Editor.java`, `EditPane.java`, and `EditTabbedPane.java`; the Svelte view owns browser events and dialog decisions. It does not parse or assemble MIPS source.

Each mounted IDE constructs its own Editor. Changes are explicit controller calls followed by view snapshots; no source state survives teardown or crosses SSR requests. Equal filenames may identify different user-selected browser files and remain distinct tabs. Closing requires the caller to resolve unsaved changes before invoking the controller. Undo history is per tab, and a new edit clears the redo branch. Default filename numbering advances only for new files, as in the Java Editor. Unmodified Tab replaces the selected text with one literal tab, following `jeditsyntax/InputHandler.insert_tab`; Shift+Tab retains focus traversal as in `JEditTextArea`.

The browser host owns file selection and downloads under [ADR 0003](../../../docs/adrs/0003-browser-file-workflows.md). A successful download initiation updates the saved-text baseline but cannot prove disk persistence. The [canonical highlighter](highlighting/README.md) paints source behind the native textarea while preserving selection, caret, tabs, and scroll. Native directory access, editor preferences, instruction popup completion, and full Java editor parity remain unimplemented. The unit tests cover buffer lifecycle and isolation; they do not establish Java GUI parity.

Derived from MARS, copyright 2003–2013 Pete Sanderson and Kenneth Vollmar, under the [MIT license](../../../MARSlicense.txt).
