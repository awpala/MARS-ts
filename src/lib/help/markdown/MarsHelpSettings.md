<!-- Derived from help/MarsHelpSettings.html.
Copyright 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt. -->

# Configuration Settings

Original article: Release 4.5 · August 2014

Settings menu checkboxes control display, input, assembly, and execution. The first five entries are Show Labels Window, Program arguments provided to MIPS program, Popup dialog for input syscalls (5,6,7,8,12), Addresses displayed in hexadecimal, and Values displayed in hexadecimal. These share their state with the corresponding toolbar buttons; a separator follows Values displayed in hexadecimal. Preferences are stored in this browser’s localStorage when available; if storage is unavailable, changes remain in memory. Java MARS retained settings beginning with Release 3.2 through `java.util.prefs.Preferences` (the Windows Registry on Windows); the browser does not use that mechanism.

## Display and input

- **Show Labels Window:** on by default. Shows program labels and addresses beside the Text Segment, with Data/Text filters and sorting.
- **Addresses displayed in hexadecimal:** on by default. Turn it off for decimal addresses.
- **Values displayed in hexadecimal:** on by default. Turn it off for decimal memory and register values.
- **ASCII data display:** off by default. Interprets Data Segment bytes as characters and disables editing in that view. Its state is shared by the toolbar and Data Segment checkbox.
- **Show line numbers:** on by default in the source editor. Its toggle is at the end of the editing toolbar group, after the undo/redo and clipboard actions.
- **Popup dialog for input syscalls:** off by default; introduced in Java Release 4.0. Services 5, 6, 7, 8, and 12 normally read in Run I/O. Enable this toggle for same-tab input dialogs. Services 50–59 use their own same-tab dialogs regardless of this setting.
- **Appearance:** the menu-bar sun/moon switch selects light or dark mode; light is the default. The choice persists independently of machine state.

## Assembly and execution

The Settings menu has separators after Prompt to clear all breakpoints and Self-modifying code. Assembly uses the active source and its explicit `.include` directives; there is no assemble-all control. A previously saved assemble-all preference is reset when the desktop starts. Included source resolves from current open buffers first, then saved library files.

1. **Assemble file on open:** off by default. Automatically assembles a source when opened.
2. **Assembler warnings are considered errors:** off by default; introduced in Java Release 3.5. When enabled, any assembly warning makes assembly fail. Unrecognized or ignored directives can produce warnings, as can truncated numeric data.
3. **Initialize Program Counter to global main if defined:** off by default; introduced in Java Release 3.8. Uses the address of the text label `main` declared with `.globl main`, if present. Otherwise execution starts at the default text address.
4. **Clear all outputs on Go:** off by default; added by MARS-ts. When enabled, Go clears both Mars Messages and Run I/O before it starts a fresh run after Assemble or Reset. Resuming after Pause, a breakpoint, Step, or Backstep keeps existing output, and Step, Assemble, Reset, and Backstep never clear it.
5. **Prompt to clear all breakpoints:** off by default; added by MARS-ts. Clear all breakpoints normally removes them at once, as in Java MARS. When enabled, the toolbar button, Run menu entry, and Ctrl+K first ask for confirmation, and Cancel keeps every breakpoint. Clearing Keep showing this warning in that confirmation turns this setting off.
6. **Permit extended (pseudo) instructions and formats:** on by default. Includes address forms beyond the native 16-bit offset plus register.
7. **Delayed branching:** off by default. The instruction after a branch or jump executes before the transfer. Account for the delay slot, often with an explicit `nop`; the assembler does not automatically add one after every source branch. Introduced in Java Release 3.3. Since Release 3.4, branch offsets are encoded relative to the next instruction regardless of this setting, with simulation adjusted accordingly. Changing this option automatically reassembles a loaded program.
8. **Self-modifying code:** off by default; introduced in Java Release 4.4. Permits program writes to user text, execution from user data, and stopped-state editing of text words.

## Program arguments

Program arguments provided to MIPS program is off by default. Its Args toolbar toggle sits immediately to the right of Labels and shares the Settings selection. When enabled, a Program Arguments field appears below the Text Segment heading, above the instruction table. The setting and argument text are saved in this browser. The X button beside the field clears the entry without turning Args off or changing arguments already applied to the program.

Enter arguments separated by spaces or tabs. For example, `first second` supplies two arguments. Quotes and backslashes are literal characters, not shell syntax: `"two words"` supplies two arguments with quote characters included. Newline, carriage return, and form feed are also delimiters in the engine's text parser. No executable filename is added. Non-ASCII text follows the original MARS low-byte character storage, not UTF-8 encoding.

Before the first Go or Step after Assemble or Reset, MARS places null-terminated strings and their pointers on the stack, sets `$a0` to the argument count (argc), sets `$a1` to the pointer array (argv), and adjusts `$sp`. A null pointer ends argv. Empty or whitespace-only input leaves these registers unchanged. Initialization occurs only when the setting is enabled. Editing the field or toggling it after execution starts affects the next Assemble/Reset run; it does not change the current program's arguments. Backstep does not undo initialization. Reload recovers the applied machine arguments and retains the current field text separately. This feature does not provide a command-line launcher.

## Memory Configuration

Choose Default (the SPIM-derived layout), Compact, Data at Address 0, or Compact, Text at Address 0. Selecting a configuration previews its segment addresses without changing the machine. Apply commits the selection and leaves the dialog open; Apply and Close also closes it. Cancel closes without applying the current selection. Reset restores the selection from when the dialog opened without applying it. Applying a different layout resets memory and registers and automatically reassembles a loaded program. The selected layout persists in localStorage.

## Exception Handler

Settings → Exception Handler ... opens the automatic handler dialog. Enable exception handler is off by default. Browse selects one saved source from this browser’s library and displays its filename beside the button. Browse and the filename appear only for the custom choice. While inclusion is off, both radio choices are disabled and dimmed, and Browse is disabled; the selected source is retained. Save or import a handler before selecting it; never-saved buffers are not listed. When the handler is open, assembly uses its current text, including unsaved edits. The enabled handler is assembled first.

The switch enables or disables inclusion of the selected file without clearing the selection. OK saves both the enabled flag and filename, even when disabled; both are restored after reopening or reloading the app. Cancel, Escape, or closing the dialog discards changes. An enabled empty selection adds nothing, and missing sources fail only when assembling. The dialog remains available during execution; changes apply to future assemblies without changing loaded code or Reset.

Use SPIM default exceptions handler selects the bundled handler and startup code instead of a custom library source. It requires a global `main` label and the default memory layout; its unsupported directives produce assembler warnings. Open default `exceptions.s` in editor closes without applying changes and displays a locked read-only reference. Copy to new file makes an editable copy with its license intact. The reference remains protected after reload and is excluded from library saves and Export All. Exceptions ends the runtime/debug toolbar group; Memory Configuration follows ASCII in the display group. These buttons open the same dialogs as Settings.

## Legacy settings without a current browser control

- **Editor dialog** (Java Release 3.3) and **Highlighting dialog** (Java Release 3.6): the port uses bundled editor/highlighting presets instead of font and color dialogs. Toolbar display settings and the appearance switch remain available.

Source saving has separate controls: File → Auto Save commits edits to the local source library. Recovery backups retain open-buffer text independently of manual Save. Stable machine state and backstep history are recovered after reload; active execution and pending input are not resumed.

---

Adapted from [MARS help](https://dpetersanderson.github.io/Help/MarsHelpIntro.html). Copyright © 2003–2013 Pete Sanderson and Kenneth Vollmar. [MIT license](../../../../MARSlicense.txt).

[Help index](README.md)
