# Audit 0001: Swing Venus UI features

- **Status**: Accepted
- **Date**: 2026-11-20
- **MARS-ts revision reviewed**: `876db95`

## Scope and acceptance

This audit compared the MARS-ts desktop in Chromium with the legacy MARS Swing JAR under Xvfb. It covered editor, assembler, debugger, and console interactions, including commands whose behavior depends on the active tab, execution state, or memory layout. Tools, known unfinished features, and deliberate changes in the [deviation catalog](../deviations.md) were outside its scope.

The findings were accepted on the audit date for implementation in MARS-ts. The observations below describe the reviewed revision. The current implementation and its regression evidence are documented in the [implementation guide](../../IMPLEMENTATION.md).

## Highest-impact findings

### Settings could rebuild a different program or leave stale instructions loaded

Assemble `A.asm`, select `B.asm` in Edit, return to Execute, and change **Delayed branching**. The browser footer changed from `Loaded: A.asm` to `Loaded: B.asm`. In a second run, close all source tabs after assembling `A.asm`, then change the setting. The assembly count stayed at three. Applying **Compact, Data at Address 0** then moved the PC to `0x00003000` while the first displayed instruction remained at `0x00400000`.

Swing reassembles a runnable or terminated program when delayed branching or the memory layout changes. MARS-ts also allows the loaded program to outlive its editor tab. Both settings used the current Edit filename, which let tab selection retarget the rebuild and closing the tabs skip it. The browser-specific reproduction exposed a failure to preserve the loaded-program contract in UI-0012. [Swing delayed branching](../../_legacy-app/mars/venus/SettingsDelayedBranchingAction.java) · [Swing memory configuration](../../_legacy-app/mars/venus/SettingsMemoryConfigurationAction.java) · [Simulation state](../../src/lib/venus/state/SimulationState.svelte.ts) · [UI-0012](../deviations.md#ui-0012-assembly-policy-changes-invalidate-loaded-execution)

### Assembly diagnostics lost their source selection

Place invalid operators on lines 3 and 4 and assemble manually with the caret on line 1. Swing selected line 3 in the editor and its error in Mars Messages. Clicking the second error selected line 4. Chromium displayed both diagnostics with the correct filename, line, and column, but the editor selection stayed at offset zero after both actions.

The Swing click handler also recognizes warnings, switches to an already-open source, and can open a closed source named by the diagnostic. On manually initiated assembly failure, Swing skips diagnostics without a location and considers warnings for automatic selection when warnings count as errors. The paired runtime probe exercised the two errors in an open source. [Swing assembly failure](../../_legacy-app/mars/venus/RunAssembleAction.java) · [Swing diagnostic navigation](../../_legacy-app/mars/venus/MessagesPane.java) · [Browser Messages pane](../../src/lib/venus/components/debugger/MessagesPane.svelte)

### The Basic column retained the previous display bases

Assemble the following program, then clear **Hexadecimal Values** and **Hexadecimal Addresses** in Execute.

```asm
.text
main: addiu $t0,$zero,42
      j main
      nop
```

Swing immediately displayed `42` for the immediate operand and `4194304` for the jump target. Chromium changed the Address column to decimal while Basic still displayed `0x0000002a` and `0x00400000`. Switching to Edit and back made both operands decimal. A user comparing the row address with its disassembly saw two different bases despite having turned both hexadecimal settings off. [Swing display-base handler](../../_legacy-app/mars/venus/ExecutePane.java) · [Text Segment rows](../../src/lib/venus/components/debugger/TextSegmentPane.svelte)

## Debugger and editor interactions

| Interaction | Trigger and observed impact |
| --- | --- |
| Cancel a cell edit | Start with `$t0 = 0`, type `123` in its value cell, press Escape, then leave the cell. Swing ended editing with the register still zero. Chromium retained the draft and committed `0x0000007b` on Tab. The register was the runtime probe. The browser shares this cell editor with memory, instruction code, and floating-point registers. [Swing register table](../../_legacy-app/mars/venus/RegistersWindow.java) · [Browser cell input](../../src/lib/venus/components/debugger/CellInput.svelte) |
| Inspect memory while running | During a finite-speed Go loop, Swing allowed selecting **current $sp** and paging to inspect memory. Chromium disabled the range selector and page arrows, requiring a pause. The accepted running-state restriction on numeric edits is a separate workflow. [Swing Data Segment](../../_legacy-app/mars/venus/DataSegmentWindow.java) · [Browser Data Segment](../../src/lib/venus/components/debugger/DataSegmentPane.svelte) |
| Hold a paging arrow | Hold **Next** for about one second. Swing advanced through several pages before release. Chromium stayed on the original page until release and then advanced once. The cataloged full-page stride governs the distance per press. [Swing repeat button](../../_legacy-app/mars/venus/RepeatButton.java) · [Browser paging controls](../../src/lib/venus/components/debugger/DataSegmentPane.svelte) · [UI-0010](../deviations.md#ui-0010-memory-page-stride) |
| Keep the last memory write visible | Step a store of `42` to `0x10010400`, then switch to Edit and back to Execute. Swing kept the word highlighted. Chromium retained its value and lost the highlight when Execute reopened. No instruction ran during the tab switch. [Swing Data Segment](../../_legacy-app/mars/venus/DataSegmentWindow.java) · [Execute pane](../../src/lib/venus/components/debugger/ExecutePane.svelte) |
| Enter an indented line | Press Enter after four spaces and `nop`. Swing started the next line with the same four spaces. Chromium put the caret at column one. This was a default editing behavior independent of the Editor settings dialog. [Swing input handler](../../_legacy-app/mars/venus/editors/jeditsyntax/InputHandler.java) · [Browser editor](../../src/lib/venus/components/editor/SourceEditor.svelte) |
| Overwrite, select columns, and repeat | In `abcd`, put the caret after `a`, press Insert, then type `Z`. Swing produced `aZcd` and Chromium produced `aZbcd`. `Ctrl+\` enabled rectangular selection in Swing, while Chromium selected a continuous span across lines. In an empty buffer, `Ctrl+Enter`, `3`, `x` produced `xxx` in Swing and `3x` in Chromium. [Swing key bindings](../../_legacy-app/mars/venus/editors/jeditsyntax/DefaultInputHandler.java) · [Swing selection](../../_legacy-app/mars/venus/editors/jeditsyntax/JEditTextArea.java) · [Browser editor](../../src/lib/venus/components/editor/SourceEditor.svelte) |
| Follow Backstep and Reset output | With Mars Messages in front after Pause, Backstep brought Run I/O forward in Swing. Starting again on Mars Messages, Reset brought Run I/O forward and displayed its completion notice. Chromium left Mars Messages selected for both actions, hiding the Reset notice. [Swing Backstep](../../_legacy-app/mars/venus/RunBackstepAction.java) · [Swing Reset](../../_legacy-app/mars/venus/RunResetAction.java) · [Browser run commands](../../src/lib/venus/state/SimulationState.svelte.ts) |

### Pointer-based memory pages crossed address boundaries

In the default memory configuration, choose **current $sp** after assembly. Then edit `$gp` to each value below and choose **current $gp**. Each pair gives the displayed addresses of the first and last rows of a 512-byte page.

| Pointer | Swing first and last rows | Chromium first and last rows |
| --- | --- | --- |
| Initial `$sp = 0x7fffeffc` | `0x7fffefe0` – `0x7ffff1c0` | `0x7fffeffc` – `0x7ffff1dc` |
| `$gp = 1` | `0x10000000` – `0x100001e0` | `0x00000000` – `0x000001e0` |
| `$gp = 0x7ffffffc` | `0x7ffffe00` – `0x7fffffe0` | `0x7ffffffc` – `0x800001dc` |

Swing aligned the start to a 32-byte row, used the user data segment base as the minimum requested pointer, and clamped the full page at the high boundary. Chromium aligned the pointer to a word. Near the top of user memory, the resulting page included kernel addresses. [Swing pointer and page calculations](../../_legacy-app/mars/venus/DataSegmentWindow.java) · [Browser memory view](../../src/lib/venus/utils/debugger/memoryView.ts)

## Included-source navigation

With both files open, assemble `A.asm` containing `.include "B.asm"`, where the first line of `B.asm` is `li $t2,0x12345678`. Click that instruction's Source link in Execute. Chromium opened line 1 of `A.asm`. The row combined the included file's line number with the filename of the assembly owner. Source links are a browser addition under UI-0009. Both tabs were already open, so the closed-tab policy did not explain the destination. [Text Segment source links](../../src/lib/venus/components/debugger/TextSegmentPane.svelte) · [Program statement](../../src/lib/engine/assembler/programs/ProgramStatement.ts) · [UI-0009](../deviations.md#ui-0009-pc-following-and-source-navigation)

## Evidence

The original probes used the unchanged Swing JAR built from revision `bfc44e3b77d0` with isolated Java preferences and exercised the browser desktop at `876db95` through Playwright. The concrete values above preserve the observations independently of the ignored local logs. Those logs were captured under `__logs/__test-runs/`.

| Probe | Swing log | Chromium log |
| --- | --- | --- |
| Diagnostic selection, display bases, paging, console tabs, and editor keys | `1795194167_venus-audit-swing.log` | `1795194086_venus-audit-browser.log` |
| Rebuilding with independent tabs and following an included instruction | Swing settings actions inspected in source | `1795194262_venus-audit-workflows.log` |
| Canceling an edit and retaining the last-write highlight | `1795194340_venus-audit-swing-cells.log` | `1795194308_venus-audit-edits.log` |
| Pointer-based page bounds | `1795194411_venus-audit-swing-pointers.log` | `1795194396_venus-audit-browser-pointers.log` |

## Follow-up on 2026-11-20 — repeat and rectangular selection

A user reported a continuous selection highlight in Chrome on Windows 11. A headed Chromium session on Linux reproduced it before the fix using native QWERTY key events and forced-colors emulation. Copy already returned the correct columns even when the highlight covered intervening text. After the fix, the browser regression checks confirmed that only the selected columns were highlighted and that Cut removed exactly those columns. The Windows 11 observation comes from the user. Local verification used Linux. [Editor-mode browser regressions](../../tests/browser/workspace/editor-modes.spec.ts)

### Repeat a character or editing command

1. Click inside an empty, writable source. Press `Ctrl+Enter` and release both keys. The lower-right footer shows `Repeat ×1 (Ctrl+Enter)`.
2. Type `3`. The footer updates to `Repeat ×3 (Ctrl+Enter)` and the source stays empty.
3. Type `x`. The source now contains `xxx`, the caret follows the last character, and the repeat message clears.
4. Press and release `Ctrl+Enter` again, type `2`, then press Backspace. Two characters are deleted, leaving `x`.

### Select and cut two columns across three rows

Enter these three lines in a writable source.

```text
A12Z
B34Y
C56X
```

1. Click between `A` and `1`. Press `Ctrl+\` and release both keys. The lower-right footer shows `Rectangular selection (Ctrl+\)`. **Edit → Rectangular selection** is checked while the mode is active. The menu item also toggles the mode and returns focus to the source if the host intercepts the shortcut.
2. Hold Shift. Press Right twice, then Down twice, and release Shift. The marked columns are `12`, `34`, and `56`, one pair on each row. The letters at both ends of every row retain their normal background, including in forced-colors mode.
3. Press `Ctrl+C`. The clipboard contains three lines, `12`, `34`, and `56`, in that order. With the selection still active, press `Ctrl+X`. The three source lines now read `AZ`, `BY`, and `CX`.

To check Paste independently, start again with the original sample and the same rectangle selected. Paste three lines containing `aa`, `bb`, and `cc`. Each line replaces the selected digits on its row, yielding `AaaZ`, `BbbY`, and `CccX`. The footer and Edit menu make the selection mode visible in the browser. [UI-0022](../deviations.md#ui-0022-rectangular-selection-and-repeat-feedback) · [Editor-mode browser regressions](../../tests/browser/workspace/editor-modes.spec.ts)

Opening this sample from a stored source with Windows line endings (CRLF) exposed a second bug in the normal theme. The textarea counted each line break as one character, while the highlight renderer counted two, leaving all three marks empty. After the fix, the test found the three digit pairs highlighted. Toolbar Copy produced `12\n34\n56` using the textarea’s line offsets. Toolbar Paste with `aa\r\nbb\r\ncc` produced `AaaZ`, `BbbY`, and `CccX` on consecutive lines, and Undo restored the original text. [Editor-mode browser regressions](../../tests/browser/workspace/editor-modes.spec.ts)

The Windows 11 user confirmed that Chrome delivered the Backslash `keyup` with Ctrl held, without a preceding Backslash `keydown`. MARS-ts now toggles rectangular selection once on that release. The footer shows only active modes and stays blank when Ctrl alone is held in an idle editor. An offline Linux Chromium run reproduced the event sequence by withholding the physical keypress at X11. Successive releases turned the mode on and off, a normal press and release toggled it once, and Delete removed `12`, `34`, and `56` from the sample. All six editor browser scenarios passed. [Editor-mode browser regressions](../../tests/browser/workspace/editor-modes.spec.ts)
