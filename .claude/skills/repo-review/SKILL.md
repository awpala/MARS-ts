---
name: repo-review
description: Review a repository diff for concrete correctness, parity, ownership, boundary, documentation, and validation defects without making edits.
---

Read the [shared implementation and review conventions](../../../docs/agents/workflow.md) for this specialty. Use the [root task directory](../../../AGENTS.md) to select additional guidance only when the assignment crosses that boundary; do not preload all agent guides or skill references.

# Repository review

Read [AGENTS.md](../../../AGENTS.md), the changed modules and their callers, and the relevant README or ADR. Inspect the working-tree diff read-only; do not commit, reset, rewrite, regenerate, or fix files as part of a review unless the user changes the task.

Prioritize observable defects:

- **Parity.** Ported behavior that differs from the legacy Java without an ADR; parity claims without an oracle fixture; hand-edited expected outputs; nondeterministic syscalls in exact-match fixtures. Probe disputed behavior with `run-legacy` in a temporary directory.
- **Java semantics.** Missing 32-bit normalization, 64-bit values routed through `number`, float bit-pattern or float-printing shortcuts, a non-Java random generator ([semantics rules](../../../docs/agents/legacy.md#java-to-typescript-semantics)).
- **Boundaries and lifetime.** Engine imports of Svelte, SvelteKit, or DOM; I/O bypassing host interfaces; module-level mutable simulator state; subscriptions, execution loops, Workers, or timers without teardown; SSR-shared module state.
- **Legacy tree changes.** Any edit to `_legacy-app/Mars.java`, `_legacy-app/mars/`, legacy resources, `_legacy-app/help/`, or the Javadoc is a blocking defect.

Check public documentation against the actual contract, including defaults, teardown, and legacy provenance. Dependency changes require auditing duplicated pins and affected major-version prose. Harness changes require the skill mirror, both role adapters, and permission intent to stay aligned ([harness guide](../../../docs/agents/harness.md)). Use [module organization](../module-organization/SKILL.md) to assess cohesion rather than line counts.

Determine exact versions before consulting first-party Svelte documentation. Respect environment limits; report checks that were unavailable rather than installing tools or implying they passed.

Return findings ordered by severity with a concrete trigger, consequence, file and line, and suggested direction. Distinguish confirmed defects from open questions. If no findings remain, say so and identify material validation gaps. Keep stylistic comments only when they violate an explicit repository contract or hide a practical defect.
