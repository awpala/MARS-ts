/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 * Ports mars/simulator/Exceptions.java. */
import { Binary } from '../formatting/Binary.js';
import { Coprocessor0 } from '../hardware/registers/Coprocessor0.js';
import { RegisterFile } from '../hardware/registers/RegisterFile.js';

/** MIPS cause codes and updates to one session's exception registers. */
export class Exceptions {
  /** Keyboard pending interrupt, encoded before the cause-word shift. */
  static readonly EXTERNAL_INTERRUPT_KEYBOARD = 0x40;
  /** Display pending interrupt, encoded before the cause-word shift. */
  static readonly EXTERNAL_INTERRUPT_DISPLAY = 0x80;
  /** Invalid load address. */
  static readonly ADDRESS_EXCEPTION_LOAD = 4;
  /** Invalid store address. */
  static readonly ADDRESS_EXCEPTION_STORE = 5;
  /** Syscall failure. */
  static readonly SYSCALL_EXCEPTION = 8;
  /** Breakpoint instruction. */
  static readonly BREAKPOINT_EXCEPTION = 9;
  /** Unrecognized instruction. */
  static readonly RESERVED_INSTRUCTION_EXCEPTION = 10;
  /** Signed arithmetic overflow. */
  static readonly ARITHMETIC_OVERFLOW_EXCEPTION = 12;
  /** Trap instruction. */
  static readonly TRAP_EXCEPTION = 13;
  /** Division by zero. */
  static readonly DIVIDE_BY_ZERO_EXCEPTION = 15;
  /** Floating-point overflow. */
  static readonly FLOATING_POINT_OVERFLOW = 16;
  /** Floating-point underflow. */
  static readonly FLOATING_POINT_UNDERFLOW = 17;
  /** Binds exception updates to a session's owned register files. */
  constructor(
    private readonly coprocessor0: Coprocessor0,
    private readonly registerFile: RegisterFile
  ) {}
  /** Updates optional bad address, cause bits, EPC=PC-4, and status EXL in canonical order. */
  setRegisters(cause: number, address?: number): void {
    if (address !== undefined) this.coprocessor0.updateRegister(Coprocessor0.VADDR, address);
    this.coprocessor0.updateRegister(
      Coprocessor0.CAUSE,
      (this.coprocessor0.getValue(Coprocessor0.CAUSE) & 0xfffffc83) | (cause << 2)
    );
    this.coprocessor0.updateRegister(
      Coprocessor0.EPC,
      (this.registerFile.getProgramCounter() - 4) | 0
    );
    this.coprocessor0.updateRegister(
      Coprocessor0.STATUS,
      Binary.setBit(this.coprocessor0.getValue(Coprocessor0.STATUS), Coprocessor0.EXCEPTION_LEVEL)
    );
  }
}
