---
name: svelte-code-writer
description: Implement Svelte components and SvelteKit routes for the MARS web IDE using the pinned first-party documentation and analyzer workflow.
---

Read the [application engineering conventions](../../../docs/agents/app.md) for this specialty. Use the [root task directory](../../../AGENTS.md) to select additional guidance only when the assignment crosses that boundary; do not preload all agent guides or skill references.

# Svelte implementation workflow

Read [the shared Svelte conventions](../svelte-core-bestpractices/SKILL.md) and the relevant component and engine contracts. Determine installed versions from `package.json` and `package-lock.json` before selecting APIs. If the app is not scaffolded yet, stop: UI work starts after milestone P1 of the [port plan](../../../docs/adrs/0000-port-plan.md#6-milestones).

Use the configured first-party `svelte` MCP to find the relevant documentation and analyze changed Svelte code with its autofixer. Inspect suggested changes before applying them. The documentation service may describe a different SvelteKit major than the one installed: compare its advice with the installed declarations and compiler diagnostics, and report any mismatch instead of introducing another major's APIs. If the server is unavailable, report that and rely on installed diagnostics without inventing its result.

Preserve the local contracts that generic examples often miss: named documented `Props`, Svelte 5 runes, snippet callbacks, typed route resolution, and the engine boundary. Components consume engine sessions only through their public API; they never reach into engine internals or hold engine state in module scope.

Own interaction state inside the component tree. Keep getters pure, replace whole `$state.raw` values, and return teardown for every engine subscription, execution loop, Worker, timer, and listener. When a feature replaces a Venus UI behavior, read the legacy `_legacy-app/mars/venus/` class and `_legacy-app/help/` page to preserve its information, workflow, and initial desktop presentation, with only the browser adaptations in [ADR 0002](../../../docs/adrs/0002-port-fidelity.md).

Run check, lint, format:check, test, and build from the repository root (`run-checks app`), then exercise changed behavior with `npm run test:browser` on isolated port 6278 (6277 is exclusively for the human; ad hoc agent servers use 6279 or higher) when available. User-specified environment limits take precedence: list deferred checks clearly rather than installing forbidden tooling or claiming they passed. Report the versions, first-party tools consulted, commands run, and remaining warnings.
