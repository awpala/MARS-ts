# Runtime services

This module owns the service abstraction, service-number registry, and individual system-call algorithms from `_legacy-app/mars/mips/instructions/syscalls/` and `_legacy-app/mars/mips/instructions/SyscallLoader.java`. Each syscall remains a separate class with its canonical name, default number, register/memory effects, and diagnostic behavior. A session injects its own general and floating registers, memory, exception updates, `SystemIO` adapter, and family-owned services such as random streams, dialogs, and the tone generator; no process-wide state or browser UI is retained here.

## Organization

Each class and interface lives in its own source file. The module root owns the shared service abstraction and registry. The [host contract](SyscallHost.ts) separates session dependencies from the translated `AbstractSyscall` base, while the [registration contract](SyscallRegistration.ts) and [number override contract](SyscallOverride.ts) separate configuration from the translated `SyscallLoader`. These TypeScript contracts make the replacements for Java globals and classpath discovery explicit; consumers import each contract directly from its own module.

| Boundary                     | Responsibility                                                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module root                  | Shared service metadata/execution contract, abstract syscall base, injected session host, registration/override contracts, and service-number loader |
| [console/](console/)         | Console input/output services, including floating text conversion callbacks and integer display formats                                              |
| [heap/](heap/)               | Heap allocation through the session's memory model                                                                                                   |
| [termination/](termination/) | Normal simulation termination and GUI exit-status handling                                                                                           |
| [random/](random/)           | Random syscall algorithms, session-owned stream collection, and the Java-compatible generator                                                        |
| [dialogs/](dialogs/)         | Dialog syscall algorithms and their shared abstract base, using the injected dialog adapter                                                          |
| [midi/](midi/)               | MIDI tone services, their shared argument-validation base, and the session tone generator with its injected sound-host contract                      |

The folders partition the legacy syscall package by service responsibility; translated class names, service numbers, and algorithms remain unchanged. Random state and its generator stay with the random services, the shared dialog base stays with its subclasses, and `ToneGenerator` stays with the MIDI services, as it does in the Java package. Add a service to its semantic family and register its factory in the root loader. The root tests cover interactions across these families; this README documents the entire module.

## Class and interface relationships

Subgraphs follow the source-folder boundaries, with external engine collaborators grouped separately. Hexagons denote interfaces, rounded boxes denote abstract classes, and rectangles denote concrete classes. Rectangles listing several names group independent syscall classes by family; each relationship applies to every listed class. Solid arrows mean **extends**, thick arrows mean **implements**, and dotted arrows show labeled dependencies or references. Inheritance and implementation arrows point toward the base class or interface. Host references remain session-owned; they do not imply ownership by a syscall.

