# Register banks

This group owns session-local integer and coprocessor register storage. It ports `Register.java`, `RegisterFile.java`, `Coprocessor0.java`, `Coprocessor1.java`, and `InvalidRegisterAccessException.java` from [mars/mips/hardware](../../../../../_legacy-app/mars/mips/hardware/). The [hardware guide](../README.md) connects these banks to memory layouts, access notices, and session ownership.

## Banks and value contracts

| Bank              | State                                      | Special contract                                                                                      |
| ----------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| General registers | 32 named words, separate PC, HI, and LO    | `updateRegister` protects register zero; PC has separate initialization, update, and recording paths  |
| CP0               | Bad-address, status, cause, and EPC words  | Numeric updates can record restores; string updates retain read-before-write and no-backstep behavior |
| CP1               | 32 raw floating words and a condition word | Double pairs start at even registers; the odd high word is accessed first                             |

Words are signed 32-bit `number` values normalized on write. Pair bits use signed 64-bit `bigint`. CP1 owns its `DataView` scratch buffer, and numeric conversion does not replace raw storage. Odd pair access raises `InvalidRegisterAccessException`. Single-register setters, history-aware updates, and pair operations retain their distinct recording behavior; callers choose the operation required by the translated algorithm.

`Register` owns current value, reset value, and its observer set. `getValue()` notifies before returning, so an observer can affect the returned value; `setValue()` stores before notifying and returns the prior signed word. `getValueNoNotify()` is the inspection path. Objects returned by bank getters remain bank-owned, including those exposed through read-only sequences.

## Lookup, resets, and observation

`RegisterFile.getUserRegister()` tries numeric aliases before exact mnemonic lookup. The `Binary` candidate check skips guaranteed failures without changing parsing: `$08`, hexadecimal aliases, accepted BMP digits, and the bare-`$` zero alias retain legacy behavior. CP0's display-name lookup and CP1's exact-name/parsed-register methods keep their own contracts; they are not interchangeable parsers.

Individual resets are silent, but general-bank reset initializes PC and CP1 reset writes the condition word. CP0 resets its four registers silently. General aggregate subscriptions cover the 32 registers plus HI/LO and exclude PC. CP1 aggregate subscriptions cover its 32 floating registers and exclude the condition word. Display owners combine dedicated getters with controller revisions for values outside those subscriptions.

Observers run synchronously in reverse registration order over a snapshot. Callback identity is deduplicated within each register. Every subscription returns teardown; consumers release it when rebinding or disposing views. Event records and explicit access-origin values belong to [notices](../notices/README.md).

## Session integration and evidence

`RegisterFileHost`, `Coprocessor1Host`, and CP0 callbacks inject undo recording and access context. General-register initialization also consumes a [memory configuration](../memory/README.md) and optional validated start label. Recording callbacks must be closures or bound methods, be gated by enabled history, and return the old value where required. The banks do not own the backstepper or resolve symbols themselves.

The [foundation comparison](../foundation.test.ts) consumes the [Java foundation fixture](../../../../../tests/oracle/units/README.md). [Instruction](../../../../../tests/oracle/instruction-set/README.md), [backstep](../../../../../tests/oracle/backstep-units/README.md), and [session](../../../../../tests/session/README.md) comparisons cover integration. Raw NaN storage evidence does not imply arbitrary JavaScript arithmetic preserves every payload.

Add behavior here when it belongs to a bank's storage, access, lookup, or reset contract. Keep instruction arithmetic, exception dispatch, and display preferences with their existing owners. Source retains Pete Sanderson and Kenneth Vollmar's [MIT attribution](../../../../../MARSlicense.txt); no semantic divergence is intended.
