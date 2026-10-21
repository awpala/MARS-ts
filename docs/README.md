# Architecture and operations

The [implementation guide](../IMPLEMENTATION.md) describes the current MARS-ts system, its architecture, browser adaptations, supported behavior, and remaining limitations. These decision records explain its plan, environment, and consequential design choices.

| Decision                                                                          | Status                    | Scope                                                                                                                    |
| --------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [Port plan](adrs/0000-port-plan.md)                                               | Accepted (P0–P2 complete) | Scope, stack, legacy-to-target mapping, parity strategy, milestones, open decisions                                      |
| [Local development](adrs/0001-local-development-environment.md)                   | Accepted                  | One devcontainer, provisional JDK, setup ordering, persistence, live helpers                                             |
| [Browser file workflows](adrs/0003-browser-file-workflows.md)                     | Accepted                  | Local source library, recovery, save/import/export, same-tab dialogs, browser validation                                 |
| [Port fidelity](adrs/0002-port-fidelity.md)                                       | Accepted                  | Like-for-like classes and algorithms, desktop layout, browser adaptations, assets, and fixture layout                    |
| [Cooperative simulation](adrs/0004-cooperative-simulation.md)                     | Accepted                  | Browser scheduling, asynchronous input, execution ownership, and callback contracts                                      |
| [Coolify deployment](adrs/0005-coolify-deployment.md)                             | Accepted                  | Static build, production origin, GitHub App deployment, and release ownership                                            |
| [Object ownership and runtime lifetimes](adrs/0006-object-lifetime-management.md) | Accepted                  | Per-desktop state, scoped resources, asynchronous result validity, teardown ordering, and browser persistence boundaries |
| [Desktop session recovery](adrs/0007-desktop-session-recovery.md) | Accepted | Browser-local IDE presentation, stable machine checkpoints, console buffers, and reload recovery |
| [GUI program arguments](adrs/0009-program-arguments.md) | Accepted | Legacy argument parsing and stack setup, shared Args toggle, and browser draft recovery |
| [Optional output clearing on Go](adrs/0008-clear-outputs-on-go.md) | Accepted | Persisted browser preference to clear both consoles before Go |

The [Coolify deployment runbook](runbooks/prod-deployment.md) covers ongoing configuration maintenance, releases, smoke checks, and rollback for the live, stable service at `mars-ide.portfolio-projects.dev`.

The [agent directory](../AGENTS.md) carries coding conventions for assistants; the guides under [agents/](agents/) are routed from it.

Keep decision records current when the port changes a boundary, and add an ADR whenever an [open decision](adrs/0000-port-plan.md#8-open-decisions) is made. `check-adr-index.sh` verifies that this index matches the files on disk.

## Legacy Javadoc

The generated MARS 4.5 Javadoc and its supporting indexes, stylesheet, and images live in [_legacy-app/docs/](../_legacy-app/docs/README.md). They remain read-only legacy reference material until offboarding (milestone P5 of the [port plan](adrs/0000-port-plan.md#6-milestones)). This directory holds authored documentation for the TypeScript port, including the [backend translation plan](backend-port.md), [GUI port mapping](gui-port.md), and oracle guidance.
