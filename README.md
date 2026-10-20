# MARS-ts

A TypeScript/SvelteKit web application porting of **MARS**, the educational MIPS Assembler and Runtime Simulator, targeting **MARS-ts 1.0** (with version 1.0 targeting feature and behavioral parity with legacy Java/Swing-based desktop MARS app's final-release version 4.5, distributed as corresponding JAR file). Core assembly, execution, and desktop debugging are implemented; the full port remains in progress.

Read the [implementation guide](IMPLEMENTATION.md) for the current architecture, module responsibilities, browser working filesystem, supported behavior, validation evidence, and remaining limitations. The original Java app and generated Javadoc are isolated under [_legacy-app/](_legacy-app/README.md). The [port plan](docs/adrs/0000-port-plan.md) and [decision records](docs/README.md) describe scope and design choices.

[*See `MARS-ts` deployed live here!*](https://mars-ide.portfolio-projects.dev)

> [!IMPORTANT]
> This is a good faith feature-parity attempt/interpretation **only** (via corresponding TypeScript porting of equivalent Java implementation). The repo owner makes **no** guarantee of 100% fidelity to the original Java-based implementation; user discretion/discernment is therefore advised accordingly!

> [!WARNING]
> ***Disclosure***: Porting performed with assistance of LLM-based tooling (primarily, Claude Code and Codex).

> [!NOTE]
> For additional information, see original author documentation [here](https://dpetersanderson.github.io/Help/MarsHelpIntro.html), as of legacy/final version 4.5 (Java/Swing-based implementation). Modified versions are implemented in the `Help` menu/dropdown of the MARS-ts implementation (see [here](./src/lib/help/README.md)), with distinction between legacy vs. current/ported functionality, where appropriate.

## Development

Open the [development container](.devcontainer/devcontainer.json), then use `run-app` to start the IDE on **port 6277**. The environment provides Node 24 and a provisional JDK 21 for the unchanged Java reference. See [development operations](docs/agents/operations.md) for setup, build, test, and cleanup commands.

For automated validation, use `MARS_VALIDATION=1 run-checks app` and `npm run test:browser`; browser tests use **6278**, leaving 6277 available for ad hoc development review and smoke testing. Other checks are documented in the [implementation guide](IMPLEMENTATION.md#reproducing-checks). Coding assistants start at [AGENTS.md](AGENTS.md).

## License

MARS is copyright 2003–2013 Pete Sanderson and Kenneth Vollmar, under the [MIT license](MARSlicense.txt). This port retains that attribution and license. The [legacy application README](_legacy-app/README.md#original-mars-readme) preserves the original project introduction; the [implementation guide](IMPLEMENTATION.md#provenance-and-attribution) records additional attribution.
