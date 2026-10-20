# Machine and controller sessions

This group owns integration tests for production `Globals`, settings, and Venus `RunController`, including whole-program oracle comparisons. The [engine](../../src/lib/engine/README.md) owns machine behavior, while the [controller](../../src/lib/venus/RunController.ts) owns assembly and execution workflows. Tests verify their composition, independent machines, execution transitions, subscriptions, and disposal.

Controller scenarios use in-memory sources and overridable host services to control input and scheduling. The whole-program corpus instead supplies its declared source files, recorded input, and captured output through Node adapters. These setups serve different contracts and remain local to their suites. Shared [oracle helpers](../oracle/fixtures.ts) handle JSON capture loading; launcher-display interpretation and output normalization remain with the whole-program comparison.

The [oracle guide](../oracle/README.md) documents explicit corpus exclusions and CLI-versus-GUI behavior. Add machine-composition and controller-lifecycle cases here; rendered interactions and component teardown belong to [browser scenarios](../browser/README.md). See the [test guide](../README.md) for validation commands and evidence rules.
