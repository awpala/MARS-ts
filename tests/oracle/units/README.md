# Foundation method probes

These fixtures exercise the canonical Java utility and hardware classes directly, including contracts that the MARS command line cannot expose (observer ordering and register reset behavior). `Probe.java` is new test code outside the legacy tree. The capture runner compiles it against the jar produced by `build-legacy`, runs headlessly with the same fresh Java Preferences isolation used by `run-legacy`, and removes its temporary class/preferences directories. It requires Java and javac 21, rejects a jar older than any Java source or runtime resource, verifies the recorded build toolchain major, and limits each subprocess to 60 seconds. It does not invoke the MARS CLI or change its wrapper.

Run from the repository root:

```sh
build-legacy
node tests/oracle/units/run.mjs
node tests/oracle/units/run.mjs --check
npm run test -- src/lib/engine/hardware/foundation.test.ts
```

`foundation.json` stores the exact command template, empty stdin, stdout, stderr, exit status, and SHA-256 hashes of the probe and relevant canonical sources, plus a digest of all canonical Java sources and runtime resources. Jar freshness uses filesystem modification times; source digests additionally make changes visible in golden comparisons. Golden output is generated only by the runner. `--check` compares all recorded bytes and provenance without writing. The generic `captureProbe` export allows other class probes to reuse the same isolated execution without concurrent jar rebuilds; an outer gate rebuilds the jar first.

The fixture covers `Binary`, `DataTypes`, `Register`, register and memory access notices, `RegisterFile`, `Coprocessor0`, `Coprocessor1`, `AddressErrorException`, `Exceptions`, and all three `MemoryConfigurations` address tables. It pins word/long boundaries, parsing and classification quirks, numeric directive widths/ranges, ASCII formatting, duplicate/reverse observer behavior, silent reset, zero-register protection, PC wrap, HI/LO, raw float/double NaN payloads, pair access order, condition flags, exception cause masks/write order, and JDK BMP hexadecimal digit mappings. The TypeScript tests compare these values to the captured Java outputs and separately check session isolation and subscription teardown.

The port intentionally retains legacy quirks: `Binary.stringToInt("")` returns zero, decimal overflow wraps, and `isHex` fails to recognize negative hex because its legacy negative branch tests the wrong character. Negative hex may consequently be classified as octal. Raw floating-point payloads are preserved by register bit access; JavaScript numeric arithmetic can quiet signaling NaNs, so further arithmetic instruction probes remain necessary. No assembler or simulator execution parity is claimed by these method probes. Backstep integration, start-label resolution, and invalid register-index exception class equivalence remain untested against the oracle. The separate [memory probe](../memory-units/README.md) now covers sparse memory storage and its access contracts.
