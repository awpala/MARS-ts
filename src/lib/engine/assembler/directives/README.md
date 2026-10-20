# Directive and numeric data metadata

This group owns canonical directive identities/help and the sizes, limits, and range predicates used for numeric data. It ports `Directives.java` and `DataTypes.java` from [mars/assembler](../../../../../_legacy-app/mars/assembler/). The [assembler](../README.md) consumes this metadata when applying directives; tokenization and editor help also use canonical lookup/completion information.

`Directives` preserves declaration order, exact names, descriptions, lookup, and prefix behavior. Its identities are shared metadata rather than program-owned parser state. `DataTypes` retains storage widths and directive-specific range checks, including floating special values. A range predicate answers its original directive question; it is not a general numeric validator.

| Responsibility                                                     | Owner                                     |
| ------------------------------------------------------------------ | ----------------------------------------- |
| Directive identity, description, and completion                    | This group                                |
| Numeric width, bounds, and range predicates                        | This group                                |
| Token category selection and source position                       | [Tokenization](../tokenization/README.md) |
| Alignment, allocation, repetition, continuation, and memory writes | `Assembler`                               |
| Java-compatible numeric text conversion                            | [Formatting](../../formatting/README.md)  |

Integer values and addresses use signed 32-bit `number` conventions in consumers. Floating bounds use numeric values; raw 64-bit representation belongs to the consuming storage/conversion path. No mutable machine state or I/O lives in this group.

The [assembler unit fixture](../../../../../tests/oracle/assembler-units/README.md) covers exact metadata and lookups. The [foundation comparison](../../hardware/foundation.test.ts) covers widths and numeric ranges, while the [complete assembler corpus](../../../../../tests/oracle/assembler-programs/README.md) covers actual directive application and failures.

Extend metadata here when it belongs to the legacy directive/data contract. Keep executable directive processing with the existing passes. Source retains Pete Sanderson and Kenneth Vollmar's [MIT attribution](../../../../../MARSlicense.txt); no semantic divergence is intended.