```mermaid
flowchart LR
  subgraph shared["syscalls/ (module root)"]
    SyscallLoader[SyscallLoader]
    SyscallRegistration{{SyscallRegistration}}
    SyscallOverride{{SyscallOverride}}
    Syscall{{Syscall}}
    AbstractSyscall([AbstractSyscall])
    SyscallHost{{SyscallHost}}
  end

  subgraph console["console/"]
    ConsoleOutput["SyscallPrintInt<br/>SyscallPrintFloat<br/>SyscallPrintDouble<br/>SyscallPrintString<br/>SyscallPrintChar<br/>SyscallPrintIntHex<br/>SyscallPrintIntBinary<br/>SyscallPrintIntUnsigned"]
    ConsoleInput["SyscallReadInt<br/>SyscallReadFloat<br/>SyscallReadDouble<br/>SyscallReadString<br/>SyscallReadChar"]
  end

  subgraph heap["heap/"]
    SyscallSbrk[SyscallSbrk]
  end

  subgraph termination["termination/"]
    Termination["SyscallExit<br/>SyscallExit2"]
  end

  subgraph random["random/"]
    Random["SyscallRandSeed<br/>SyscallRandInt<br/>SyscallRandIntRange<br/>SyscallRandFloat<br/>SyscallRandDouble"]
    RandomStreams[RandomStreams]
    JavaRandom[JavaRandom]
  end

  subgraph dialogs["dialogs/"]
    AbstractDialogSyscall([AbstractDialogSyscall])
    Dialogs["SyscallConfirmDialog<br/>SyscallInputDialogInt<br/>SyscallInputDialogFloat<br/>SyscallInputDialogDouble<br/>SyscallInputDialogString<br/>SyscallMessageDialog<br/>SyscallMessageDialogInt<br/>SyscallMessageDialogFloat<br/>SyscallMessageDialogDouble<br/>SyscallMessageDialogString"]
  end

  subgraph midi["midi/"]
    AbstractMidiSyscall([AbstractMidiSyscall])
    Midi["SyscallMidiOut<br/>SyscallMidiOutSync"]
    ToneGenerator[ToneGenerator]
    ToneGeneratorHost{{ToneGeneratorHost}}
  end

  subgraph collaborators[External engine collaborators]
    SimulationCode{{SimulationCode}}
    RegisterFile[RegisterFile]
    Coprocessor1[Coprocessor1]
    Memory[Memory]
    SystemIO[SystemIO]
    DialogIO[DialogIO]
    ProcessingExceptionHost{{ProcessingExceptionHost}}
  end

  Syscall --> SimulationCode
  AbstractSyscall ==> Syscall
  AbstractDialogSyscall --> AbstractSyscall
  ConsoleOutput & ConsoleInput & SyscallSbrk & Termination & Random --> AbstractSyscall
  Dialogs --> AbstractDialogSyscall
  AbstractMidiSyscall --> AbstractSyscall
  Midi --> AbstractMidiSyscall

  SyscallLoader -.->|reads factories| SyscallRegistration
  SyscallLoader -.->|applies overrides| SyscallOverride
  SyscallLoader -.->|manages instances| Syscall
  SyscallLoader -.->|supplies to factories| SyscallHost
  SyscallRegistration -.->|creates instances of| Syscall
  SyscallRegistration -.->|accepts| SyscallHost
  AbstractSyscall -.->|retains| SyscallHost

  SyscallHost -.->|references| RegisterFile & Coprocessor1 & Memory
  SyscallHost -.->|references| SystemIO & DialogIO & ProcessingExceptionHost
  SyscallHost -.->|references| RandomStreams
  RandomStreams -.->|owns streams| JavaRandom
  SyscallHost -.->|references| ToneGenerator
  Midi -.->|generate tones| ToneGenerator
  ToneGenerator -.->|delegates to optional| ToneGeneratorHost
```

## Runtime behavior and evidence

The implemented core families are console reads and writes (services 1–8, 11–12, and 34–36), heap allocation (9), and normal termination (10 and 17). Platform families add MIDI tones (31 and 33), random streams (40–44), and dialogs (50–59). Floating services require exact Java numeric runtime callbacks from `SystemIO`; there is no JavaScript decimal-printing fallback. Services 40–44 provide seeded/unseeded random streams, and 50–59 provide confirmation, numeric/string input, and message dialogs. GUI `Exit2` ignores the `$a0` exit status, as the original Swing application does. No command-line integration or process exit is ported.

`SyscallLoader` replaces Java classpath reflection with explicit factories that construct fresh session-owned services. It retains duplicate-class filtering, initial duplicate-number detection, case-sensitive override matching, applying every number override before the final collision check, lazy initialization, and last matching service lookup. The default registry contains all implemented services; absent file, time, and sleep services return null so `InstructionSet` raises the canonical unsupported-service exception. Register an additional translated class through this registry when its complete host contract and oracle tests exist. Configuration failures retain their diagnostic text and throw to the owning browser session instead of terminating the application process.

Input syscalls return promises; `SimulationCode` and the `InstructionSet` syscall callback propagate completion so the simulator waits before executing another instruction. Normal exit retains the original `ProcessingException` with no error list. Invalid input and address exceptions retain their original service-specific messages and CP0 updates. Single/double reads store raw floating bits, string reads preserve Java UTF-16-to-byte writes and newline/NUL rules, and integer arithmetic/addresses wrap to signed 32-bit words.

