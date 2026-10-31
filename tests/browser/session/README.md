# Session recovery and lifetime browser scenarios

This group owns desktop recovery across reload and component lifetime across mounting, removal, and pending asynchronous operations. Scenarios use the production desktop and controlled browser operations to observe restored state, stale completion guards, retained control identity, and released listeners or resources.

Use the shared [browser harness](../harness/README.md) for readiness and browser API stubs. Add scenarios here when the contract spans a session checkpoint or component lifetime; ordinary source operations belong under [workspace](../workspace/README.md), and live machine interaction belongs under [execution](../execution/README.md). The [suite guide](../README.md) documents setup isolation and the limits of browser evidence.
