# Assembler comparisons

This group owns oracle comparisons for directives, source and token structures, symbols, lexical classification, macros, operand matching, and complete assembly. The production [assembler](../../src/lib/engine/assembler/README.md) owns those algorithms; tests supply captured inputs, source adapters, and observable expectations.

Focused probes inject the Java-captured operator vocabulary where instruction lookup is outside the tested contract. Complete assembly constructs production `Globals` and uses its real tokenizer, instruction registry, and hardware. Preserve that distinction when extending a scenario rather than replacing every setup with one generic machine fixture.

The [oracle fixture helpers](../oracle/fixtures.ts) load the checked-in captures and decode their rows. Capture schemas and diagnostic projections remain local to the suites because their fields and comparison boundaries differ. Add assembler corpus comparisons here; keep instruction-template behavior in [instructions](../instructions/README.md) and controller execution in [session](../session/README.md). See the [test guide](../README.md) for validation commands and evidence rules.
