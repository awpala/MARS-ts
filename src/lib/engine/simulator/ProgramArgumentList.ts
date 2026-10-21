/* Copyright (c) 2003-2008, Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports the GUI string constructor and storage algorithm in mars/simulator/ProgramArgumentList.java. */
import type { Memory } from '../hardware/memory/Memory.js';
import type { RegisterFile } from '../hardware/registers/RegisterFile.js';
import { AddressErrorException } from '../hardware/memory/AddressErrorException.js';

/** Runtime arguments stored in a caller-owned machine; construction has no hardware effects. */
export class ProgramArgumentList {
  private readonly arguments: readonly string[];
  /** Parse Java StringTokenizer's five delimiters; quotes and backslashes are literal characters. */
  constructor(args: string) {
    this.arguments = args.split(/[ \t\n\r\f]+/).filter(Boolean);
  }
  /** Write byte-truncated UTF-16 strings, argc/argv, and $sp/$a0/$a1 without recording undo. Address errors become host-visible errors instead of exiting a process. */
  storeProgramArguments(memory: Memory, registers: RegisterFile): void {
    if (this.arguments.length === 0) return;
    let highAddress = memory.stackBaseAddress;
    const starts: number[] = [];
    try {
      for (const argument of this.arguments) {
        memory.set(highAddress, 0, 1);
        highAddress = (highAddress - 1) | 0;
        for (let index = argument.length - 1; index >= 0; index--) {
          memory.set(highAddress, argument.charCodeAt(index), 1);
          highAddress = (highAddress - 1) | 0;
        }
        starts.push((highAddress + 1) | 0);
      }
      let stackAddress = memory.stackPointer;
      if (highAddress < stackAddress) stackAddress = (highAddress - (highAddress % 4) - 4) | 0;
      memory.set(stackAddress, 0, 4);
      stackAddress = (stackAddress - 4) | 0;
      for (let index = starts.length - 1; index >= 0; index--) {
        memory.set(stackAddress, starts[index], 4);
        stackAddress = (stackAddress - 4) | 0;
      }
      memory.set(stackAddress, starts.length, 4);
      registers.getUserRegister('$sp')!.setValue(stackAddress);
      registers.getUserRegister('$a0')!.setValue(starts.length);
      registers.getUserRegister('$a1')!.setValue((stackAddress + 4) | 0);
    } catch (error) {
      if (!(error instanceof AddressErrorException)) throw error;
      throw new Error(
        `Internal Error: Memory write error occurred while storing program arguments! mars.mips.hardware.AddressErrorException: ${error.message}`,
        { cause: error }
      );
    }
  }
}
