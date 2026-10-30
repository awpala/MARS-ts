# Simulator sequencing oracle

The probe invokes the canonical Simulator directly with actual decoded instruction words and hardware. It compares step limits, sorted breakpoints, exit and cliff termination, delayed/nested branches, fetch failures, runtime exceptions, exception-handler dispatch, external interrupts, undo availability, and exact start/stop notices. It does not port or exercise command-line parsing.

Run `node tests/oracle/simulator-units/run.mjs` after `build-legacy` to regenerate, or add `--check` to verify the capture. The [TypeScript simulator tests](../../../src/lib/engine/simulator/Simulator.test.ts) consume this capture and separately exercise cooperative scheduling, asynchronous input, stop listeners, action callbacks, and instance isolation.
