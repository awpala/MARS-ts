# Diagnostic method probes

`DiagnosticsProbe.java` calls the unmodified Java `ErrorMessage` and `ErrorList` classes, including runtime `ProgramStatement` source handling and include source mapping. Its output is a series of labeled UTF-8 Base64 values so embedded report newlines remain byte-exact. The generated `golden.json` records the command, input, output, status, and relevant source hashes. It supplements the CLI corpus; it does not establish full assembler or simulator parity.

Run `build-legacy`, then `node tests/oracle/diagnostics-units/run.mjs --update` to regenerate or `--check` to compare. The [shared probe runner](../units/run.mjs) compiles the probe against that build and uses isolated Java preferences and headless mode. The source tree is never edited. Vitest consumes the capture without requiring Java.
