# Desktop contexts

This module provides both the per-instance desktop state and a narrow command capability shared by independently composed menus and toolbars. [VenusUI.svelte](../VenusUI.svelte) constructs the state and installs both contexts during component initialization. Descendants read them during their own initialization; reading without a provider throws through Svelte's typed context accessor.

The command capability exposes dispatch and functions that read current enablement and pressed state. These functions observe the desktop's live reactive values rather than snapshots captured at registration. Dispatch keeps file operations, execution coordination, and menu dismissal with the session owner. This narrow capability does not expose a mutable machine or editor or transfer their ownership to consumers.

Only the accessor pair is module-scoped. Every rendered desktop supplies its own capability, including during SSR. There are no subscriptions, timers, or resources in this context to release; the root still owns machine/controller teardown. Generic panes, dropdowns, and buttons accept props and snippets without requiring this context, so they can be composed independently. Add another context only for a distinct capability shared across a component subtree; keep local tab, pointer, and input state with its existing owner.

Dialogs, file-transfer behaviors, and desktop keyboard bindings read the full desktop context to reach the responsible workspace, search, simulation, or preference owner. Generic panes, dropdowns, and buttons remain props/snippet driven. File-transfer components register their browser action with that desktop and remove only their own registration during teardown.
