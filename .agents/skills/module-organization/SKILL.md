---
name: module-organization
description: Place or refactor port modules by responsibility, class ownership, and the engine/UI boundary when adding files, mapping legacy Java packages to TypeScript, or moving existing code.
---

Read the [shared workflow and module organization](../../../docs/agents/workflow.md#module-organization) for this specialty. Use the [root task directory](../../../AGENTS.md) to select additional guidance only when the assignment crosses that boundary; do not preload all agent guides or skill references.

# Module organization

Read the affected module's README and the port plan's [legacy-to-target mapping](../../../docs/adrs/0000-port-plan.md#3-legacy-architecture-and-target-mapping) before changing structure.

- Keep one class per file with the helpers and types belonging to its contract. A private error type beside its owning class is cohesive. Related contract records can remain together when they describe one boundary.
- Pure functions need no class. A small helper needs no file solely to satisfy a size target.
- Treat Java packages as the starting map and retain corresponding class names and responsibilities. Split or merge only where a necessary language or browser adaptation warrants it; record its rationale and legacy-to-module mapping in the module README ([ADR 0002](../../../docs/adrs/0002-port-fidelity.md)).
- Name subfolders for responsibilities such as `assembler/`, `hardware/`, `instructions/`, `syscalls/`, `simulator/`, or `formatting/`. Translated engine code follows the Java responsibility map instead of `common`, `shared`, or `misc` catch-alls; `_legacy-app/mars/util/` in particular is split by what each helper actually does.
- Keep the engine free of UI and platform imports; components and routes depend on the engine, never the reverse.
- Extract general-purpose helpers where warranted: once two or more callers repeat the same logic, share one stateless implementation in the owning module's `utils/` directory (such as [Venus utilities](../../../src/lib/venus/utils/README.md)) or beside the data owner it describes. Skip extraction only when similar-looking copies encode different rules.
- Keep instance state and teardown with the owner, never in a helper; never turn a Java static into process-global mutable state.
- Preserve a long cohesive unit when its state and lifecycle belong together. Line count alone does not justify splitting it.
- Update all importers when moving code. Remove retired paths instead of leaving forwarding files or barrel exports.
- Anchor directory READMEs to stable responsibilities, ownership, relationships, legacy provenance, and extension criteria, not exhaustive file or export catalogs.

Check imports, public documentation, module READMEs, and the app gate after a relocation. Report why the resulting boundary is easier to review, not merely how many files became shorter.
