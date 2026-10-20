# Backstep oracle

This probe uses the real Java BackStepper and hardware hooks, attaching its private history field to a program through test-only reflection. It compares restoration of registers, PC, coprocessors, condition flags, all memory write widths, statement-identity grouping, no-write instructions, delay-slot snapshots, enable behavior, GUI edits without a statement, signed PC wrap, and the configured circular history capacity. The TypeScript test runs the same sequence through real ported hardware and BackStepper instances; statement objects serve only as stored identity/binary records.

Run `node tests/oracle/backstep-units/run.mjs` to capture after `build-legacy`, or append `--check` to compare. The shared runner records source hashes, isolates Java Preferences, and requires JDK 21. A separate TypeScript test verifies per-instance histories and the injected fatal-error boundary. No legacy file is modified.
