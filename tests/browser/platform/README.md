# Routes and installation browser scenarios

This group owns application-level browser surfaces outside a specific desktop workflow: route fallbacks, crawler documents, manifest metadata, and served installation icons. Scenarios inspect the real application and its static resources.

The [suite](../README.md) blocks service workers in test browser contexts, so these manifest/icon checks establish no offline behavior. Offline validation requires a separate production build with workers allowed, as documented by the [service-worker module](../../../src/service-worker/README.md). Use the shared [browser harness](../harness/README.md), and add scenarios here when the contract concerns routing, browser metadata, or the installable-app surface.
