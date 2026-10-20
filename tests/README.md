# Application tests and oracle evidence

This directory owns cross-module TypeScript comparisons, browser workflow scenarios, and the Java oracle inputs and captured observations used to validate the port. Tests exercise the production [application libraries](../src/lib/README.md); engine behavior remains in the framework-free engine, and browser adaptations remain in their application owners. Focused tests also live beside their modules under `src/`.

## Test boundaries

| Layer                                  | Responsibility                                                                                                           | Evidence boundary                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| [Assembler](assembler/README.md)       | Exercise directives, source structures, tokenization, macros, operands, and complete assembly                            | Compare assembly behavior with captured Java observations                                                               |
| [Instructions](instructions/README.md) | Exercise extended-instruction metadata and template expansion                                                            | Compare pseudo-instruction translation with captured Java observations                                                  |
| [Session](session/README.md)           | Exercise settings, machine composition, controller workflows, and whole-program execution                                | Verify production integration and per-session ownership                                                                 |
| [Java oracle](oracle/README.md)        | Produce and recheck deterministic whole-program captures and class-level probes from the unchanged legacy implementation | A successful Java recheck establishes fixture reproducibility; the TypeScript consumers establish covered port behavior |
| [Browser scenarios](browser/README.md) | Exercise the mounted desktop, real execution, source persistence, controls, and component lifetimes                      | Establish browser integration behavior within the tested workflows                                                      |

The [Vitest configuration](../vite.config.ts) discovers `tests/**/*.test.ts` together with JavaScript and TypeScript tests under `src/`, excluding Svelte component test files. It runs in a Node environment, limits workers to two, and requires assertions. Browser `.spec.ts` files belong to the separate Playwright suite.

The [whole-program consumer](session/core-programs.test.ts) runs the original corpus through production `Globals` and `RunController`. Its explicit exclusions and the distinction between Java launcher output and browser behavior are documented with the [oracle fixtures](oracle/README.md). Module-local suites cover additional hardware, numeric, simulator, syscall, editor, and storage contracts. The [implementation guide](../IMPLEMENTATION.md#evidence-and-validation) connects these evidence families to current feature coverage and limitations.

## Running checks

Run commands from the repository root with dependencies installed and Node 24 available:

```sh
npm test
npm run test:unit
npm test -- tests/session/core-programs.test.ts
```

`npm test` runs the TypeScript suite once; `test:unit` starts Vitest for interactive work. The final command selects one suite. These tests consume checked-in oracle observations without rebuilding Java. Capturing or rechecking those observations additionally requires JDK 21:

```sh
node tests/oracle/run.mjs --check
run-checks legacy
```

The first command verifies the original whole-program corpus. The `legacy` tier also verifies the registered method-probe suites. Each oracle subdirectory documents its own capture format and commands. Only the documented update commands regenerate expected results; review every changed golden and never hand-edit captured output to make a TypeScript comparison pass.

For application checks, lint, formatting, unit tests, and an isolated static build, use `MARS_VALIDATION=1 run-checks app`. Run `npm run test:browser` separately using the [browser setup](browser/README.md#running-scenarios). Checks and browser runs that share generated validation output must run sequentially. Port **6277** remains available for ad hoc developer review; browser automation owns **6278**.

## Extending coverage

Keep focused module contracts beside their implementation when that boundary is sufficient. Add cross-module suites to the responsibility groups above, Java inputs and probes under `oracle/`, and rendered interaction scenarios under `browser/`. Tests should use production APIs and injected host services rather than implement a second assembler, simulator, or storage model.

The [oracle fixture helpers](oracle/fixtures.ts) centralize JSON loading and the existing tab-separated and JSON-lines decoding rules. They resolve fixtures relative to the oracle directory and return fresh data without caching mutable records. Suite-specific capture types, source adapters, and assertions stay with their consumers. Lint and formatting discover TypeScript recursively under `tests/`, including these helpers.

For translated behavior, capture the canonical Java observation before asserting parity in TypeScript. Preserve the fixture's numeric, byte, diagnostic, and event-order contracts; normalization belongs to the documented capture or comparison boundary. Browser-specific behavior needs its own assertions and does not establish Java parity. Report actual failures, skips, and unavailable prerequisites separately; passing coverage for one layer does not imply completion of the remaining port.
