# Macro definitions and expansion state

This group owns program-local macro definitions, parameter substitution, overloaded lookup, local-label treatment, counters, and expansion history. It ports `Macro.java` and `MacroPool.java` from [mars/assembler](../../../../../_legacy-app/mars/assembler/). The [assembler](../README.md) recognizes definition/call locations and coordinates expansion; [tokenization](../tokenization/README.md) supplies tokens and mappings.

Each `MIPSprogram` owns its pool. A pool retains committed definitions, an optional active definition, a signed 32-bit expansion counter, and expanded/original call-line stacks. Macro substitution receives a signed 64-bit `bigint` counter. Definitions retain their owning program, source bounds, arguments, and local labels; register exclusions use the session's real register lookup services through `MacroRegisters`.

| Contract          | Behavior                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Parameters        | Preserve percent-prefixed and SPIM conventions and register-name exclusion                                               |
| Overloads         | Match case-sensitive name and argument count; retain the latest opening-line definition when otherwise matching          |
| Local labels      | Apply the original expansion suffix algorithm                                                                            |
| Substitution      | Replace the first textual occurrence according to the Java algorithm, rather than substituting by token character offset |
| Recursion/history | Track expanded and original call lines and retain canonical diagnostic call history                                      |

Repeated substitution can occur inside a label already suffixed during the same expansion. Pool counters wrap as Java integers. Call-stack getters preserve their mutable-reference contract, and empty-pop failures retain their translated ordering. Defining a new group does not make these objects immutable or convert expansion into a new token-rewriting algorithm.

`MacroProgram` describes only the source/history methods consumed by these classes. It is not a replacement program implementation. Definitions and pools own no filesystem, display, scheduler, or global machine state.

The [assembler unit fixture](../../../../../tests/oracle/assembler-units/README.md) covers macro operations and substitutions; [complete assembly](../../../../../tests/oracle/assembler-programs/README.md) covers real definitions, calls, recursion, and mapped failures. Extend macro-owned behavior here while keeping source scanning and pass coordination with their owners. Preserve Pete Sanderson and Kenneth Vollmar's [MARS attribution](../../../../../MARSlicense.txt) and the original macro contributor notices. No semantic divergence is intended.
