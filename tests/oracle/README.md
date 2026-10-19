# Java oracle fixtures

This directory owns deterministic inputs and captured behavior for the future TypeScript engine. The original Java implementation is the only producer of the goldens. The runner uses Node built-ins and the repository's isolated Java wrapper; it has no npm dependencies and implements no assembler or simulator behavior. No TypeScript engine consumes these fixtures yet, so a successful check establishes oracle reproducibility, not port parity.

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

Each case has three golden files: `.stdout` and `.stderr` preserve raw output bytes, including empty output and trailing newlines; `.json` records the command, input SHA-256, schema version, and actual exit code. Buffers are compared directly without newline conversion, whitespace trimming, or decoding/re-encoding. The sole normalization replaces the absolute checkout root plus `/` with `<repo>/` in either stream. This makes diagnostic source paths reproducible across checkouts. It also affects a program that prints that exact prefix, so probes must not intentionally print an absolute checkout path. Relative paths, line numbers, columns, diagnostic wording, register formatting, and all remaining bytes are significant. A future parity runner must apply this same normalization before comparison.

[golden/provenance.json](golden/provenance.json) records the exact Java runtime description, source input list, and aggregate SHA-256 of the Java sources plus assembler/settings/syscall resources. The checker requires JDK 21 and the same source hash; it compares actual behavior across JDK patch/vendor differences rather than requiring identical runtime branding. The jar is rebuilt and not hashed because its archive timestamps vary. Build time and Git revision remain in the ignored legacy `BUILD_INFO`, not deterministic goldens.

## Coverage and extension

The initial corpus covers integer boundaries, signed and unsigned operations, HI/LO, shifts, register zero, directives and little-endian memory, sign-extending loads, macros, includes, pseudo-instruction expansion and rejection, default and delayed branches, console input/output, single-precision arithmetic and single/double bit representation and formatting, seeded random streams, heap allocation, program arguments, global `main`, assembly errors, runtime errors, exit codes, and step limits. Text-segment memory capture records selected machine encodings in addition to execution results. `me` cases separate program stdout from MARS diagnostics and register displays on stderr. The step-limit case uses `100`: `MarsLaunch` recognizes bare register numbers before parsing a step limit, so `5` requests register 5 instead of limiting execution to five instructions.

This is a first corpus, not exhaustive instruction coverage. Expand it alongside each ported class, preserving the original class names and algorithms. Backstep and observer events need a later direct engine/oracle harness because the CLI cannot expose them. Unseeded random, clock, sleep, dialogs, audio, host file I/O, tools, exception-handler entry, all instruction variants, special floating-point values, and browser behavior are not established by these fixtures. File syscall fixtures will need controlled scratch storage. The numeric expected values belong to the oracle output; this harness does not compute substitute results.

The probe programs and runner are newly authored test infrastructure, not translations of MARS source. The reference implementation remains copyright Pete Sanderson and Kenneth Vollmar under [MARSlicense.txt](../../MARSlicense.txt). The checked-in Java implementation is the behavioral authority for the MARS-ts 1.0 target. See the [backend port analysis](../../docs/backend-port.md) for the intended translation order and remaining evidence.
