<!-- Derived from help/MarsHelpLimits.html.
Copyright 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt. -->

# Requirements and Limitations

## Operating Requirements and Limitations

Original article: Release 4.5 · August 2014

## Browser requirements

MARS-ts runs its TypeScript assembler and simulator in a modern browser with JavaScript enabled. No Java runtime, Swing installation, or JAR is required. Browser storage retains sources, recovery text, and preferences when available. Storage failures are reported; export files for copies outside the browser.

## Current limits

- The default layout retains the legacy memory-segment limits: text, data, stack, kernel text, and kernel data each have a maximum 4 MB backing range from their respective bases. Memory is allocated sparsely as used.
- There is no pipelined mode. Delayed branching is supported.
- The desktop uses the MARS assembler and simulator; it is not a front end for other compilers or simulators.
- Open and Save operate on the browser source library. Import and Export move .asm and .s files between the library and your computer; Import also reads ZIP archives of them, keeping their folder paths, and lists any skipped files before you confirm. Includes use virtual source paths, not arbitrary OS paths; assembly starts with the active source and follows its explicit includes. Other open tabs are not automatically assembled.
- File, time, sleep, and MIDI syscalls remain unfinished. Random 40–44 and dialog 50–59 services are available. See Syscalls for exact service availability. Tools are disabled. File → Dump Memory exports populated text or data memory in all six legacy formats.
- The Exception Handler dialog selects a default or saved-library handler for automatic inclusion; explicit handler code is also supported. Memory Configuration supports the default layout and both compact layouts.
- Editor and highlighting customization use bundled presets, not the original dialogs. Command-line operation is excluded. Program arguments are available through Settings and the Args toolbar toggle; their text follows legacy whitespace splitting and low-byte character storage.
- Backstep history is bounded to 2000 recent steps and does not reverse output or external I/O. Stable machine state and Backstep history are recovered after reload; active execution is not resumed. Machine edits require execution to be stopped.
- Execution yields cooperatively to the browser. Limited-speed timing is approximate, and large workloads still consume browser CPU and memory.

## Branch offsets

The original guide documents a change in Java Release 3.4: a branch encodes the relative number of words from the next instruction, whether delayed branching is enabled or disabled. Thus `label: beq $0,$0,label` encodes as `0x1000FFFF` in both modes. Earlier releases encoded `0x10000000` when delayed branching was disabled. The simulator accounts for the selected branch mode.

## Historical Java limitations

The Release 4.5 article described a Java/Swing application requiring J2SE Release 1.5, tested on Windows XP, Vista and 7 and Mac OS X, and also used on Linux. Its JFileChooser did not follow links or shortcuts. It noted limited preference persistence, an assembly-error highlighter that could miss a source not already open, a Screen Magnifier capture issue on Windows Vista, and reported editor slowdown during long sessions that disappeared after restarting. These are retained as historical observations, not claims about the browser implementation.

The original instruction-set reference was Computer Organization and Design, Fourth Edition, Patterson and Hennessy, Elsevier – Morgan Kaufmann, 2009. Browser feature availability is described above rather than inferred from the original article’s Appendix B coverage claim.

---

Adapted from [MARS help](https://dpetersanderson.github.io/Help/MarsHelpIntro.html). Copyright © 2003–2013 Pete Sanderson and Kenneth Vollmar. [MIT license](../../../../MARSlicense.txt).

[Help index](README.md)
