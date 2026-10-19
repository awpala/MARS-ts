# Memory method parity

This suite exercises the canonical `mars/mips/hardware/Memory.java` storage algorithms through their public API. `MemoryProbe.java` compiles against the unchanged Java oracle jar; the [shared method-probe runner](../units/README.md) captures exact stdout, stderr, status, source hashes, and JDK provenance with fresh preferences and subprocess timeouts. It never changes legacy code or expected output by hand.

```sh
build-legacy
node tests/oracle/memory-units/run.mjs
node tests/oracle/memory-units/run.mjs --check
npm run test -- src/lib/engine/hardware/Memory.test.ts
```

The TypeScript test consumes every Java output row. Coverage includes all three layouts and effective segment limits; both byte orders; raw words, words, halfwords, bytes, unaligned transfers, doubles, signed zero, and NaN canonicalization; sparse allocation and cross-block accesses for user data, descending stack, kernel data, and MMIO; segment/alignment error messages and partial accesses at table limits; bump-heap rounding, capacity failures, and signed overflow; text/kernel statement reference storage, self-modifying writes, data instruction fetch; dump/null-block scanning; negative-address alignment; and observer range validation, duplicate registration, order, removal, preservation across clear, signed address ranges, start-address-only matching, and concurrent registration failure.

The storage-facing `MemoryStatement` test double exposes only `getBinaryStatement()`. It is not an instruction decoder or simulator. The Java probe creates real `ProgramStatement` instances; the TypeScript suite verifies stored words, reference behavior, and calls into the injected decoding service. Instruction decoding and execution parity require the later `ProgramStatement` and `InstructionSet` ports. Separate local tests verify session isolation, host callback receiver preservation, notification suppression, unsubscribe behavior, backstep recording order, and decoder arguments.

Legacy behavior intentionally retained includes the zero result when a byte read crosses into an unallocated block, the absence of MMIO support in `getRawWordOrNull`, data-read notices from `getStatementNoNotify` when self-modifying code enables data execution, `countObservers()` counting inactive range records, and negative-address alignment's unusual arithmetic. Heap allocation also retains Java integer overflow rather than adding a new range rule. None is silently corrected by this translation.
