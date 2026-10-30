<!-- Derived from help/MarsHelpDebugging.html.
Copyright 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt. -->

# Interactive Debugging

## Interactive Debugging Features

Original article: Release 4.5 · August 2014

Assemble a program to populate the Execute pane. Its Text Segment shows addresses, machine code, basic instructions, and source. The highlighted instruction tracks execution, and register and memory highlights show writes.

- **Step (F7)** executes one machine instruction and updates the display. A pseudo-instruction may expand into several machine instructions.
- **Go (F5)** runs continuously or resumes from a step, pause, or breakpoint. The Run Speed slider ranges from 0.05 instructions per second (20 seconds between steps) to 30 instructions per second, then unlimited. The browser yields periodically during unlimited execution so controls can respond; its timing is not a hardware clock.
- **Breakpoints** use the checkboxes beside instructions in the Text Segment. The toolbar’s Toggle all breakpoints (Alt/Option+T) suspends and restores the selected addresses without losing them; Clear all breakpoints (Ctrl+K) removes them. Command is accepted in place of Ctrl on macOS when the browser delivers the shortcut to the page. Breakpoint suspension was introduced in Java Release 3.8. Unlike the original, which read breakpoints only when Go started, MARS-ts lets you set, clear, suspend, or restore breakpoints while Go is running at a finite speed; the change applies from the next instruction, so checking a breakpoint ahead of the current instruction pauses there. A pending Step is unaffected. At unlimited speed (the default) the program simply runs, without step-by-step display, so breakpoint controls are locked, even while execution is stopped; the breakpoints already set still apply. Lower the run speed to set or change breakpoints, even while the program runs.
- **Pause (F9)** requests a pause; **Stop (F11)** requests termination. Pending console input is released when execution is interrupted. Empty or invalid numeric input can still produce an input error.
- **Backstep (F8)** undoes recorded memory, register, and condition-flag changes one instruction at a time. History holds up to 2000 recent steps. It does not undo console output or other external I/O, and is separate from source-editor Undo. It is available after stepping, pausing, or termination when history remains. The browser has no properties-file control for its capacity.
- **Reset (F12)** restores post-assembly memory and registers by reassembling the retained program. Editing source requires a fresh Assemble before execution.

## Inspecting memory and registers

Toolbar toggles select hexadecimal or decimal addresses and values. Data memory also has an ASCII view. Memory is little-endian: a displayed hexadecimal word places its most significant byte on the left, so four string bytes can appear reversed relative to their order in memory.

The Data Segment shows 512 bytes (16 rows) at a time, initially at `0x10010000`. Navigation and range controls move through memory or select the stack pointer, global pointer, heap (`0x10040000`), extern globals (`0x10000000`), kernel data (`0x90000000`), MMIO (`0xFFFF0000`), or raw text. Raw text inspection was added in Java MARS 4.4. An MMIO region does not imply that device Tools are available.

While execution is stopped, edit a permitted register or memory input and commit with Enter or by leaving the field. Integers accept decimal or hexadecimal with a leading `0x`, including negative values in signed or two’s-complement form. Invalid input does not change the machine value. The zero register, program counter, and return address are not editable in the general-register table. ASCII memory cells are read-only.

Settings → Self-modifying code (off by default, introduced in Java Release 4.4) permits writes to user text and execution from user data. While stopped, text words can be edited in the Data Segment or the Text Segment Code column when this setting is enabled.

Floating registers accept decimal values, including E notation such as `12.5e3`, or hexadecimal IEEE-754 bit patterns. A double overlays two single registers; changing either representation changes the corresponding paired view.

The Labels window, shown by default and toggled by Show Labels Window in the toolbar or Settings, lists symbols. Filter Data or Text symbols, sort using the Label or Address headings, and select a label to navigate to its memory or instruction address.

Unlike the original Swing article’s live-editing workflow, MARS-ts disables machine edits during execution. Pause or Step before changing registers or memory. Condition flags remain editable while the program runs, and so do breakpoints at any speed below unlimited.

---

Adapted from [MARS help](https://dpetersanderson.github.io/Help/MarsHelpIntro.html). Copyright © 2003–2013 Pete Sanderson and Kenneth Vollmar. [MIT license](../../../../MARSlicense.txt).

[Help index](README.md)
