/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallPrintString.java; see MARSlicense.txt. */
import { AbstractSyscall, type SyscallHost } from './AbstractSyscall.js';
import type { ProgramStatement } from '../assembler/programs/ProgramStatement.js';
import { ProcessingException } from '../diagnostics/ProcessingException.js';
import { AddressErrorException } from '../hardware/memory/AddressErrorException.js';
/** Canonical PrintString service; hardware and I/O remain owned by the injected session. */
export class SyscallPrintString extends AbstractSyscall {
  /** Construct service 4 (PrintString) for this session. */
  constructor(host: SyscallHost) {
    super(4, 'PrintString', host);
  }
  /** Execute the canonical register, memory, console, and error behavior. */
  override simulate(statement: ProgramStatement): void {
    let address = this.host.registerFile.getValue(4);
    try {
      let character = this.host.memory.getByte(address) & 0xffff;
      while (character !== 0) {
        this.host.systemIO.printString(String.fromCharCode(character));
        address = (address + 1) | 0;
        character = this.host.memory.getByte(address) & 0xffff;
      }
    } catch (error) {
      if (!(error instanceof AddressErrorException)) throw error;
      throw new ProcessingException(statement, error, this.host.exceptionHost);
    }
  }
}
