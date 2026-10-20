# Program lifecycle oracle

`ProgramProbe.java` exercises the unchanged `_legacy-app/mars/MIPSprogram.java` using the checked-in files under `sources/`. Run `node tests/oracle/program-units/run.mjs` to capture and add `--check` for byte-identical verification. The shared [probe runner](../units/README.md) requires a fresh legacy build and records all fixture/source hashes, stdout, stderr, exit status, and JDK major version.

The probe records uninitialized fields, empty and mixed-newline input, Unicode text, one-based source bounds, real tokenization and include expansion, source mapping and mutable list aliases, parsed-list replacement, macro-pool ownership, source-read failure, lexical failure after previous successful tokenization, and ten preparation combinations with lead identity, duplicate paths, and optional exception handlers. Paths are stable repository-relative fixture paths; capture never edits the legacy source or loads arbitrary user files.

`MIPSprogram.test.ts` uses the real ported Tokenizer, InstructionSet, hardware, and macro classes for these lifecycle cases. Additional unit checks verify assembly delegation, undo-history creation and failure invalidation, and simulator argument/stepping-mode forwarding using explicit test spies. Those delegate checks do not claim assembler or instruction-execution parity; their implementations and oracle evidence belong to the corresponding engine modules.

The browser adaptation injects current virtual-file/editor-buffer text instead of `FileReader`, preserves Java `BufferedReader.readLine` boundaries, and forwards execution through the session's asynchronous simulator. The caller supplies the list of programs to prepare; no directory scanning or command-line argument processing occurs here. Platform read-error text is injected; the oracle test uses the Java-equivalent error description. Source reads return complete text, so partial reads followed by an I/O error are not modeled by this browser buffer contract.

MARS is copyright Pete Sanderson and Kenneth Vollmar, MIT licensed; see [MARSlicense.txt](../../../MARSlicense.txt).