The [core service oracle](../../../../tests/oracle/core-syscalls/README.md) captures all implemented core services across deterministic input, output, allocation, raw-bit, memory, error, and exit cases. Additional focused tests exercise registry overrides, instance isolation, GUI input prompts, and suspension through the actual basic syscall instruction. File, time, and sleep families remain unimplemented.

`RandomStreams` ports the legacy static map as session-owned state, with the specified `java.util.Random` algorithm in `JavaRandom`. Each signed stream ID has an independent 48-bit `bigint` seed. Explicit service-40 seeds sign-extend the signed register value; unseeded streams consult host entropy only on first use. Bounded ints retain rejection sampling and the zero/negative-bound syscall exception. Float/double draws use the canonical 24-bit and 26+27-bit paths. Assembly, Reset, and Backstep do not rewind streams, matching Java; portable checkpoints retain internal seeds as exact JSON-safe numbers.

Each dialog service keeps its Java class name. `AbstractDialogSyscall` extracts the repeated byte-message and numeric-input algorithms from the ten legacy classes; the injected `DialogIO` replaces their direct `JOptionPane` calls. Integer input does not trim; floating input uses the exact Java numeric runtime. Cancel, empty input, parse failure, and string truncation retain distinct statuses. Strings retain low-byte UTF-16 writes, newline/NUL placement (including tiny/negative bounds), partial writes, and address exceptions through the existing CP0/handler path. Confirmation close returns -1. Message types use the actual 0–3 Java constants, with other values plain.

The [random and Swing dialog captures](../../../../tests/oracle/platform-syscalls/README.md) compare register/memory effects, exact diagnostics, displayed messages, and message types. Browser modal presentation, explicit Stop, and entropy sourcing follow [ADR 0014](../../../../docs/adrs/0014-random-and-dialog-syscalls.md); no Swing visual parity is claimed.

`ToneGenerator.java` holds three classes, which follow the module's one class or interface per file rule: `ToneGenerator` keeps its class, the package-private `Tone` becomes the validated `Tone` record, and the `ToneGeneratorHost` interface replaces `Tone`'s sequencer playback and the `EndOfTrackListener` wait, while `SyscallMidiOut` and `SyscallMidiOutSync` keep their Java names and service numbers. `AbstractMidiSyscall` extracts the argument validation that both Java classes repeat: `$a0`–`$a3` are read as signed 32-bit values, and an out-of-range pitch, instrument, or volume (outside 0–127) or a negative duration becomes 60, 0, 100, or 1000 before any byte conversion, so values with high bits set take the default rather than wrapping. Neither service writes registers. Each machine owns one `ToneGenerator`, which passes the validated `Tone` to an optional injected `ToneGeneratorHost` instead of opening a `javax.sound.midi` sequencer. MidiOut ignores the host's completion; MidiOutSync returns the host's promise, so the simulator suspends the current instruction until the host ends the wait. Without a host, tones are silent and MidiOutSync returns synchronously, as Java does without a MIDI device, without reproducing Java's stack trace. Host failures are swallowed as Java's tone code swallows its MIDI exceptions. The engine's stop listener calls the host release that ends a pending wait, so Stop and Pause apply at the syscall boundary immediately rather than after the tone. The browser's sine-wave host, autoplay preparation, timer-based waits, and voice limit belong to the [browser module](../../browser/README.md) and [ADR 0015](../../../../docs/adrs/0015-midi-web-audio-tones.md).

The [MIDI sequence captures](../../../../tests/oracle/platform-syscalls/README.md) record what the actual Java services request through a substituted output device: a program change and note-on at tick 0 and a note-off at tick `duration` on channel 0, at 1000 microseconds per tick of a resolution-1 sequence, so ticks are milliseconds. The [engine comparison](platform-syscalls.test.ts) checks every captured tone, default, register state, and synchronous/asynchronous return, together with the no-device path, host failures, and suspension and Stop release through the actual syscall instruction. Timbre and Java's sequencer latency are not parity targets.
