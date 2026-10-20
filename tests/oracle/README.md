# Java oracle fixtures

This directory owns deterministic inputs and captured behavior for the TypeScript engine. The original Java implementation is the only producer of the goldens. The runner uses Node built-ins and the repository's isolated Java wrapper; it has no npm dependencies and implements no assembler or simulator behavior. The TypeScript [core-programs test](../core-programs.test.ts) consumes the original corpus through the production `Globals` composition and `RunController`. The capture runner alone establishes oracle reproducibility; the separate TypeScript comparisons establish the covered port behavior.

## Capture and verify

From the repository root, with Node 24 and JDK 21 available:

```sh
node tests/oracle/run.mjs --update
node tests/oracle/run.mjs --check
```

Both commands rebuild the untouched legacy sources through [build-legacy.sh](../../.devcontainer/scripts/bin/build-legacy.sh), then invoke [run-legacy.sh](../../.devcontainer/scripts/bin/run-legacy.sh) for each case. Every process gets isolated Java preferences. The runner resolves its own location, so the caller's current directory does not affect includes or diagnostics. A build failure, timeout, unexpected exit status, malformed manifest, missing golden, differing bytes, changed source hash, or extra golden fails the command. Each Java run has a 15-second timeout; a step-limit fixture also supplies MARS's own instruction limit.

Only `--update` writes expected results. Review every changed golden after regeneration; never edit expected output by hand. `--check` reads goldens and compares them with a fresh oracle run. Regenerate twice and run `--check` when extending the corpus to demonstrate deterministic output. Removed cases require removing their obsolete golden files explicitly; the checker rejects orphaned files.

## Format and normalization

[cases.json](cases.json) uses schema version 1. Each case declares its stable ID, source basename, MARS options, program arguments, UTF-8 stdin, and expected termination code. `auxiliaryFiles`, when present, lists every included source dependency; the runner hashes their bytes along with the program and case configuration. Keep all include dependencies declared and local to `programs/`. The runner always prepends `nc ae2 se3`; `pa` and program arguments come after the filename. `expectedExitCode` is a guard against accidentally capturing a broken probe as a successful fixture; the recorded exit code still comes from the actual Java process.

Each case has three golden files: `.stdout` and `.stderr` preserve raw output bytes, including empty output and trailing newlines; `.json` records the command, input SHA-256, schema version, and actual exit code. Buffers are compared directly without newline conversion, whitespace trimming, or decoding/re-encoding. The sole normalization replaces the absolute checkout root plus `/` with `<repo>/` in either stream. This makes diagnostic source paths reproducible across checkouts. It also affects a program that prints that exact prefix, so probes must not intentionally print an absolute checkout path. Relative paths, line numbers, columns, diagnostic wording, register formatting, and all remaining bytes are significant. The TypeScript consumer applies this same normalization to engine diagnostics and console output before comparison.

[golden/provenance.json](golden/provenance.json) records the exact Java runtime description, source input list, and aggregate SHA-256 of the Java sources plus assembler/settings/syscall resources. The checker requires JDK 21 and the same source hash; it compares actual behavior across JDK patch/vendor differences rather than requiring identical runtime branding. Source identifiers in provenance are relative to `_legacy-app/`, independent of the checkout layout. Method probes likewise resolve Java source/resource identifiers there, while `tests/` identifiers and the shared `MARSlicense.txt` remain repository-relative. This preserves the existing source hashes and captured behavior through relocation. The jar is rebuilt and not hashed because its archive timestamps vary. Build time and Git revision remain in the ignored legacy `BUILD_INFO`, not deterministic goldens.

## TypeScript core-program comparisons

Run `npm run test -- tests/core-programs.test.ts` from the repository root. The test constructs the production `Globals` machine and Venus `RunController`, reads only the case’s declared source buffers, assembles with the actual tokenizer/assembler/instruction set, and executes with the actual simulator and syscall registry. It does not provide substitute instruction execution, a replacement assembler, or a CLI implementation.

Nineteen of the 21 original cases are enabled and pass. The test compares exact console bytes for captures that separate program output, verifies empty program output for the other enabled fixtures, and compares captured diagnostic wording and source locations, assembly warnings, general/floating registers, raw memory words, and selected machine encodings. Instruction-count cases observe actual text reads using the Java launcher’s address-deduplication criterion. Runtime failures and maximum-step termination are checked through controller state. Expected snapshots are decoded from the original Java display in test code; launcher headings, process messages, and display separators are not browser output contracts.

Two cases are explicitly skipped: `program-arguments` because CLI/program-argument integration is excluded from the requested web port, and `seeded-random` pending the P4 random-service implementation and Java random-generator parity. `exit-status` remains enabled for GUI termination and console behavior: the original CLI capture has exit status 7, while canonical Swing `Exit2` ignores `$a0` and ends normally. The browser follows that GUI behavior and does not reproduce the launcher’s process exit code.

These comparisons establish the listed corpus behavior, not completion of every MARS feature. The separate class probes under this directory cover foundation units, memory, assembly/tokenization, statements/program lifecycle, instruction callbacks, simulator sequencing, undo, numeric runtime conversion, and implemented core syscalls. Deferred services and browser interaction require their own evidence.

## Coverage and extension

The initial corpus covers integer boundaries, signed and unsigned operations, HI/LO, shifts, register zero, directives and little-endian memory, sign-extending loads, macros, includes, pseudo-instruction expansion and rejection, default and delayed branches, console input/output, single-precision arithmetic and single/double bit representation and formatting, seeded random streams, heap allocation, program arguments, global `main`, assembly errors, runtime errors, exit codes, and step limits. Text-segment memory capture records selected machine encodings in addition to execution results. `me` cases separate program stdout from MARS diagnostics and register displays on stderr. The step-limit case uses `100`: `MarsLaunch` recognizes bare register numbers before parsing a step limit, so `5` requests register 5 instead of limiting execution to five instructions.

This is a first corpus, not exhaustive instruction coverage. Expand it alongside each ported class, preserving the original class names and algorithms. Backstep and observer events need a later direct engine/oracle harness because the CLI cannot expose them. Unseeded random, clock, sleep, dialogs, audio, host file I/O, tools, exception-handler entry, all instruction variants, special floating-point values, and browser behavior are not established by these fixtures. File syscall fixtures will need controlled scratch storage. The numeric expected values belong to the oracle output; this harness does not compute substitute results.

The probe programs and runner are newly authored test infrastructure, not translations of MARS source. The reference implementation remains copyright Pete Sanderson and Kenneth Vollmar under [MARSlicense.txt](../../MARSlicense.txt). The checked-in Java implementation is the behavioral authority for the MARS-ts 1.0 target. See the [backend port analysis](../../docs/backend-port.md) for the intended translation order and remaining evidence.
