# Dump format oracle

This method probe calls the unchanged Java `DumpFormatLoader` and its six enabled writers, writes each result to a temporary file, and records its exact bytes as base64. The temporary files are deleted by the probe. `MIFDumpFormat` is not an enabled legacy format. The shared capture runner isolates Java preferences and records command, empty stdin, stdout, stderr, exit status, toolchain, and source hashes.

```sh
build-legacy
node tests/oracle/dump-units/run.mjs --update
node tests/oracle/dump-units/run.mjs --check
```

[DumpProbe.java](DumpProbe.java) covers all three layouts, the four address/value display-base combinations, assembled text with pseudo expansion and Unicode source, raw data boundaries and ASCII controls, binary byte order with both memory byte orders, populated segment bounds, an empty block, stopping at a missing instruction or allocation boundary, partial Segment Window rows, reversed ranges, and unaligned-address failures. Intel HEX checksums and EOF records are captured; offsets above 16 bits are not covered. The [TypeScript consumer](../../../src/lib/engine/dump/dump.test.ts) reconstructs the same machines and compares every row against [golden.json](golden.json). Expected bytes are generated only by this capture command.
