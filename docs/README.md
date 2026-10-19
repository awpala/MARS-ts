# Architecture and operations

These decision records document the MARS-ts port: its plan, environment, and the choices made along the way.

| Decision | Status | Scope |
| --- | --- | --- |
| [Port plan](adrs/0000-port-plan.md) | Accepted (P0 complete; P1 preparation) | Scope, stack, legacy-to-target mapping, parity strategy, milestones, open decisions |
| [Local development](adrs/0001-local-development-environment.md) | Accepted | One devcontainer, provisional JDK, setup ordering, persistence, live helpers |
| [Port fidelity](adrs/0002-port-fidelity.md) | Accepted | Like-for-like classes and algorithms, desktop layout, browser adaptations, assets, and fixture layout |

The [agent directory](../AGENTS.md) carries coding conventions for assistants; the guides under [agents/](agents/) are routed from it.

Keep decision records current when the port changes a boundary, and add an ADR whenever an [open decision](adrs/0000-port-plan.md#8-open-decisions) is made. `check-adr-index.sh` verifies that this index matches the files on disk.

## Legacy Javadoc

The HTML files at the top of this directory (`index.html`, `overview-*.html`, `package-*.html`, and the rest) and the `mars/` and `resources/` subdirectories are the generated Javadoc of MARS 4.5. They belong to the legacy reference: read them, do not edit them, and do not mix authored documentation into them. They are removed at offboarding (milestone P5 of the [port plan](adrs/0000-port-plan.md#6-milestones)). The MARS runtime never reads them, so `build-legacy` does not package them.
