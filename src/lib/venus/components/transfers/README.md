# Browser text and file transfers

This group owns browser interactions that move exact source text across the application boundary. Clipboard controls either copy supplied code with local success/failure feedback or delegate transfer into a new editor source. File import owns the native picker and asynchronous file reads; export owns single/all download actions and collision-free download filenames.

Mounted file behaviors register capabilities with the nearest [desktop context](../../context/README.md) and release their registrations during teardown. The [workspace owner](../../state/README.md) retains source snapshots, local-library persistence, import collision confirmation, and dirty-buffer protection. Clipboard and file readers ignore late completion after disposal. Each nonempty import selection supersedes earlier reads, including their error paths, so an older result cannot replace a newer pending import. Shared tooltip presentation comes from [feedback](../feedback/README.md).

These are browser adaptations of source-file workflows and code transfer, governed by [ADR 0003](../../../../../docs/adrs/0003-browser-file-workflows.md). Add browser transfer mechanics here; keep saved-source policy and editor mutations with the workspace, and use [dialog variants](../dialogs/README.md) for confirmation presentation.
