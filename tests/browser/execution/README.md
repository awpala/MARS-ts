# Execution and debugging browser scenarios

This group owns rendered assembly/debugging workflows, register and memory interaction, program arguments, syscall presentation, and memory-dump export. Scenarios exercise the production machine through desktop controls and inspect its visible results. The [Fibonacci assembly fixture](fibonacci.asm) supplies the stepped and timed memory-write positive control.

Use the shared [browser harness](../harness/README.md) for readiness, domain locators, browser API stubs, and archive inspection. Add cases here when correctness depends on the browser's presentation or interaction with loaded execution. Exact machine semantics, conversions, and encoder bytes remain the responsibility of the [TypeScript and Java oracle suites](../../README.md). The [suite guide](../README.md) describes timeouts, selectors, and evidence boundaries.
