# MARS-ts

A TypeScript/SvelteKit port of **MARS**, the educational MIPS Assembler and Runtime Simulator, targeting **MARS-ts 1.0**. Core assembly, execution, and desktop debugging are implemented; the full port remains in progress.

Read the [implementation guide](IMPLEMENTATION.md) for the current architecture, module responsibilities, browser working filesystem, supported behavior, validation evidence, and remaining limitations. The [port plan](docs/adrs/0000-port-plan.md) and [decision records](docs/README.md) describe scope and design choices.

## Development

Open the [development container](.devcontainer/devcontainer.json), then use `run-app` to start the IDE on **port 6277**. The environment provides Node 24 and a provisional JDK 21 for the unchanged Java reference. See [development operations](docs/agents/operations.md) for setup, build, test, and cleanup commands.

For automated validation, use `MARS_VALIDATION=1 run-checks app` and `npm run test:browser`; browser tests use **6278**, leaving 6277 available for human review. Other checks are documented in the [implementation guide](IMPLEMENTATION.md#reproducing-checks). Coding assistants start at [AGENTS.md](AGENTS.md).

## License

MARS is copyright 2003–2013 Pete Sanderson and Kenneth Vollmar, under the [MIT license](MARSlicense.txt). This port retains that attribution and license. The [implementation guide](IMPLEMENTATION.md#provenance-and-attribution) preserves the original project introduction and additional attribution.
