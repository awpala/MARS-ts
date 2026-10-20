# Hardware access notices

This group owns immutable descriptions of register and memory access. It ports `AccessNotice.java`, `RegisterAccessNotice.java`, and `MemoryAccessNotice.java` from [mars/mips/hardware](../../../../../_legacy-app/mars/mips/hardware/). [Registers](../registers/README.md) and [memory](../memory/README.md) construct these records; subscribers consume them. Notices own no hardware, observer registry, scheduling, or teardown.

| Record                 | Payload                                                                 |
| ---------------------- | ----------------------------------------------------------------------- |
| `AccessNotice`         | Validated READ/WRITE discriminator and captured access origin           |
| `RegisterAccessNotice` | Register name and canonical read/write diagnostic text                  |
| `MemoryAccessNotice`   | Signed 32-bit address/value, byte length, and canonical diagnostic text |

Addresses and values are normalized `number` words. The memory constructor's three-argument form describes a four-byte access; its explicit-value form accepts a byte length. Register notices identify a name rather than snapshotting a value. No 64-bit `bigint` payload is added to these legacy word-access records.

## Origin and dispatch ownership

`AccessOrigin` is `gui`, `mips`, or `other`. Hardware obtains it from an injected callback and captures it when constructing a notice, replacing Java thread identity. GUI/MIPS queries inspect that value; notices retain no threads, components, or browser objects. Default origin is `other` when no context is supplied.

The publisher owns dispatch. Registers use reverse-order snapshots and identity deduplication; memory uses ordered range records with its own duplicate/removal rules. Shared records do not unify those algorithms into an event bus. Subscribers release the teardown returned by the publisher API they used.

The [hardware guide](../README.md) explains nonnotifying inspection and session context. [Foundation comparisons](../foundation.test.ts) cover payloads, origin queries, diagnostic text, and register notice order; [memory comparisons](../memory/Memory.test.ts) cover range dispatch and removal. Browser rendering should not generate simulated accesses.

Add a notice here when it represents a hardware access contract. Keep subscriptions with the publisher and mutations with the state owner. Source retains Pete Sanderson and Kenneth Vollmar's [MIT attribution](../../../../../MARSlicense.txt); explicit origin is the browser-neutral adaptation described by the [engine guide](../../README.md).
