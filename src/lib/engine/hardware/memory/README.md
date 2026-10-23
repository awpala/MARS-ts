# Memory and address layouts

This group owns sparse MIPS storage, layout metadata and selection, address failures, and heap allocation. It ports `Memory.java`, `MemoryConfiguration.java`, `MemoryConfigurations.java`, and `AddressErrorException.java` from [mars/mips/hardware](../../../../../_legacy-app/mars/mips/hardware/). [Globals](../../Globals.ts) connects layout selection to register defaults and supplies real instruction decoding and program history. The [hardware guide](../README.md) describes those relationships.

## Storage and access

Memory keeps separate sparse tables for user/kernel data, descending stack, MMIO, and user/kernel text. Word blocks contain 1,024 entries. Data, stack, and text tables each have 1,024 block slots; MMIO has 16. Data tables allocate `Int32Array` blocks, while text tables retain actual statement references. Stack byte access keeps the original descending-address correction.

Addresses and values are signed 32-bit `number` patterns; double bits use signed 64-bit `bigint`. Default byte order is little-endian, and `setByteOrder` changes byte access without changing register-pair order. `setDouble` canonicalizes NaNs as Java does. `AddressErrorException` retains the signed address, MIPS cause number, and canonical hexadecimal diagnostic suffix.

| Access family                               | Contract                                                                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Byte, halfword, word, and general transfers | Preserve each operation's alignment, byte order, notifications, recording, and partial-boundary behavior                             |
| Raw word operations                         | Use separate range and notification paths; they are not universal substitutes for ordinary access                                    |
| Statement storage/fetch                     | Retain references in text and call the injected decoder for permitted word-based decoding, including self-modifying-code paths       |
| Null/block inspection                       | Distinguish unallocated storage where exposed; ordinary missing data reads produce zero                                              |
| Heap allocation                             | Return the prior heap address, round the new position to a word, and preserve negative-request, capacity, and Java-overflow behavior |

`MemoryStatement` describes only `getBinaryStatement()`. Production composition supplies real `ProgramStatement` objects and decoding through `InstructionSet`; the interface does not introduce a replacement program model. `getStatementNoNotify()` suppresses text-fetch notices, but permitted execution from data still follows the notifying data-read path.

## Configuration and clearing

Each collection constructs Default, CompactDataAtZero, and CompactTextAtZero layouts in canonical order. Identifiers select layouts for persistence; selection changes by object identity. Null or reselecting the current object is inert. A real change calls `onChange` after updating selection, leaving the owner to clear memory and update/reset `$gp`, `$sp`, and PC.

`Memory` receives that same collection. `setConfiguration()` copies values and clamps segment limits to table capacities. `clear()` additionally replaces storage and resets the heap while preserving byte order and observer records. Segment predicates retain their individual inclusive/exclusive conventions; configured MMIO membership excludes the highest kernel address.

Layouts are metadata, not a configuration dialog, and MMIO storage is not a device implementation. Change a live layout under its owner's idle-execution policy.

## Range observers and retained quirks

`addObserver` accepts all memory, one word address, or an inclusive range of word addresses. The all-memory form installs separate signed-address ranges. Ranges must be word-aligned and retain the legacy signed-order/crossing checks. Matching uses the access start address, including the final-word byte extension; it does not compute general interval overlap.

Memory traverses records in registration order. Duplicate registrations remain independent. Java's `deleteObserver` nulls callback references but retains inactive records, so `countObservers()` still counts them, and `deleteObservers()` discards all records; the oracle pins both. The teardown returned by `addObserver` has no Java counterpart. It stops notifying its registration at once and removes that registration's records, after the outermost dispatch in progress ends so traversal and the preserved `ConcurrentModificationException` check are undisturbed. A consumer that subscribes per mounted view therefore leaves no records behind for every later access to scan ([ADR 0006](../../../../../docs/adrs/0006-object-lifetime-management.md)). Inactive records receive no notice. Adding records during dispatch can raise the preserved `ConcurrentModificationException`; direct `notifyObservers()` is unsupported. Notification predicates and origin come from the host.

Other retained edge cases include a zero result when a byte read crosses into an unallocated block, no MMIO support in `getRawWordOrNull`, unusual negative-address alignment arithmetic, and signed heap overflow. These behaviors are not silently corrected by the group boundary.

## Evidence and extension

The [colocated comparison](Memory.test.ts) consumes every row of the [memory method fixture](../../../../../tests/oracle/memory-units/README.md), covering layouts, byte orders, sparse boundaries, heap, statements, observers, errors, and quirks. Local cases cover isolated instances, host callback receivers, notification suppression, unsubscribe, recording order, and decoder arguments. The [foundation suite](../foundation.test.ts) covers layouts and register defaults; [session comparisons](../../../../../tests/session/README.md) exercise production configuration changes.

Keep storage, address checks, and operation ordering cohesive in `Memory`. Extend its host only for services the storage algorithm consumes. Instruction semantics, device Tools, view paging, and program-owned undo policy belong elsewhere. Source retains Pete Sanderson and Kenneth Vollmar's [MIT attribution](../../../../../MARSlicense.txt), with no intended semantic divergence.
