<!-- Derived from help/MarsHelpIntro.html.
Copyright 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt. -->

# Introduction

## MARS — MIPS Assembler and Runtime Simulator

Original article: Release 4.5 · August 2014

### Introduction

MARS assembles and simulates MIPS assembly language programs. MARS-ts brings its assembler, simulator, and interactive desktop to the browser using TypeScript and Svelte. You do not need Java or an executable JAR to use this application. The TypeScript port targets MARS-ts 1.0; the original article’s release and date above identify its source.

The current instruction registry contains 155 basic registrations and 388 pseudo-instruction definitions. Load and store instructions support seven address forms: `label`, `immed`, `label+immed`, `($reg)`, `label($reg)`, `immed($reg)`, and `label+immed($reg)`, where `immed` can be a 32-bit integer. Settings → Permit extended (pseudo) instructions and formats controls whether extended forms are accepted.

The original authors’ guiding reference was Computer Organization and Design, Fourth Edition, Patterson and Hennessy, Elsevier – Morgan Kaufmann, 2009: Figures 3.24 and 3.25, pages 279–281, and Appendix B. The legacy implementation excluded the delay branches from the left column of Figure 3.25. The browser port derives its instruction definitions from that implementation.

## Working in the browser

New creates an editor source. Open selects sources saved in this browser; Save commits the current text to that local library. Auto Save commits edits automatically when enabled. Open tabs and in-progress edits are recovered after reload when browser storage is available. Import reads .asm or .s files, or ZIP archives of them, from your computer and shows a summary to confirm, and Export downloads copies. Browser storage can be cleared, so export sources you need to keep.

Assemble (F3) translates the current source, including unsaved edits. To assemble additional source, use explicit `.include` directives in the active program. Included sources resolve from open buffers first and saved library sources second.

The Execute pane supports Go, Step, Backstep, Pause, Stop, Reset, breakpoints, labels, and inspection and editing of registers and memory while execution is stopped. Registers remain visible beside Edit and Execute. The toolbar controls labels, program arguments, number formats, ASCII data, line numbers, and popup input. Enable Args to enter program arguments below the Text Segment heading; the first Go or Step after assembly or Reset supplies them through `$a0` (argc) and `$a1` (argv).

Console reads and writes, heap allocation, exit, and integer formatting syscalls are available. Random services 40–44, dialog services 50–59, and MIDI services 31 and 33 (as sine tones) are available, along with automatic exception-handler selection. File, time, and sleep syscall families and Tools remain unfinished; see Syscalls for the service-by-service reference. Memory Configuration is available in Settings. This browser application has no command-line launcher.

## Dump memory to a file

After assembly, choose File → Dump Memory or its toolbar button while execution is stopped. Select the populated `.text` or `.data` range and ASCII Text, Binary, Binary Text, Hexadecimal Text, Intel hex format, or Text/Data Segment Window. Dump To File opens the browser/OS Save As dialog where supported; other browsers use a download with the browser's configured destination. Canceling the picker keeps your choices. A save failure stays visible so you can retry. Dumps use current memory, including changes from execution, and do not save or modify your source files. Segment Window follows hexadecimal/decimal display settings. Binary suggests `.bin`, hexadecimal formats `.hex`, and other text formats `.txt`. MIF is not an enabled legacy format.

## Original authors and project history

The original “Questions and Comments” section credited Dr. Pete Sanderson (`PSanderson@otterbein.edu`) and Dr. Ken Vollmar (`KenVollmar@missouristate.edu`). These are historical Java MARS contacts, not a support commitment for the TypeScript port. The authors presented MARS papers at the 2005 CCSC:MW conference and the 2006 SIGCSE Technical Symposium, and a tutorial at the 2007 CCSC:CP conference.

---

Adapted from [MARS help](https://dpetersanderson.github.io/Help/MarsHelpIntro.html). Copyright © 2003–2013 Pete Sanderson and Kenneth Vollmar. [MIT license](../../../../MARSlicense.txt).

[Help index](README.md)
