# Programs and statement representations

This group owns source/program lifecycle and the source/basic/machine representations used by assembly and execution. It ports [mars/MIPSprogram.java](../../../../../_legacy-app/mars/MIPSprogram.java) and [mars/ProgramStatement.java](../../../../../_legacy-app/mars/ProgramStatement.java). These classes live with the [assembler](../README.md) because they retain source, operands, and encodings; instruction execution remains with the simulator and instruction set.

## Program lifecycle

`MIPSprogram` owns its source filename/strings/maps, token lists, local symbols/macros, parsed and machine statements, undo history, and stepped-execution flag. Nullable getters preserve initialization states. Source reads use complete current virtual-file text with Java line-boundary rules; partial filesystem reads followed by I/O failure are not modeled by that browser host contract.

| Operation        | State/ownership contract                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read/tokenize    | Retain current source, original maps, tokens, and a local symbol table connected to session-global symbols                                        |
| Prepare files    | Read exactly the supplied list, preserve lead identity, and insert an optional exception handler first; the supplied filename list can be mutated |
| Assemble         | Delegate through the session factory; clear previous undo history before calling, replace machine results and create new history only on success  |
| Assembly failure | Preserve the prior machine-list reference when assignment does not complete, while history remains cleared                                        |
| Run/Step         | Forward current PC, breakpoints/limits, and action to the session's async simulator; retain the stepped-mode flag                                 |

A source-line list is retained by reference while plain source strings are separately snapshotted. Tokens and statement objects keep their documented reference relationships. The program does not discover directories or select unrelated editor tabs. The controller owns current-program assignment, invalidation, reset policy, and idle-execution enforcement.

## Statement encoding and display

`ProgramStatement` retains source text, source-stripped tokens, its instruction definition, a fixed operand array, and separately settable basic/machine forms. Words, operands, branch arithmetic, and addresses use signed 32-bit `number` conventions. It receives actual register/instruction lookup and display preferences through `ProgramStatementHost`; `StatementProgram` supplies local/global symbols and diagnostic mappings.

Encoding preserves mask insertion, branch offsets, jump-region validation and jump operand mutation. Decoding preserves unknown-word representation, unsigned non-branch immediates, and the original branch sign-extension rules. Source rebuilding appends printable elements as in Java; setters do not recompute unrelated representations. The operand array remains mutable, and out-of-populated-range access retains its sentinel behavior.

Printable elements distinguish an address from a value and render using current display settings. All four address/value base combinations are represented by the fixture. These representations do not execute instructions or choose an alternate decoder; production lookup comes from the session's [instruction registry](../../instructions/README.md).

## Integration, evidence, and extension

`MIPSprogramHost` injects source/path access, classification, assembler/history factories, register state, and simulation. The [session composition](../../Globals.ts) supplies real collaborators. Successful assembly creates program-owned history; the [controller](../../../venus/RunController.ts) must stop and await active execution before reset, replacement assembly, or disposal.

Colocated [program tests](MIPSprogram.test.ts) consume the [program lifecycle fixture](../../../../../tests/oracle/program-units/README.md); explicit delegate spies isolate forwarding and history ownership rather than claiming execution parity. [Statement tests](ProgramStatement.test.ts) consume the [statement fixture](../../../../../tests/oracle/statement-units/README.md), isolating descriptor selection to test encoding/decoding. [Complete assembly](../../../../../tests/oracle/assembler-programs/README.md) and [session comparisons](../../../../../tests/session/README.md) cover production collaboration.

Extend representation or lifecycle behavior here. Keep pass state with `Assembler`, instruction execution with the simulator/registry, and presentation workflow with Venus. Translated source retains Pete Sanderson and Kenneth Vollmar's [MIT attribution](../../../../../MARSlicense.txt); no semantic divergence is intended.
