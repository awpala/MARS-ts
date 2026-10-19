# MARS-ts

A port of **MARS**, the MIPS Assembler and Runtime Simulator, from its original Java/Swing desktop application to a SvelteKit web application in TypeScript.

> **Target:** MARS-ts 1.0, translating the checked-in canonical Java implementation. **Status:** Core assembly, execution, stepping/backstepping, breakpoints, console input/output, and register/memory inspection are implemented in the desktop GUI. The [oracle fixtures](tests/oracle/README.md) cover the engine units and 19 original whole-program cases; CLI program arguments are excluded and seeded-random syscalls remain deferred. Remaining settings dialogs, platform syscalls, Tools, and File → Dump Memory are unfinished. The [port plan](docs/adrs/0000-port-plan.md) sets out the scope, stack, parity strategy, milestones, and open decisions.

The original Java sources at the repository root (`Mars.java`, `mars/`, and their resource files) are kept unmodified as the canonical behavioral reference for the port and are removed at the end of it. The initial implementation preserves existing class responsibilities, algorithms, and desktop layout, with browser file selection, same-tab dialogs, and SVG icons ([port fidelity decision](docs/adrs/0002-port-fidelity.md)).

## Development setup

Open the folder in its [development container](.devcontainer/devcontainer.json). It provides Node 24, the global TypeScript and Svelte (`sv`) CLIs, GitHub/Claude/Codex CLIs, and a **provisional JDK 21** used only to build and run the legacy Java MARS headlessly as the reference oracle ([ADR 0001](docs/adrs/0001-local-development-environment.md)). Setup runs [setup-env.sh](.devcontainer/scripts/setup-env.sh); open a new terminal afterward to load the commands.

| Command | Behavior |
| --- | --- |
| `run-checks [harness\|docs\|legacy\|app]` | Run harness, documentation, Java oracle, and application gates; report every failure |
| `build-legacy` | Compile the legacy Java MARS into `__build/legacy/Mars.jar` |
| `run-legacy nc prog.asm` | Run legacy MARS in command-line mode (`run-legacy h` lists its options) |
| `node tests/oracle/run.mjs --check` | Rebuild Java and compare the captured oracle corpus; `--update` regenerates goldens |
| `run-app` | Start the SvelteKit dev server on port **6277** (phoneword "MARS") |
| `tests`, `format`, `build-app`, `kill-app` | Vitest, ESLint+Prettier, clean build, stop the app listener |

`cleanup.sh` runs on the host and removes the dev container; `cleanup.sh --volumes` also removes its dependency caches and CLI credentials. [Development operations](docs/agents/operations.md) documents the gates and helper contracts.

AI coding assistants start at [AGENTS.md](AGENTS.md) (`CLAUDE.md` links to it).

## License and attribution

MARS is copyright 2003–2013 Pete Sanderson and Kenneth Vollmar and is distributed under the MIT license in [MARSlicense.txt](MARSlicense.txt). This port is a derivative work under the same license.

## Original MARS README
MARS (official) MIPS Assembler and Runtime Simulator

 MARS is a lightweight interactive development environment (IDE) for programming in MIPS assembly language, intended for educational-level use with Patterson and Hennessy's Computer Organization and Design.

 It is available for you to download as an executable JAR file.  Click the MARS v.4.5 link at right, under Releases, to access the download.

 We have relocated the MARS website to  https://dpetersanderson.github.io/    There are still a couple of display issues to work out but all website content is there.  This includes all documentation and the JAR download.  We are not experienced in github so if you know a way we can host the website in this MARS repository let us know.

 This is the original MARS, developed by Pete Sanderson and Ken Vollmar.  Developed while Pete was professor at Otterbein University and Ken was professor at Missouri State University.  Both are now retired. This is a legacy application but is very stable and continues to be used by universities throughout the world as of 2024. The last release was MARS 4.5 in August 2014.  
 
 Until October 2024 the MARS website, including executable JAR file download, was hosted by Missouri State University. That is no longer the case. That's why it is here.
