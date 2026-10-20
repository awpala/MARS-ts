# Instruction translation comparisons

This group owns cross-module comparisons for extended-instruction metadata and template expansion. The production [instruction module](../../src/lib/engine/instructions/README.md) owns translation behavior; tests combine its host contract with the real tokenizer, registers, and symbol tables.

The [extended-instruction oracle](../oracle/extended-instruction-units/README.md) supplies metadata, operator names, and expansion observations. Shared [fixture helpers](../oracle/fixtures.ts) load and decode those captures; the suite retains its delayed-branch controls, symbol setup, and assertions. Basic instruction execution and decoding tests remain beside the production instruction module.

Add instruction-translation comparisons here when they cross those collaborators. Complete assembly belongs to [assembler](../assembler/README.md), and execution through the controller belongs to [session](../session/README.md). See the [test guide](../README.md) for validation commands and evidence rules.
