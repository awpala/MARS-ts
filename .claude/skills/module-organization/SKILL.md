---
name: module-organization
description: Place or refactor port modules by responsibility, class ownership, and the engine/UI boundary when adding files, mapping legacy Java packages to TypeScript, or moving existing code.
---

Read the [shared workflow and module organization](../../../docs/agents/workflow.md#module-organization) for this specialty. Use the [root task directory](../../../AGENTS.md) to select additional guidance only when the assignment crosses that boundary; do not preload all agent guides or skill references.

# Module organization

Read the affected module's README and the port plan's [legacy-to-target mapping](../../../docs/adrs/0000-port-plan.md#3-legacy-architecture-and-target-mapping) before changing structure.

- Keep one class per file with the helpers and types belonging to its contract. A private error type beside its owning class is cohesive. Related contract records can remain together when they describe one boundary.
- Pure functions need no class. A small helper needs no file solely to satisfy a size target.
- Treat Java packages as a starting map. Merge Java classes that exist only because of Java's one-public-class rule; split Java god classes (`InstructionSet.java`, `VenusUI.java`) along real responsibilities. Record the resulting legacy-to-module mapping in the module README.
- Name subfolders for responsibilities such as `assembler/`, `hardware/`, `instructions/`, `syscalls/`, `simulator/`, or `formatting/`. Avoid `utils`, `common`, `shared`, and `misc`; `mars/util/` in particular is split by what each helper actually does.
- Keep the engine free of UI and platform imports; components and routes depend on the engine, never the reverse.
- Extract a rule only when its callers share that rule. Keep instance state and teardown with the owner; never turn a Java static into process-global mutable state.
- Preserve a long cohesive unit when its state and lifecycle belong together. Line count alone does not justify splitting it.
- Update all importers when moving code. Remove retired paths instead of leaving forwarding files or barrel exports.
- Anchor directory READMEs to stable responsibilities, ownership, relationships, legacy provenance, and extension criteria, not exhaustive file or export catalogs.

Check imports, public documentation, module READMEs, and the app gate after a relocation. Report why the resulting boundary is easier to review, not merely how many files became shorter.
