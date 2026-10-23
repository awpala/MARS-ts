# MARS-ts implementation guide

MARS-ts is a browser-hosted interpretation of MARS, the educational MIPS Assembler and Runtime Simulator. It translates the checked-in Java implementation into TypeScript and replaces Swing with a Svelte desktop interface. Its target release is **MARS-ts 1.0**. The original Java algorithms, instruction definitions, class responsibilities, and observable machine behavior remain the reference; browser storage, event handling, and scheduling provide the new environment in which they operate.

This document describes the **current implemented system**, including its established boundaries and limitations. It is not a declaration that every legacy feature has been ported or that the target release is complete. Core assembly, execution, and debugging are implemented and exercised against Java captures and browser scenarios. Platform-dependent syscalls, several configuration dialogs, Tools, and memory export remain unfinished. The [port plan](docs/adrs/0000-port-plan.md) governs intended scope; the [decision records](docs/README.md) explain consequential choices; module READMEs describe local contracts in greater detail.

Update this guide in the same change that adds a feature, ports a subsystem, changes persistence or ownership, or resolves a limitation described here. Keep the [README](README.md) as the short entry point, and keep test results tied to reproducible evidence rather than treating a historical passing run as a permanent guarantee.

The [deviation catalog](docs/deviations.md) records current user-impacting differences from final MARS 4.5 in UI and Engine subsets, with browser/platform adaptations separated from behavioral changes. [ADR 0012](docs/adrs/0012-deviation-baseline.md) defines its maintenance and eventual freeze at the 1.0 release cut. Pending features and behavior-preserving refactors are not catalog entries.

## Guide map

The chapters below follow the system from browser entry through machine behavior, source persistence, and verification. The architecture chapter establishes ownership; the workflow chapters explain the observable contracts that those owners preserve.

