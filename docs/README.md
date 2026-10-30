# Architecture and operations

The [implementation guide](../IMPLEMENTATION.md) describes the current MARS-ts system, its architecture, browser adaptations, supported behavior, and remaining limitations. These decision records explain its plan, environment, and consequential design choices.

The [deviation catalog](deviations.md) compares implemented UI and Engine behavior with final MARS 4.5, separating browser/platform adaptations and excluding unfinished features. It remains a living comparison until the human-owned MARS-ts 1.0 release cut.

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
| [Installable, offline-capable web app](adrs/0010-pwa-offline-support.md) | Accepted | Progressive Web App installation, service-worker caching, offline startup, and update lifecycle |
| [Breakpoint changes during Go](adrs/0011-in-flight-breakpoints.md) | Accepted | Live breakpoint replacement, finite-speed UI editing, maximum-speed lock, and post-instruction checks |
| [Behavioral baseline and deviation catalog](adrs/0012-deviation-baseline.md) | Accepted; release baseline open | Current UI/Engine deviations, separate browser/platform adaptations, evidence, ongoing maintenance, and the 1.0 release freeze |
| [Automatic exception-handler selection](adrs/0013-exception-handler-workflow.md) | Accepted | Saved-library handler selection, legacy commit rules, assembly notices, and loaded-handler recovery |
| [Random streams and syscall dialogs](adrs/0014-random-and-dialog-syscalls.md) | Accepted | Java-compatible random streams, same-tab dialog contracts, entropy ownership, checkpoints, and Swing oracle evidence |
| [MIDI syscalls as Web Audio sine tones](adrs/0015-midi-web-audio-tones.md) | Accepted | Injected tone host, sine-wave browser output, autoplay preparation, timed synchronous waits, Stop release, and MIDI sequence oracle evidence |

The [Coolify deployment runbook](runbooks/prod-deployment.md) covers ongoing configuration maintenance, releases, smoke checks, and rollback for the live, stable service at `mars-ide.portfolio-projects.dev`.

The [agent directory](../AGENTS.md) carries coding conventions for assistants; the guides under [agents/](agents/) are routed from it.

Keep decision records current when the port changes a boundary, and add an ADR whenever an [open decision](adrs/0000-port-plan.md#8-open-decisions) is made. `check-adr-index.sh` verifies that this index matches the files on disk.

## Legacy Javadoc

The generated MARS 4.5 Javadoc and its supporting indexes, stylesheet, and images live in [_legacy-app/docs/](../_legacy-app/docs/README.md). They remain read-only legacy reference material until offboarding (milestone P5 of the [port plan](adrs/0000-port-plan.md#6-milestones)). This directory holds authored documentation for the TypeScript port, including the [backend translation plan](backend-port.md), [GUI port mapping](gui-port.md), and oracle guidance.
