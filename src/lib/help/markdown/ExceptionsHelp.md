<!-- Derived from help/ExceptionsHelp.html.
Copyright 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt. -->

# Exception Handlers

## Writing and Using MIPS exception handlers in MARS

## Introduction

_Exception handlers_, also known as _trap handlers_ or _interrupt handlers_, can easily be incorporated into a MIPS program. This guide is not intended to be comprehensive but provides the essential information for writing and using exception handlers.

Although the same mechanism services all three, _exceptions_, _traps_ and _interrupts_ are all distinct from each other. Exceptions are caused by exceptional conditions that occur at runtime such as invalid memory address references. Traps are caused by instructions constructed especially for this purpose, listed below. Interrupts are caused by external devices.

MARS partially but not completely implements the exception and interrupt mechanism of SPIM.

## Essential Facts

Some essential facts about writing and using exception handlers include:

- MARS simulates basic elements of the MIPS32 exception mechanism.
- The MIPS instruction set includes a number of instructions that conditionally trigger a trap exception based on the relative values of two registers or of a constant and a register: `teq`, `teqi` (trap if equal), `tne`, `tnei` (trap if not equal), `tge`, `tgeu`, `tgei`, `tgeiu` (trap if greater than or equal), `tlt`, `tltu`, `tlti`, `tltiu` (trap if less than)
- When an exception occurs,

  1. Coprocessor 0 register $12 (status) bit 1 is set
  2. Coprocessor 0 register $13 (cause) bits 2-6 are set to the exception type (codes below)
  3. Coprocessor 0 register $14 (epc) is set to the address of the instruction that triggered the exception
  4. If the exception was caused by an invalid memory address, Coprocessor 0 register $8 (vaddr) is set to the invalid address.
  5. Execution flow jumps to the MIPS instruction at memory location `0x80000180`. This address in the kernel text segment (`.ktext` directive) is the standard MIPS32 exception handler location. Settings → Memory Configuration selects the layout; both compact configurations use `0x00004180` as the exception handler address.

- Include a handler in the same source as the program (as below), use `.include`, or choose Settings → Exception Handler ... to add a handler automatically to every assembly. Use Enable exception handler, select Use a custom exception handler, then Browse to choose a saved browser-library source and press OK. Browse and its filename appear only for the custom choice. Turning inclusion off disables and grays out both radio choices and disables Browse, retaining the selected source. Automatic inclusion defaults to off. The handler is assembled before the program, using its current open-buffer text when available. Opening a handler in another tab alone does not include it. Cancel or Escape discards dialog changes; turning inclusion off retains the chosen file. OK saves the selected filename and enabled state independently, including a file chosen before disabling, and both survive app reload. Changes affect future assemblies, including when made during execution. A missing source is reported at assembly time.
- If there is no instruction at location `0x80000180`, MARS will terminate the MIPS program with an appropriate error message.
- The exception handler can return control to the program using the `eret` instruction. This will place the EPC register $14 value into the Program Counter, so be sure to increment $14 by 4 before returning to skip over the instruction that caused the exception. The `mfc0` and `mtc0` instructions are used to read from and write to Coprocessor 0 registers.
- Bits 8-15 of the Cause register $13 can also be used to indicate pending interrupts. In Java MARS this is used by the Keyboard and Display Simulator Tool (not yet available in MARS-ts), where bit 8 represents a keyboard interrupt and bit 9 represents a display interrupt. For more details, see the Help panel for that Tool.
- Exception types declared in `mars.simulator.Exceptions`, but not necessarily implemented, are ADDRESS\_EXCEPTION\_LOAD (4), ADDRESS\_EXCEPTION\_STORE (5), SYSCALL\_EXCEPTION (8), BREAKPOINT\_EXCEPTION (9), RESERVED\_INSTRUCTION\_EXCEPTION (10), ARITHMETIC\_OVERFLOW\_EXCEPTION (12), TRAP\_EXCEPTION(13), DIVIDE\_BY\_ZERO\_EXCEPTION (15), FLOATING\_POINT\_OVERFLOW (16), and FLOATING\_POINT\_UNDERFLOW (17).
- When writing a non-trivial exception handler, your handler must first save general purpose register contents, then restore them before returning.

## Example of Trap Handler

The sample MIPS program below will immediately generate a trap exception because the trap condition evaluates true, control jumps to the exception handler, the exception handler returns control to the instruction following the one that triggered the exception, then the program terminates normally.

```mips
   .text
main:
   teqi $t0,0     # immediately trap because $t0 contains 0
   li   $v0, 10   # After return from exception handler, specify exit service
   syscall        # terminate normally

# Trap handler in the standard MIPS32 kernel text segment

   .ktext 0x80000180
   move $k0,$v0   # Save $v0 value
   move $k1,$a0   # Save $a0 value
   la   $a0, msg  # address of string to print
   li   $v0, 4    # Print String service
   syscall
   move $v0,$k0   # Restore $v0
   move $a0,$k1   # Restore $a0
   mfc0 $k0,$14   # Coprocessor 0 register $14 has address of trapping instruction
   addi $k0,$k0,4 # Add 4 to point to next instruction
   mtc0 $k0,$14   # Store new address back into $14
   eret           # Error return; set PC to value in $14
   .kdata
msg:
   .asciiz "Trap generated"
```

## Widely Used Exception Handler

Settings → Exception Handler ... offers **Use SPIM default exceptions handler**. This bundled source includes startup code that calls a user-defined global `main` label and assumes the default memory configuration. Its original `.set` directives produce MARS warnings; leave “Assembler warnings are considered errors” off to assemble it.

Open default `exceptions.s` in editor closes the dialog without applying draft settings and opens a locked, read-only reference. You can select, copy, and search its text. Copy to new file creates an editable source containing the full text and James R. Larus’s BSD license notice, which must be retained in copies. Save the modified copy and choose it with Browse to use a customized handler. The original remains read-only after reload. The Exceptions toolbar button opens the same dialog; Memory Configuration is immediately after the ASCII display toggle.

---

Adapted from [MARS help](https://dpetersanderson.github.io/Help/MarsHelpIntro.html). Copyright © 2003–2013 Pete Sanderson and Kenneth Vollmar. [MIT license](../../../../MARSlicense.txt).

[Help index](README.md)
