# Program and global symbols

This group owns label records and ordered symbol tables, porting `Symbol.java` and `SymbolTable.java` from [mars/assembler](../../../../../_legacy-app/mars/assembler/). Each source program receives a local table connected explicitly to its session's global table; the global table itself receives null. The [assembler passes](../README.md) own insertion timing, global transfers, address allocation, and forward-reference backpatching.

Names are case-sensitive and insertion order is preserved. Symbols retain label name, signed 32-bit `number` address, and data/text classification. Filtered and complete-list getters return new sequences sharing the existing symbol objects; callers must not mistake a copied list for cloned records. Clearing a table replaces its sequence.

| Operation             | Retained contract                                                                 |
| --------------------- | --------------------------------------------------------------------------------- |
| Add a label           | Append when unique; otherwise add the canonical mapped duplicate-label diagnostic |
| Name lookup           | Search the local table, then the explicitly supplied global table where requested |
| Address lookup        | Parse text with `Binary`, then return the first matching symbol                   |
| Filter/display access | Preserve insertion order and shared record identities                             |
| Relocation            | Repeatedly locate and update matching addresses using the original algorithm      |

The `NOT_FOUND` sentinel is `-1`, also a legal word address. A local label at `0xffffffff` can therefore fall through to global lookup. `fixSymbolTableAddress()` must not receive identical original/replacement addresses when matches exist: the retained Java loop would not terminate. These are observable compatibility constraints, not corrections introduced by this organization.

Optional debug messages go through an injected sink. Symbols own no browser navigation, source loading, memory, or instruction execution. [Program representations](../programs/README.md) and the session retain their respective table owners.

The [assembler unit fixture](../../../../../tests/oracle/assembler-units/README.md) covers insertion, ordering, lookups, diagnostics, and sentinel behavior. [Complete assembly](../../../../../tests/oracle/assembler-programs/README.md) compares real multi-file/global-symbol interactions. Extend label/table behavior here without changing scope precedence or record identity. Translated source retains Pete Sanderson and Kenneth Vollmar's [MIT attribution](../../../../../MARSlicense.txt), with no intended semantic divergence.