| To understand                                           | Start with                                                                                                                                                                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| How the familiar desktop becomes a browser application  | [Desktop interpretation](#the-desktop-to-browser-interpretation), including startup, native-operation adaptations, and Help                                                                                        |
| Which module owns state and behavior                    | [Architecture and module ownership](#architecture-and-module-ownership), including session lifetimes, numeric semantics, and memory                                                                                |
| How source becomes an executable program                | [Assembly](#assembly-source-text-to-machine-statements), then [execution, debugging, and host services](#execution-debugging-and-host-services)                                                                    |
| How source work survives edits, transfers, and reloads  | [Browser working filesystem](#the-browser-working-filesystem), including commit rules, renaming, recovery, and failure behavior                                                                                    |
| How the UI exposes commands and stores preferences      | [Editor and desktop presentation](#editor-and-desktop-presentation), then [configuration and persistence](#configuration-and-persistence)                                                                          |
| How to assess, build, and extend the implemented system | [Evidence and validation](#evidence-and-validation), [build and delivery](#build-development-and-delivery), [remaining scope](#remaining-scope-and-extension-rules), and [provenance](#provenance-and-attribution) |

## The desktop-to-browser interpretation

### Workspace and startup

The application opens directly into the main MARS desktop. Source editing and execution share the central workspace, Messages and Run I/O occupy the lower pane, and registers occupy the adjustable right pane. Familiar menus, toolbar actions, symbol inspection, memory inspection, and stepping remain the organizing model. The port preserves the useful desktop workflow while changing operations whose meaning depended on a native Java process.

During initialization, an accessible, continuously rotating loading spinner appears while saved sources, preferences, and the engine are restored. The desktop stays hidden until its restored pane layout has been measured, then appears automatically in its initialized form.

Engine startup builds and tokenizes the canonical instruction registry. Register lookup and token classification share a conservative integer-prefix check, avoiding repeated caught numeric-parsing exceptions for ordinary register names, operators, and directives. Numeric candidates still pass through the original full parser, including its Unicode and legacy fallback behavior; registry ordering and initialization remain unchanged.

### Native-to-browser adaptations

| Legacy responsibility                     | Current browser interpretation                                                                                                                        |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Java static machine globals               | One `Globals` instance per mounted IDE, with independent registers, memory, settings, programs, and simulator                                         |
| Swing windows and modal dialogs           | Svelte components and same-tab native HTML dialogs; no splash or intermediary launcher                                                                |
| Native source files and Save              | A localStorage source library containing complete source text; Save commits to that library                                                           |
| Unsaved editor buffers                    | A separate persistent recovery workspace, including full text and saved baselines                                                                     |
| Native Open                               | A same-tab picker over the local source library                                                                                                       |
| Moving source between the IDE and OS      | Explicit Import of `.asm` and `.s` files and Export downloads; no retained OS file handles                                                            |
| Assemble a directory                      | Assemble the active source and its explicit includes through the virtual source host                                                                  |
| SwingWorker and blocking input            | Cooperative asynchronous simulation through injected scheduling and input services                                                                    |
| Editor/Highlighting configuration dialogs | Bundled JSON presets selected by the application's editors; user display toggles remain available                                                     |
| Command-line launcher                     | Excluded from the web application; Java command-line execution remains development-only oracle infrastructure                                         |
| Application Print and Exit                | Printing uses the browser; Exit is omitted, and the confirmed Close All closes documents through the dirty-buffer workflow while leaving the IDE open |
| Raster toolbar imagery                    | SVG icons with retained attribution; the favicon remains the original MARS ICO                                                                        |

### Help and source examples

The Help dropdown opens individual articles for Introduction, Debugging, Settings, Syscalls, Exception Handlers, Macros, Tools, Limitations, Release History, and Acknowledgements, alongside the F1 overview and About MARS. The [Help module](src/lib/help/README.md) owns their catalog and content. Menu metadata, the overview, and About are available immediately; each longer article loads as a separate hashed asset when opened, with loading and failure feedback inside the dismissible dialog. Current-use articles describe implemented browser behavior; historical acknowledgements, release history, and Java extension instructions retain original credits and dates with explicit legacy context. The syscall reference marks each service’s availability and uses a bounded, independently scrollable table with fixed column headers. Long articles scroll inside the shared dialog, keeping its title and dismissal control visible. Code snippets offer clipboard copying with feedback and an action to open the exact snippet in a new editor source without replacing existing buffers; opening code is disabled during execution. Shared Clipboard variants own copy feedback and transfer controls; the Help attachment mounts and releases them while the workspace remains responsible for creating the new source.

These adaptations are specified in [ADR 0002](docs/adrs/0002-port-fidelity.md), [ADR 0003](docs/adrs/0003-browser-file-workflows.md), and [ADR 0004](docs/adrs/0004-cooperative-simulation.md). They do not authorize replacement assembly or simulation algorithms in the GUI.

## Architecture and module ownership

### Runtime composition

The shipped application is static HTML, CSS, JavaScript, and assets. SvelteKit prerenders the route; browser mounting creates the live desktop and machine. There is no application server storing source files or executing MIPS programs. Java is a development dependency for behavioral comparisons, not a browser runtime dependency.

```mermaid
flowchart TB
    subgraph Browser["Browser presentation and integration"]
        Route["Static SvelteKit route"] --> Desktop["VenusUI: renderer and context lifetime"]
        Desktop --> Components["Components: panes, tabs, menus, toolbar, dialogs"]
        Desktop --> State["Per-desktop state: workspace, simulation, preferences, search"]
        Commands["Typed desktop and command context"] -->|references| State
        Components --> Commands
        State --> Adapters["Browser adapters: sources, preferences, downloads"]
        Adapters --> Storage[("localStorage")]
        Adapters --> Files["OS file picker and downloads"]
        Components --> Files
    end
    subgraph Models["Framework-free application models"]
        Editor["Editor: buffers, history, highlighting"]
        Controller["RunController: desktop execution workflows"]
    end
    subgraph Core["Framework-free MIPS engine"]
        Engine["Globals: one composed MIPS machine"]
        Engine --> Assembly["Assembler and instruction registry"]
        Engine --> Hardware["Registers, coprocessors, sparse memory"]
        Engine --> Simulation["Simulator, exceptions, backstepping, syscalls"]
    end
    State --> Editor
    State --> Controller
    Controller --> Engine
    State -->|supplies| Host["Injected source, console, scheduling, and preference services"]
    Engine -.->|calls| Host
```

Arrows describe use or ownership relationships, not a complete import graph. In particular, the engine calls host interfaces; it does not import the browser implementations shown above it.

The [library architecture guide](src/lib/README.md) expands these relationships and their dependency boundaries. The [Venus guide](src/lib/venus/README.md) details UI composition, state ownership, command flow, and component lifetimes.

### Module responsibilities

| Module boundary                                                                                              | Responsibility and principal relationships                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Routes](src/routes/)                                                                                        | Prerender the application shell and mount the main desktop directly                                                                                                                                                                                                                                        |
| [Venus](src/lib/venus/README.md)                                                                             | The top-level `VenusUI.svelte` renders the layout and provides one desktop context; it mounts and releases the composed state lifetime                                                                                                                                                                     |
| [Venus components](src/lib/venus/components/README.md)                                                       | Group presentation by shell, controls, layout, editor, debugger, feedback, transfers, and dialogs; compose generic pane/tab shells, grouped commands, and snippets; retain element-local interaction state and cleanup while state owners retain workflows                                                 |
| [Venus state](src/lib/venus/state/README.md) and [keyboard hooks](src/lib/venus/hooks/README.md)             | Separate workspace/file workflows, simulation/input/scheduling, preferences/layout, and source search; coordinate explicit keyboard commands with component-lifetime cleanup                                                                                                                               |
| [Venus context](src/lib/venus/context/README.md) and [presentation utilities](src/lib/venus/utils/README.md) | Share root-owned command capabilities, and keep stateless rules grouped by responsibility: command and Settings catalogs, debugger table and Data Segment rules, DOM helpers, displayed error text, run-speed and run-outcome rules, geometry, and source labels, commit eligibility, and export filenames |
| [Help](src/lib/help/README.md)                                                                               | Own the Help menu catalog, overview/About content, and attributed articles adapted to current browser workflows; Venus opens them in the shared modal                                                                                                                                                      |
| [Editor](src/lib/editor/README.md)                                                                           | Own source buffers, names, selected tab, dirty state, saved baselines, and per-buffer undo/redo                                                                                                                                                                                                            |
| [Editor highlighting](src/lib/editor/highlighting/README.md)                                                 | Translate the legacy lexical token marker and paint source; consume instruction/directive metadata for presentation without assembling code                                                                                                                                                                |
| [Browser](src/lib/browser/README.md)                                                                         | Validate and persist sources/preferences, normalize virtual filenames, define the recognized assembly extensions and the stored view, tab, and memory-range vocabularies, and initiate downloads with resource cleanup                                                                                     |
| [Engine composition](src/lib/engine/README.md)                                                               | Compose `Globals` and settings, wire the actual translated collaborators, and replace Java global dependencies with session ownership                                                                                                                                                                      |
| [Assembler](src/lib/engine/assembler/README.md)                                                              | Own source preparation, tokenization, includes, equivalences, macros, symbol tables, directives, pseudo expansion, and statement encoding                                                                                                                                                                  |
| [Instructions](src/lib/engine/instructions/README.md)                                                        | Own basic and extended instruction definitions, decoding, ordered lookup, expansion templates, and basic execution callbacks                                                                                                                                                                               |
| [Hardware](src/lib/engine/hardware/README.md)                                                                | Own registers, coprocessors, memory layouts, sparse storage, access notices, and recording hooks                                                                                                                                                                                                           |
| [Simulator](src/lib/engine/simulator/README.md)                                                              | Own execution ordering, delayed branches, stop/breakpoint checks, exceptions, and grouped machine undo                                                                                                                                                                                                     |
| [Syscalls](src/lib/engine/syscalls/README.md) and [I/O](src/lib/engine/io/README.md)                         | Own translated runtime service algorithms and the injected console boundary; the host supplies platform interactions                                                                                                                                                                                       |
| [Formatting](src/lib/engine/formatting/README.md)                                                            | Preserve Java-compatible integer/binary/ASCII conversions and floating-point parsing/printing                                                                                                                                                                                                              |
| [Diagnostics](src/lib/engine/diagnostics/README.md)                                                          | Preserve source locations, macro/include history, diagnostic ordering, messages, and processing exceptions                                                                                                                                                                                                 |

`RunController` is framework-free even though it belongs to Venus: it translates the desktop Run action responsibilities and can be exercised by integration tests without rendering Svelte. It publishes state records and revisions; the machine remains the sole owner of registers and memory. Views read those objects rather than maintaining a second simulated state.

### Session and lifetime rules

Each desktop mounts one editor, one machine, and one run controller. Machine state is not a module singleton and is not created as shared SSR state. Immutable metadata may be shared, but mutable register banks, memory tables, symbol tables, instruction collaborators, and execution history belong to their session.

Hardware access notices are synchronous and preserve the observable Java ordering. Consumers receive unsubscribe functions. Inspection uses non-notifying reads where appropriate so painting a register does not masquerade as executing an instruction. An explicit access origin replaces dependence on Java thread identity.

A simulation retains ownership until its promise settles, including while it waits for input. Svelte teardown releases subscriptions and initiates controller disposal without blocking DOM removal. Disposal requests Stop and releases pending input and scheduler waits; the controller retains the old machine until its run settles asynchronously, then releases its resources. Reset and replacement assembly cannot race an active simulation. These rules are part of correctness, not merely UI cleanup.

[ADR 0006](docs/adrs/0006-object-lifetime-management.md) records the ownership and lifetime audit, including browser resource release, operation-specific validity checks, and the distinction between isolated runtime objects and origin-wide persistence. Its browser regressions exercise superseded imports, delayed clipboard mutations, source creation, pending work across unmount, and repeated mounting.

### Java behavior on JavaScript numbers

MIPS words use signed 32-bit `number` values with explicit wrapping. Addresses may therefore be negative as stored Java integers; unsigned ordering and display conversions are applied where the canonical behavior requires them. Exact 64-bit arithmetic and bit patterns use `bigint`, including multiplication/HI-LO operations and floating-register pairs. Floating registers retain integer bits, with instance-owned conversion scratch space.

The translation preserves integer overflow, shift masking, signed versus unsigned comparisons, single-precision rounding, floating cast saturation, raw-bit operations, and observable register-write order. Java floating text conversion requires its own compatibility implementation: JavaScript's ordinary parsing and printing are not substituted for the Java contracts. The formatting module uses exact arithmetic and nearest-even rounding, including direct rounding to float precision. JDK-generated character metadata preserves the character classifications consumed by assembly and highlighting. These semantics are checked with focused oracle probes rather than inferred from the similarity of the two languages.

### Machine storage and address spaces

The hardware module models the general registers, HI/LO, PC, exception coprocessor, floating coprocessor, and its condition flags. Register zero retains its architectural write restriction. Floating doubles use paired registers with the canonical low/high-word arrangement and access order. Exception handling updates CP0 cause, EPC, status, and bad-address state through the translated exception collaborator.

Memory uses sparse block tables rather than allocating a browser array for the entire address space. User/kernel data, descending stack, memory-mapped I/O, and user/kernel instruction storage retain their distinct legacy responsibilities. Text storage holds real statement references; self-modifying-code paths obtain decoded statements through the session's actual instruction decoder. Default byte order is little-endian. Alignment, address-range failures, heap allocation, and observable access notices belong to memory, not the Data Segment view.

The hardware boundary groups [register banks](src/lib/engine/hardware/registers/README.md), [memory and layouts](src/lib/engine/hardware/memory/README.md), and [access notices](src/lib/engine/hardware/notices/README.md) by their ownership. State publishers retain their distinct subscription algorithms; immutable notice records do not introduce a common event bus. Configuration selection stays with memory metadata while the session callback applies its register-reset effects.

The engine retains the Default, CompactDataAtZero, and CompactTextAtZero configurations. In the default layout, user text begins at `0x00400000`, static `.data` at `0x10010000`, and the heap at `0x10040000`; `$gp` initializes to `0x10008000` and `$sp` to `0x7fffeffc`. Configuration changes clear storage and reset the relevant register defaults through the session owner. The configuration dialog remains unfinished. Having an MMIO address region likewise does not mean the deferred device Tools have been implemented.

## Assembly: source text to machine statements

### Source selection and includes

Assemble reads the current source text, including unsaved edits. It assembles the active source and its explicit `.include` directives. Other open tabs are not automatically assembled; the assemble-all UI has been removed and its saved preference is reset on desktop initialization. Source resolution prefers open buffers and then committed local-library records. A library source can satisfy an include without being an open tab. There is no native directory scan or network source discovery.

### Preparation and assembly pipeline

```mermaid
flowchart TB
    Sources["Open buffers and committed library"] --> Host["Injected virtual-source reader"]
    Host --> Programs["MIPSprogram preparation and source mapping"]
    Programs --> Tokens["Tokenizer: includes, literals, eqv, token classification"]
    Tokens --> Pass1["Assembler pass 1: labels, directives, macros, symbols, data"]
    Pass1 --> Pass2["Assembler pass 2: pseudo expansion and encoding"]
    Registry["InstructionSet and canonical pseudo templates"] --> Tokens
    Registry --> Pass2
    Pass2 --> Results["ProgramStatement machine list and initialized memory"]
    Programs --> Errors["Source-mapped diagnostics"]
    Tokens --> Errors
    Pass1 --> Errors
    Pass2 --> Errors
    Results --> Execute["Execute pane and Simulator"]
```

The assembler follows the original multi-pass algorithms. Tokenization retains original and expanded positions, include processing, character literal handling, and recursive `.eqv` substitution. Program-owned macro pools retain overloads, parameter conventions, expansion counters, recursion detection, and local-label treatment. Local and session-global symbol tables remain distinct. Directives allocate and initialize data, enforce their canonical range checks, transfer global symbols, and resolve forward references.

The assembler root retains pass orchestration and operand matching, with [tokenization](src/lib/engine/assembler/tokenization/README.md), [directive metadata](src/lib/engine/assembler/directives/README.md), [symbols](src/lib/engine/assembler/symbols/README.md), [macros](src/lib/engine/assembler/macros/README.md), and [program/statement representations](src/lib/engine/assembler/programs/README.md) grouped by responsibility. Consumers import their owners directly. The character-table capture runner targets the tokenization group's generated data; oracle formats and expected values remain unchanged.

### Instruction and statement contracts

The instruction registry contains the translated **155 basic registrations and 388 pseudo definitions** in canonical order. Basic instruction descriptors supply syntax, masks, formats, and simulation callbacks. Extended instructions use the original ordered template substitutions and compact/delayed-branch alternatives. The bundled pseudo-operation data is tested against the unchanged `_legacy-app/PseudoOps.txt`; it is not a second manually maintained instruction language.

`ProgramStatement` owns source/basic/machine representations, operand resolution, encoding, and decoding. Diagnostics retain source filenames, positions, include mappings, macro history, warning policy, and canonical text. The UI displays those diagnostics rather than generating its own interpretation of an assembly error. Failures retain the engine's tested mutation and lifecycle behavior; callers must not assume assembly is a transactional operation that leaves memory untouched on error.

### Invalidation, reset, and evidence

A successful assembly initializes the execution view and undo history. Editing source invalidates the executable program until another assembly. Reset reassembles the retained tokenized programs under the previous assembly policy, restoring initialized memory and registers; it is distinct from assembling newly edited text.

The [complete assembly corpus](tests/oracle/assembler-programs/README.md) compares 603 assemblies, including instruction examples and focused success/error cases. Smaller probes separately isolate tokenizer, operand selection, statement encoding, macros, diagnostics, and program lifecycle. Catalog coverage does not imply every possible combination of operands and directives has been tested.

## Execution, debugging, and host services

### Cooperative execution and input

`Simulator` runs the translated instruction loop against the session's real memory and register banks. It preserves fetch and dispatch behavior, exceptions, delayed-branch transitions, stop reasons, breakpoint checks, and instruction limits in the canonical order. The GUI issues commands through `RunController`; it does not execute an approximation of MIPS itself. Breakpoint checkboxes and the Toggle/Clear all breakpoints actions stay available at every finite speed, including while a program runs: `SimulationState` forwards each change through `RunController` to `Simulator.updateBreakpoints`, which replaces a running Go's sorted list for its next breakpoint check, while a pending Step keeps its step-limit result. Finite speeds act as a debugger run and unlimited speed as a plain run, although the UI keeps MARS's single speed control. While the speed is unlimited, `DesktopState.breakpointsFrozen` disables those controls and their shortcuts whether or not a program runs, and keeps the current breakpoints in force. Tooltips on the locked controls advise lowering the run speed, and lowering it unlocks them immediately. Legacy MARS read breakpoints only when Go started; this extension is recorded in [ADR 0011](docs/adrs/0011-in-flight-breakpoints.md).

The current browser implementation runs cooperatively on the main thread. The injected scheduler yields initially, between bounded batches at unlimited speed, and for the selected delay at limited speeds. This lets the browser process input, redraw, and request Pause or Stop. No Web Worker is currently used. The legacy speed control retains its 41 positions, with positions 36–40 treated as unlimited.

```mermaid
sequenceDiagram
    participant View as Venus desktop
    participant Control as RunController
    participant Sim as Simulator
    participant Code as Instruction and syscall
    participant Host as Browser host
    View->>Control: Go or Step
    Control->>Sim: Start owned execution
    Sim->>Host: Yield through injected scheduler
    Host-->>Sim: Resume
    loop Until a canonical stop condition
        Sim->>Code: Fetch and execute instruction
        opt Input syscall
            Code->>Host: Request console or modal input
            Host-->>Code: Resolve input text
        end
        Code-->>Sim: Instruction completes
        Sim->>Sim: Apply ordered execution checks
    end
    Sim-->>Control: Completion reason or diagnostic
    Control-->>View: Publish state and revision
```

Input does not allow a subsequent instruction to overtake the pending syscall. Pause/Stop can release a pending read; the syscall still completes and the simulator performs its canonical checks. The current input text is returned on cancellation, preserving numeric parse errors when that text is invalid rather than silently converting cancellation into a valid value.

### Debugger behavior

| Action or view          | Current behavior                                                                                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Go / Step               | Run from the current PC, or execute one machine instruction                                                                                                                                                                                                                     |
| Pause / Stop            | Request interruption through the simulator's owned operation and release pending input                                                                                                                                                                                          |
| Backstep                | Restore the latest grouped instruction changes through the program's `BackStepper`                                                                                                                                                                                              |
| Reset                   | Reassemble retained program representations and reset initialized machine state                                                                                                                                                                                                 |
| Breakpoints             | Address-based selections in the Text Segment; suspend all without losing addresses, or clear all; editable at finite speeds (including during Go), locked at unlimited speed                                                                                                    |
| Registers               | Inspect integer, CP0, CP1, and condition state; Name cells describe legacy register roles on hover; permitted edits affect the actual machine while stopped; condition flags stay clickable during execution, as in MARS, with port-specific Select all and Select none actions |
| Floating register edits | Accept decimal input through Java-compatible conversion or exact hexadecimal bits                                                                                                                                                                                               |
| Text Segment            | Show encoded/basic/source statements, current execution location, and source navigation (the whole Source cell is the link)                                                                                                                                                     |
| Data Segment            | Show 16 address rows per page, navigation/range selection, and decimal/hexadecimal/ASCII views; permit word editing while stopped                                                                                                                                               |
| Labels                  | Filter Data/Text symbols, sort by Label or Address, and click either cell to reveal and focus the corresponding instruction or memory word                                                                                                                                      |

The Execute pane composes three panes inside the shared SegmentPane frame, each porting the view of its legacy window: Text Segment (`TextSegmentWindow`), Labels (`LabelsWindow`), and Data Segment (`DataSegmentWindow`). One model per mounted Execute view carries what those windows exchange in the legacy application: navigation from a label to its instruction and memory word, address and word formatting in the selected bases, display-only memory reads and edits, write observation, and revealing the selected label. The desktop still owns every persisted value (label selection, Data Segment range and page, display bases, label filters and sort state, the argument draft, and the Data Segment height) and the Execute view's panes and model read and write those values on the owners through the desktop context, while the root supplies only the machine, controller, and snapshot; the model holds only transient highlight state. Register and memory write following read the run controller's observation flag, so opening Execute during a stepped or timed run follows writes immediately. Register hover text lives beside the register banks pane.

The Text Segment heading stays above its independently scrolling instruction table, matching the other Execute sub-panel titles. During execution or stepping, the Text Segment holds the opening page through its last fully visible instruction. Subsequent PC moves center the current row vertically below the sticky column headings, including backward moves. Near either end of the program, scrolling clamps to the first or last page rather than adding blank rows. Assembly and Reset restore the opening-page behavior. Tracking scrolls only the instruction pane and preserves horizontal position and keyboard focus. Assembly and Reset clear data and register write highlighting and restore the first `.data` page. Single-step and timed execution observe writes; unlimited Go and manual edits do not introduce execution highlights. Observed stores and backstep writes reveal and center the destination word without changing label selection or keyboard focus. Register banks retain independent highlights and select the receiving bank for observed writes. Backstep retains the undone instruction's delay-slot display context. Self-modifying changes to assembled text still reveal the changed word when ordinary data-write observation is off, including manual Code edits and unlimited execution. Memory paging clamps to the legacy user/kernel address boundaries. Completion retains the last executed instruction highlight until backstep, assembly, or Reset changes the execution location; errors retain the faulting instruction. The exact stop address is saved in the browser checkpoint and restored without guessing from the next PC. Simulator stop notices provide the actual executed address, including when a jump falls off text, rather than assuming the preceding architectural PC is the instruction that ran. Read-only string and input/output syscalls do not introduce a memory highlight.

Mars Messages and Run I/O automatically scroll to the latest line when their displayed output changes, including when switching tabs. From anywhere in the app, Ctrl+L clears the selected output and Alt+L / Option+L clears both outputs; these shortcuts preserve the selected tab and pending input.

Backstepping uses bounded history and restores recorded machine changes with recording temporarily disabled. Desktop recovery persists that bounded history with the machine checkpoint; Backstep itself does not reverse browser side effects: source editing history is a different subsystem, and already-emitted console text is not an external transaction that the machine can retract.

### Implemented syscall boundary

| Family                                           | Services                    | Implementation                                                                     |
| ------------------------------------------------ | --------------------------- | ---------------------------------------------------------------------------------- |
| Console integer, float, double, string           | 1–8                         | Print/read through session `SystemIO` and injected host callbacks                  |
| Heap allocation                                  | 9                           | Allocate through session memory                                                    |
| Termination                                      | 10, 17                      | Canonical GUI termination; Exit2 does not set a browser/process exit status        |
| Character output/input                           | 11–12                       | Preserve Java character/UTF-16 behavior and memory truncation rules                |
| Integer display formats                          | 34–36                       | Hexadecimal, binary, and unsigned decimal output                                   |
| File, time, sleep, random, MIDI, syscall dialogs | Remaining platform families | Deferred; unavailable services produce the canonical unsupported-service exception |

The optional popup-input preference changes the presentation of the implemented console reads. It does **not** mean the separate MARS dialog syscall family has been implemented. Likewise, the editor's source library is not an implementation of runtime file-descriptor syscalls.

`SyscallLoader` uses explicit per-session factories instead of Java reflection. Service-number overrides and collision checks remain its responsibility. New services must bring their actual algorithm, host contract, and oracle evidence; a browser placeholder does not count as a port.

## The browser working filesystem

### Virtual names and storage boundaries

The working filesystem is a named collection of source texts in localStorage. A virtual filename is an identity and include-resolution path, not an OS file handle. Import and Export are explicit transfers across that boundary. Virtual names are relative, normalize separators and dot segments, and cannot escape the library root.

The Open dialog lists existing sources in case-insensitive lexicographic filename order, with exact spelling as a deterministic tie-breaker. This is a presentation ordering; it does not reorder committed records or existing editor tabs.

Two separate records prevent manual saving from conflicting with recovery:

- **Committed library:** complete saved text under each virtual name. Open and include lookup use these records when there is no corresponding open buffer.
- **Recovery workspace:** complete current text for every open buffer, its last saved text, new-file state, and selected-tab flag. This protects uncommitted and never-saved work without implicitly committing it.

```mermaid
flowchart TB
    Import["Import selected OS .asm and .s files"] --> Library[("Committed source library")]
    Library --> Open["Open picker"]
    Open --> Buffers["Editor buffers: current source and saved baseline"]
    Buffers -->|"Every source or tab change"| Recovery[("Recovery workspace")]
    Recovery -->|"Restore and reconcile on mount"| Buffers
    Buffers -->|"Save, Save All, Save As, or enabled Auto Save"| Library
    Buffers -->|"Current text"| Export["Export downloads"]
    Library -->|"Also included by Export All"| Export
    Buffers -->|"First lookup choice"| Assembly["Assembly source host"]
    Library -->|"Fallback lookup"| Assembly
```

### Commit and transfer semantics

| Operation                | Effect                                                                                                                                                                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New                      | Create a uniquely named open buffer, preserving other tabs; recovery includes its source before any explicit Save                                                                                                                                                                         |
| Open                     | Select one or more library sources, individually or with Select all / Select none; an already-open name focuses its existing buffer and preserves edits                                                                                                                                   |
| Save                     | Commit the current source; a new file prompts for its name; only successful persistence updates the saved baseline                                                                                                                                                                        |
| Save All                 | Process the open buffers, resolving new filenames as needed; cancellation preserves remaining work                                                                                                                                                                                        |
| Save As                  | Commit current text under another name while retaining the old saved record by default                                                                                                                                                                                                    |
| Rename toggle in Save As | Display the old filename, then remove that identity and save the new one in the same library write                                                                                                                                                                                        |
| Inline source-tab rename | Double-click the filename or press F2 on its focused tab; submit through the same rename workflow with Enter or by moving focus, or cancel with Escape                                                                                                                                    |
| Auto Save                | Initially off; enabling it commits all changed open buffers, and later source changes commit automatically when text differs                                                                                                                                                              |
| Delete in Open           | Confirm the selected names and any unsaved-buffer loss, then remove records and close matching tabs; cancellation preserves selection and content                                                                                                                                         |
| Import                   | Read one or more `.asm` or `.s` files (any letter case) with the system picker, commit a batch, and open them; refuse other extensions, confirm saved-name replacement, and refuse to overwrite edited open buffers                                                                       |
| Export                   | Download current buffer text, keeping a recognized `.asm` or `.s` extension in lowercase and giving other names `.asm`, without changing dirty state or saved baselines                                                                                                                   |
| Export All               | Enabled when saved sources or open buffers exist; download `mars-asm-src-files.zip` containing the union of library sources and open buffers as flat entries named by the Export rule, preferring current open text and numbering repeated flattened names from `-2` before the extension |
| Close / Close All        | Resolve dirty buffers through Save, Discard, or Cancel; Close All, in the File menu and as the toolbar button after Open, first asks for confirmation and closes documents, not the browser tab                                                                                           |

The recognized assembly extensions are `.asm` and `.s`, following the legacy `Extensions = asm  s` setting and the case-insensitive extension match of the Open dialog's "Assembler Files" filter ([ADR 0003](docs/adrs/0003-browser-file-workflows.md)). The native picker offers both, and a selected file with another extension is refused with "Import accepts .asm or .s source files." without changing the library. Export keeps a recognized extension so a `.s` source imports back as `.s`.

### Inline rename and name validation

Source-tab renaming delegates to the workspace's existing Save As Rename persistence path. A valid submission commits the current source under the requested identity, updates the tab label immediately, and retains the source buffer and its editing history. The inline input accepts Enter or moving focus as submission; Escape restores the displayed name without submitting.

Renames require a nonempty basename with an `.asm` or `.s` extension (any letter case) and must satisfy the virtual-path rules. An invalid name, malformed extension, or name already owned by another open buffer opens a warning modal and restores the most recent valid filename without changing the current source. A collision with a closed saved source retains the existing Replace confirmation; it is not silently overwritten. Persistence failures remain recoverable errors and do not mark uncommitted work as saved.

### Recovery and reconciliation

New empty buffers are retained in workspace recovery but are not committed as library files until they contain at least one character, even with Auto Save enabled. Save and Save All also skip new empty buffers. Previously saved sources can still be emptied and saved.

Recovery writes occur synchronously after source/tab changes in both manual-save and Auto Save modes. Loading or selecting a restored tab does not commit it. Clean restored buffers reconcile with newer committed text. If an older dirty recovery buffer conflicts with newer saved text, both versions remain intact and Auto Save is disabled with a visible notice.

### Storage failures and recovery limits

Source record validation rejects malformed structures and duplicate identities. Library writes first read the latest collection so unrelated saved sources survive; batch import and rename update their library record in one storage write. This is not a multi-tab transactional database: there is no distributed lock, collaborative editing protocol, or atomic transaction spanning the library and recovery keys.

Quota errors, denied storage, and corrupt source records are surfaced instead of marking unsaved text as saved. A malformed recovery record is preserved rather than overwritten during failed restoration. Preferences can fall back to in-memory behavior, but that does not guarantee source persistence when storage is unavailable. Storage belongs to the browser origin and profile; clearing site data removes it. Export creates a portable copy independent of that storage, and browsers may require permission for multiple downloads.

The source/workspace records do not contain undo history, breakpoints, or machine state. The separate desktop-session record described below restores matching editor history and stable execution checkpoints. Pending runtime input and actively running execution are never resumed across reloads.

## Desktop session recovery

[ADR 0007](docs/adrs/0007-desktop-session-recovery.md) defines recovery from incidental page/tab reload or browser restart on the same origin. A per-desktop persistence owner reads validated browser recovery after source restoration and machine initialization, before enabling writes and revealing the IDE. It restores the selected Edit/Execute view, register and message tabs, source caret/viewport, matching editor undo/redo branches, Data Segment range/page, breakpoints and suspension, both console buffers, and an independent loaded program with its selected label. Existing source/library, engine-setting, and display/layout adapters keep their established responsibilities.

The stable execution record captures original source dependencies, settings, memory layout, allocated raw memory and live text, heap/byte order, all register banks, floating condition bits, PC, delayed branches, external interrupt state, execution status, and bounded Backstep groups. Restoration assembles captured sources for metadata and Reset, then silently applies the checkpoint. It never runs instructions or replays console output. Choosing another Edit tab does not replace the loaded program. Failed assembly clears executable recovery but retains error status and diagnostics.

Running execution and pending input retain the preceding stable checkpoint and corresponding console text. Reload returns to that checkpoint rather than resuming an in-flight instruction, syscall, or timer. Normal presentation changes save independently. Quota/access failures leave current work usable and show a recovery error; malformed records fall back to ordinary source/preferences restoration. Browser storage is local to the origin/profile and uses last-writer behavior across concurrent tabs; it provides no cross-device synchronization. Transient confirmation dialogs and external operations are not resumed.

## Editor and desktop presentation

### Messages and console output

The bottom output panel provides Clear for the currently selected output and Clear All, immediately to its right, for both Mars Messages and Run I/O. Clearing output does not reset the machine or discard pending input. Program console text, including echoed input and the Reset and run-completion notes, is appended through one path that keeps only the most recent characters up to the engine's message-buffer limit.

### Source editing, highlighting, and hover help

The editor controller manages buffers and history; it does not parse or assemble MIPS. Its native textarea owns caret, selection, keyboard input, clipboard interaction, and the accessible editing surface. Escaped, noninteractive text spans paint syntax behind it with matching font metrics and scrolling. Forced-colors mode falls back to native visible text. The overlay does not alter source text.

The highlighting module translates the legacy token marker, including keyword boundaries, labels, literals, comments, macro parameters, and invalid tokens. UTF-16 offsets match the source model. Hovering instruction or directive tokens displays syntax examples and descriptions from the actual engine metadata; comments, strings, and labels do not masquerade as opcode help. This hover feature is distinct from the still-unimplemented instruction popup completion workflow.

### Pane geometry, dialogs, and pointer feedback

The source/messages split has a horizontal resize bar; the register sidebar has a vertical width divider; Execute has a horizontal bar between the Text Segment row and the Data Segment, which resizes the Data Segment from above. All support pointer and keyboard adjustment and persist their dimensions. A compressed Data Segment keeps its heading, column headings, and controls visible and scrolls the remaining address rows vertically; expanding it to the full table returns to natural sizing.

Menus dismiss on outside click or Escape. Same-tab dialogs contain focus, dismiss through their supported actions or backdrop, and restore focus afterward. Modal renders the shared shell; [dialog variants](src/lib/venus/components/dialogs/README.md) compose workflow-specific content with shared field and action snippets. The desktop dialog coordinator selects workspace variants through a typed registry while state owners retain the workflows.

A generic Pane renders sized layout regions; TabbedPane combines it with tab selection, and debugger Text Segment, Labels, and Data Segment use it through one shared SegmentPane frame, a heading band with optional trailing actions. Registers and Messages compose the same container through TabbedPane, retaining their own table scrolling and domain content.

The Labels heading includes a compact SVG Close icon button that clears the same persisted Show Labels Window setting used by the toolbar and Settings menu. Source tabs and Labels share the close-button component's theme-aware hover styling and tooltip; its fixed size preserves equal Labels and Text Segment heading heights, and hiding Labels preserves its filters, sorting, and selected label.

The controls group supplies native Button semantics and optional tooltips to IconButton (toolbar actions, close affordances, and compact pane controls), menu commands, dialog actions, console Clear/Clear All, transfers, debugger actions, and tab triggers. Its existing generic tab strip handles both pane and source-document variants; layout shells compose it, while source tabs retain rename and focus behavior. Source-tab Close icon buttons use the toolbar’s theme-aware hover background and border colors, and describe their filename and Alt+W / Option+W close shortcut in hover text; that shortcut uses the normal dirty-buffer confirmation and ignores held repeats, including physical Option+W events whose character differs by keyboard layout. The active source filename is bold whether one or multiple documents are open. Open source tabs can be reordered by dragging or Alt+Shift+Left/Right; this preserves selection and loaded execution and persists their order in workspace recovery.

Toggle tooltips remain open through pointer clicks while the trigger stays hovered, including updated on/off descriptions. Switches, checkbox toggles, and toolbar buttons with a binary toggle value opt in; ordinary actions and selected tabs or labels retain click dismissal. All standard tooltips immediately disappear when the pointer leaves their trigger, including movement into the tooltip itself; this policy is owned once by the shared Tooltip component. Editor keyword reference documents retain their separate hoverable, scrollable presentation, including clicks and text selection while the pointer remains inside. Textarea blur from selecting reference text does not dismiss the document; pointer exit, editing, and Escape still do.

Reusable selection controls pair native checkboxes with clickable text across debugger panes, menu dropdowns, and source dialogs; callers retain preference and file-selection state through bindings or callbacks. MultiSelect shares checkbox membership and ordering between the Open dialog and editable condition flags. Generic Slider and Toggle provide range and binary-switch semantics; the shell's SpeedSlider supplies MARS speed mapping, and ThemeToggle supplies appearance content and persists the choice through the browser theme adapter. Run speed remains bound to desktop preferences; the generic controls have no domain or storage policy.

The [register banks pane](src/lib/venus/components/debugger/RegisterBanksPane.svelte) groups the Registers, Coproc 1, and Coproc 0 tabs. The Register Banks switch immediately left of Theme defaults to shown, persists sidebar visibility, and uses theme-matched solid active and muted inactive fills. The sidebar and divider slide smoothly while the left panes resize. Hiding the sidebar also removes its divider and lets the left panes fill the available width; showing it restores the retained width and selected bank. The Theme switch keeps neutral track semantics.

The run-speed slider is visible only in Execute, with its value retained while hidden in Edit. Its 37 distinct speeds occupy evenly spaced stops, with maximum only at the final endpoint; vertically stacked Plus/Minus icons immediately to the right step one choice at a time. The slider and step buttons fit within the toolbar action row height without enlarging the toolbar. At the maximum endpoint, where a program simply runs without debugger interaction, the slider fill switches from the browser's default to the theme-aware `--theme-speed-max` amber. The view maps to the existing saved legacy speed domain, preserving older maximum settings.

The shell Footer component renders parent-resolved filename, caret, and execution status without owning workspace or machine state. The footer boldfaces the filename and prefixes its dynamic, bold execution status with “Status: ”. The footer shows the selected source filename prefixed with “Editing: ” in Edit, or “No current edits” without an open source, and hides execution status in that view unless it is “error”. It shows the loaded program’s filename prefixed with “Loaded: ” in Execute, independently of the Edit selection; Execute shows “No program loaded” when assembly is unavailable. Its Line/Column indicator appears only while that source textarea has focus in Edit, and refreshes from the native selection on focus; other controls, consoles, dialogs, and Execute hide only the caret annotation.

The shared application stylesheet gives enabled buttons, tabs, menu options, sliders, selectors, and toggles a pointer cursor. The shared Button control supplies a theme-aware hover background and accent border for enabled actions throughout dialogs, menus, consoles, transfers, and debugger controls. Disabled buttons do not highlight, selected tabs retain their solid fill, and switches and toolbar toggles keep their state-specific hover colors. The source editor uses a pointer over parsed instructions and directives with active hover help, retaining the text cursor elsewhere and during selection dragging. Disabled controls retain a distinct unavailable cursor, and pane dividers keep directional resize cursors. Button's `plain`, `bordered`, and `outlined` variants give Clipboard, the run-speed steppers, Select all/none, and the console actions one themed border and surface; the Button always routes through Tooltip, which attaches no listeners when its text is empty. IconButton is the shared square icon-only button, with three sizes, one dimming for the disabled state, a transparent resting border that shows the accent border on hover, and pressed styling for toggles; its tooltip defaults to its label, and CloseButton is a thin IconButton. Tooltips and the source editor's instruction help share one themed floating surface in the application stylesheet. Pane-level errors in the register banks and Data Segment use the themed InlineAlert, while dialogs keep their neutral DialogError.

### Command groups and display controls

The toolbar groups file workflows, editing, execution/debugging, and display toggles. Close All directly follows Open in the file group. Debugging uses recognizable play, step, backstep, pause, stop, reset, and filled-hammer assembly shapes. Toggle all breakpoints precedes Clear all breakpoints immediately after Reset. The line-number toggle ends the editing group. The display group before Help orders label visibility, program arguments, popup syscall input, hexadecimal addresses, hexadecimal values, and ASCII. Active toggles show a pressed background and expose their labels as hover text. Settings exposes the same controls in the same order except ASCII, which remains in the toolbar and Data Segment. These checkboxes share state, callbacks, and enablement with their toolbar counterparts.

### Memory navigation and label groups

Data Segment navigation, address-range selection, hexadecimal controls, and ASCII share one row with a separator between groups. Previous/next memory-page buttons render the bundled Previous and Next arrows at a fixed size through the theme-aware icon reference. Fixed ranges use address-first captions such as `0x10040000 (heap)`; the dynamic stack/global-pointer choices retain `current $sp` and `current $gp`. Reopening the range selector and choosing the current range returns to that range's first page instead of doing nothing. The ASCII toolbar button and Data Segment checkbox control the same persisted state. Labels filters and sort direction persist independently of assembled program data.

The Labels pane separates symbol-table ownership with centered, full-width heading rows: `(global)` first, then each assembled file's local symbols under its dynamically resolved filename. Sorting and Data/Text filtering apply within each group. Tables with no symbols are omitted; existing group headings remain when filters hide their entries. Group membership comes from the engine's global and program-local symbol tables rather than inferred label names or addresses. Label and Address cells share the desktop navigation hover text. Either cell centers and focuses the destination within its own table; data navigation selects the nearest legacy range and the page containing the word, so a shifted range or compressed, scrolled table does not hide the target. Byte labels select their containing word. Text navigation selects both the instruction and its word in the Data Segment `.text` range, including kernel instructions, and leaves the PC unchanged. Clicking the selected label or its address again clears the Labels row and all destination selections. The Labels row shares the selection highlight. Its source/global owner, name, and address are saved in localStorage with the loaded program checkpoint, survive Edit/Execute switches and reloads, and are cleared for a new assembly or invalidated program. Selection remains visible across the tables independently of keyboard focus and memory-write highlighting; this requested browser extension is recorded in [ADR 0002](docs/adrs/0002-port-fidelity.md).

### Keyboard delivery and browser reservations

All defined keyboard shortcuts route through one app-wide capture handler to the same actions as menus and buttons, regardless of the focused pane, text field, control, or page body. Matching events cancel browser defaults even when a command is disabled or a dialog blocks desktop actions. New uses Alt+N / Option+N, matching the physical N key for dead-key layouts; held-key repeats are captured without creating additional buffers. Ctrl+N remains browser-owned. Ctrl+L clears the selected console and Alt+L / Option+L clears both. Alt+W / Option+W closes the current source. Physical Alt/Option shortcuts are captured before textarea input even when the event is marked composing or AltGraph; genuine Ctrl+Alt/AltGraph input stays with the editor. The physical-key matches derive from the displayed Alt/Option shortcut text, and each command's no-repeat policy is declared in the same command catalog. Browser- or OS-reserved combinations can still be intercepted before the page receives them; toolbar/menu actions remain available.

## Configuration and persistence

### Engine settings and presentation policy

The unchecked-by-default Program arguments provided to MIPS program setting and Args toolbar icon share the same engine preference, immediately after Labels in each surface. The input adds a content row below the Text Segment heading and above the scrolling table. `SimulationState` owns its draft; desktop recovery persists it independently of the applied argument bytes in the machine checkpoint. `RunController` uses the translated `ProgramArgumentList` before the first Go or Step after assembly/reset only. Whitespace-delimited strings, literal quotes, argc/argv stack layout, low-byte UTF-16 storage, and compact-layout handling follow the Java oracle. Toggling or editing preserves loaded execution; Backstep and resumed/recovered execution do not reinstall arguments. See [ADR 0009](docs/adrs/0009-program-arguments.md) for scope and the host-error adaptation.

Engine settings and presentation preferences have separate owners. Settings such as extended assembly, warning-as-error policy, delayed branching, start-at-main, self-modifying code, and assemble-on-open are wired into the real engine. Changing delayed branching or the memory layout automatically reassembles loaded code through the controller; self-modifying code changes access policy without resetting execution. Delayed branching and self-modifying code default to unchecked. The Memory Configuration dialog previews all three canonical layouts and their unsigned-address-sorted tables, with Apply, Apply and Close, Cancel, and Reset to the opening selection. Preview and Reset do not apply changes. Shared RadioSelector controls sit to the left of the address table with both columns top-aligned; narrow screens stack them. The configuration area scrolls within the constrained dialog height while the action buttons remain visible. Engine preferences, including the selected layout, persist through the existing localStorage adapter and stable execution checkpoints. Machine-setting controls are disabled during execution. All Settings menu entries have themed hover/focus descriptions, using the legacy Venus wording where applicable; Clear all outputs on Go has a browser-specific description. The Settings menu, the toolbar toggles, and the desktop's shared toggle state are built from one catalog of labels, descriptions, glyphs, and targets, which also records whether an engine setting invalidates loaded execution when changed. Other assembly-policy changes invalidate loaded execution. The Settings menu has separators immediately after Values displayed in hexadecimal, Clear all outputs on Go, and Self-modifying code. Popup input selects the host presentation of console reads. Display-base preferences also inform engine statement rendering without changing stored machine bits.

The new **Clear all outputs on Go** checkbox follows Initialize Program Counter within the same subgroup. It defaults to unselected, persists in desktop display preferences, and clears both Mars Messages and Run I/O when Go starts a fresh program run after assembly or Reset. Current Go diagnostics and output then accumulate normally; Resuming after Pause, a breakpoint, Step, or Backstep preserves both outputs, even after backstepping to the first instruction or restoring a started checkpoint. Step, Assemble, Reset, and Backstep do not trigger it. This is an explicit addition beyond the legacy/JAR Venus UI ([ADR 0008](docs/adrs/0008-clear-outputs-on-go.md)).

### Persistence records and schema boundaries

| Persistence record                 | Owner and contents                                                 | Restore/write behavior                                                                              |
| ---------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `mars-ts:sources:v1`               | Browser source library: JSON array of `{ name, source }`           | Read/validated for source operations; written by successful commits, imports, renames, and deletion |
| `mars-ts:workspace:v1`             | Recovery array: `{ name, source, savedSource, isNew, selected }`   | Restore on mount; synchronous backup after source/tab changes                                       |
| `mars-ts:display-settings:v1`      | Display toggles, label filters/sort, run-speed position, Auto Save | Validated on mount; update after preference changes                                                 |
| `mars-ts:theme:v1`                 | Light/dark appearance choice                                       | Applied before first paint; light is the default for missing, invalid, or inaccessible storage      |
| `mars-ts:panes:v1`                 | Register width, editor/messages split, and Data Segment height     | Restore with viewport bounds; save completed drag or keyboard adjustment                            |
| `mars-ts:engine-settings:v1:<key>` | Browser persistence adapter for engine settings                    | Read/write through the injected preferences interface                                               |

The versioned keys describe the current schema; they are not a promise that arbitrary future schemas can be read without migration. Display settings validate supported field types and ranges and default omitted newer fields. Pane dimensions are clamped so a saved desktop size does not make a smaller viewport unusable.

### Bundled appearance presets

Editorial appearance comes from [editor-preset.json](src/lib/editor/editor-preset.json) and [highlighting-preset.json](src/lib/venus/highlighting-preset.json). These define source typography/syntax styles and execution/register/memory highlighting and are bundled at build time. One shared machine-table frame applies the highlighting preset to the Execute and register tables, which also share application-font headings, monospace cells, uniform spacing, and alternating stripes. The corresponding legacy Editor and Highlighting configuration dialogs are intentionally absent. They are not stored as end-user localStorage overrides.

### Theme and repository controls

The menu-bar theme toggle selects the original light palette or a complementary slate-and-blue dark palette in [layout.css](src/routes/layout.css). Dark semantic color tokens cover menus, dialogs, source syntax/caret/selection, registers, memory, and execution highlights while retaining preset typography and light colors. The choice persists independently of source and simulator state; blocked storage still permits switching for the current page. A small initialization script in `src/app.html` applies the saved choice before the UI paints, and the toggle adopts it on mount. Printing retains a white background and black text.

The control displays `Theme:` immediately before an accessible sun/moon slider at the right of the menu bar. Its thumb slides between settings over 300 ms. This small, explicitly requested state transition remains enabled under reduced-motion preferences. Space or Enter toggles the focused switch. The GitHub icon immediately to its right opens the MARS-ts repository in a new tab and uses the same theme-aware tooltip styling.

## Evidence and validation

### Evidence paths and tested scope

There are two different questions: whether translated machine behavior matches Java, and whether the browser adaptation works as intended. Each has its own evidence. A successful render does not prove opcode correctness; an opcode probe does not prove that a dialog preserves unsaved text.

```mermaid
flowchart LR
    Java["Read-only canonical Java and resources"] --> Capture["JDK oracle runners and probes"]
    Capture --> Goldens["Checked-in golden observations"]
    Capture --> Recheck["Fresh Java capture compared with goldens"]
    TS["Production TypeScript engine"] --> Unit["Vitest unit and integration comparisons"]
    Goldens --> Unit
    App["Real desktop on isolated port 6278"] --> BrowserTests["Playwright workflow assertions"]
    Unit --> Evidence["Behavior evidence within tested scope"]
    Recheck --> Evidence
    BrowserTests --> Evidence
```

| Evidence family                                                                                                                                                   | Established scope and limits                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Original whole-program corpus](tests/oracle/README.md) and [production consumer](tests/session/core-programs.test.ts)                                            | 19 of 21 cases enabled against real `Globals` and `RunController`; compares relevant console, diagnostics, registers, memory, encodings, and termination behavior                                      |
| [Complete assembler corpus](tests/oracle/assembler-programs/README.md)                                                                                            | 603 assemblies using the production tokenizer, assembler, instruction set, and hardware                                                                                                                |
| [Basic instruction execution](tests/oracle/instruction-set/README.md)                                                                                             | 4,960 machine-state/error observations across every basic callback and 1,644 decode observations; not exhaustive opcode input coverage                                                                 |
| Hardware, numeric, source-model, settings, and diagnostic probes under [tests/oracle](tests/oracle/)                                                              | Isolated Java observations for boundary values, mutation/notification order, errors, and class lifecycle                                                                                               |
| [Simulator](tests/oracle/simulator-units/README.md), [backstep](tests/oracle/backstep-units/README.md), and [core syscalls](tests/oracle/core-syscalls/README.md) | Execution sequencing, handler dispatch, restoration, and implemented runtime-service behavior                                                                                                          |
| [Lexical highlighting](tests/oracle/highlighting/README.md)                                                                                                       | Canonical vocabulary, token spans, character behavior, and default styles; not full editor parity                                                                                                      |
| [Browser scenarios](tests/browser/)                                                                                                                               | Actual assembly/debugging interaction, console/modal input, editing, source persistence/recovery, save/import/export (both assembly extensions)/delete/rename decisions, controls, and layout behavior |

### Fixture provenance and explicit exclusions

Cross-module TypeScript suites are grouped by [assembler](tests/assembler/README.md), [instruction translation](tests/instructions/README.md), and [machine/controller session](tests/session/README.md) responsibilities. They share [oracle fixture loading and row decoding](tests/oracle/fixtures.ts), while scenario-specific host adapters, capture schemas, and assertions stay with their consumers. Focused tests remain beside their production modules under `src/`; browser interaction remains under `tests/browser/`.

The `program-arguments` whole-program case now passes through the same argument storage used by the desktop. Only `seeded-random` remains skipped, awaiting the random-service implementation. The enabled Exit2 comparison follows canonical Swing behavior, not the Java launcher's process exit code. Console output and machine observations are compared without requiring browser presentation to reproduce CLI headings or separators.

Golden files are produced by Java, not handwritten expected implementations in TypeScript. The original runner checks source hashes, declared dependencies, exit behavior, and captured bytes, normalizing only the checkout-root prefix. Unit-probe runners define their own captured contracts. Regeneration is a deliberate operation whose changes need review; passing a capture check alone shows Java reproducibility, while the TypeScript comparison establishes port behavior.

### Reproducing checks

Run these from the repository root in the prepared environment. Commands that regenerate fixtures are documented with their individual oracle suites; ordinary verification should not rewrite expectations.

| Command                             | Purpose                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `run-checks harness`                | Validate agent/configuration relationships and authored Markdown link targets                           |
| `run-checks docs`                   | Validate the ADR index                                                                                  |
| `run-checks legacy`                 | Build/run the Java reference and verify its oracle corpus                                               |
| `MARS_VALIDATION=1 run-checks app`  | Run application checks, lint/format checks, unit tests, and static build with isolated generated output |
| `npm run test:browser`              | Exercise browser workflows on the dedicated test server at 6278                                         |
| `node tests/oracle/run.mjs --check` | Rebuild Java and compare the original deterministic corpus with its goldens                             |

Report the result of the actual run, including skipped tests and unavailable prerequisites. This guide records evidence locations and scope rather than a changing aggregate test count. Browser checks and builds sharing isolated generated output should run sequentially. Port **6277 is reserved exclusively for the human's own development and review**; agents and automated tests must neither start, attach to, nor stop that listener, and ad hoc agent servers bind 6279 or higher.

## Build, development, and delivery

### Source layout and bundled resources

The root [package manifest](package.json) and lockfile own dependency resolution; [Vite configuration](vite.config.ts) integrates SvelteKit, its static adapter, Tailwind, and Vitest. Application implementation stays under `src/`; browser-ready assets stay under `static/`. The original Java app is isolated under [_legacy-app/](_legacy-app/README.md), with its sources, resources, packaging files, and generated Javadoc. The oracle build reads that directory and copies the shared root license into `__build/legacy/Mars.jar`. Browser runtime assets remain under `static/`, and the TypeScript app does not load files from `_legacy-app/`.

The shipped [llms.txt](static/llms.txt), advertised by the root layout, welcomes agent exploration and browser IDE use. It describes supported desktop workflows, browser-local source persistence, and deferred features without introducing a server-side API or access-control policy. The companion [robots.txt](static/robots.txt) permits crawling of all paths.

The global [route error view](src/routes/+error.svelte) displays a centered pane using the saved light or dark palette, with a button-styled link back to `/`. Unknown paths at any depth return a 404; other route errors use the same view. The static adapter emits `404.html` as a client-router fallback for hosts configured to serve it on missing URLs. Existing static files, including `/llms.txt` and `/robots.txt`, are served directly. The [deployment runbook](docs/runbooks/prod-deployment.md) describes the required host error-page setting; the static fallback needs JavaScript to render the route error view.

### Toolchain and helper commands

| Layer                 | Current stack                                                             |
| --------------------- | ------------------------------------------------------------------------- |
| Development runtime   | Node 24; provisional JDK 21 for oracle work                               |
| UI and routing        | Svelte 5 runes and SvelteKit 3 prerendered routes                         |
| Language and styling  | Strict TypeScript 6 and Tailwind 4, with component styles                 |
| Bundling and delivery | Vite 8 and SvelteKit static adapter                                       |
| Checks and formatting | Svelte check, ESLint 10, Prettier 3                                       |
| Tests                 | Vitest 4 for engine/controller/adapters; Playwright for browser scenarios |

Exact versions belong to executable configuration and the lockfile. The [development-container decision](docs/adrs/0001-local-development-environment.md) and [operations guide](docs/agents/operations.md) explain provisioning and helper behavior, including `build-legacy`, `run-legacy`, `run-app`, `build-app`, and validation tiers. `build-app` performs a clean dependency installation; ordinary `npm run build` uses installed dependencies.

### Local validation isolation

The human's normal development and preview use port 6277 with strict binding. Browser tests use 6278 with separate SvelteKit output, Vite cache, and static build paths; ad hoc agent servers use 6279 or higher.

### Static delivery and hosting

The application is live and stable at `https://mars-ide.portfolio-projects.dev`. The root page emits an absolute canonical link to `https://mars-ide.portfolio-projects.dev/` in its prerendered head. Its static Coolify deployment follows [ADR 0005](docs/adrs/0005-coolify-deployment.md) through the corresponding GitHub App: Nixpacks builds with Node 24 and Coolify serves `build/` through Nginx on internal port 80. The [deployment runbook](docs/runbooks/prod-deployment.md) maintains that existing service with configuration references, routine release smoke checks, cache-policy updates, and recovery procedures. LocalStorage belongs to that origin, so changing the hosting origin is also a source-persistence boundary. The [service worker](src/service-worker/README.md) and [web app manifest](static/manifest.webmanifest) make the build installable and usable offline after one visit ([ADR 0010](docs/adrs/0010-pwa-offline-support.md)): it precaches the prerendered page, hashed build output, and static files under a per-release cache, serves them cache-first, falls back to the cached desktop page for offline navigation, and never touches localStorage. The development server does not register the worker, so offline behavior is checked against a production build. Opening `index.html` from `file://` is unsupported because browsers block module loading and service workers there; a local copy needs a static server on `localhost`. A static build still does not provide cloud synchronization or a packaged desktop executable.

## Remaining scope and extension rules

### Current limitations

The core is usable for the supported instruction and console-service workflows, but the entire Java application has not been ported. Unsupported capabilities must remain distinguishable from completed behavior.

| Area                      | Current boundary                                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Runtime platform services | File descriptors/file syscalls, time, sleep, random, MIDI, and dialog syscall families remain deferred                                                                                     |
| Configuration UI          | Exception-handler selection remains disabled; underlying engine handler dispatch does not imply a complete GUI workflow                                                                    |
| Tools and memory dumps    | Tools menu implementations and File → Dump Memory remain deferred in favor of core execution/debugging stability                                                                           |
| Editor                    | Hover descriptions and lexical highlighting exist; instruction popup completion and full legacy editor behavior remain incomplete; appearance dialogs are deliberately replaced by presets |
| CLI and OS integration    | Command-line launcher, native directory assembly, and native linked-file saving are intentionally excluded                                                                                 |
| Persistence               | Sources, preferences, editor undo/redo, console buffers, and stable debugger checkpoints recover locally; cross-device sync and collaborative editing remain unimplemented                 |
| Delivery                  | Live, stable static hosting on Coolify; offline caching and a packaged desktop executable are not implemented; final legacy offboarding remains governed by the port plan                  |

### Extension contract

When adding a capability, preserve the owning Java class responsibility and algorithm, supply platform behavior through an injected interface, and keep mutable state per session. Add oracle observations for the translated behavior and browser tests for its presentation or storage adaptation. Extend the existing module boundary instead of duplicating engine logic in a component. Changes to observable semantics need a decision record; changes to module contracts need their README updated. Update this guide's architecture, tables, and limitations in the same change so a newly implemented feature does not remain labeled deferred.

## Provenance and attribution

MARS is copyright 2003–2013 Pete Sanderson and Kenneth Vollmar and is distributed under the [MIT license](MARSlicense.txt). Translated modules and copied data retain their notices and identify their Java source. The editor's inherited jEdit syntax package retains the additional Slava Pestov and Mike Dillon notices described in its [module documentation](src/lib/editor/highlighting/README.md). The [static asset documentation](static/README.md) records asset provenance; About MARS opens the unchanged [bundled license](static/MARSlicense.txt) in a new tab.

The checked-in Java implementation is the behavioral authority regardless of its historical release labels. Legacy help under `_legacy-app/help/` and generated Javadoc under [_legacy-app/docs/](_legacy-app/docs/README.md) remain read-only reference material; current product behavior is described here and in authored port documentation under [docs/](docs/README.md). The historical project introduction is retained in the [legacy application README](_legacy-app/README.md#original-mars-readme).
