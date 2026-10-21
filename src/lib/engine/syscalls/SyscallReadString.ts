/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallReadString.java; see MARSlicense.txt. */
import { AbstractSyscall, type SyscallHost } from './AbstractSyscall.js';
import type { ProgramStatement } from '../assembler/programs/ProgramStatement.js';
import { ProcessingException } from '../diagnostics/ProcessingException.js';
import { AddressErrorException } from '../hardware/memory/AddressErrorException.js';
/** Canonical ReadString service; hardware and I/O remain owned by the injected session. */
export class SyscallReadString extends AbstractSyscall {
  /** Construct service 8 (ReadString) for this session. */
  constructor(host: SyscallHost) {
    super(8, 'ReadString', host);
  }
  /** Execute the canonical register, memory, console, and error behavior. */
  override async simulate(statement: ProgramStatement): Promise<void> {
    const buffer = this.host.registerFile.getValue(4);
    let maxLength = (this.host.registerFile.getValue(5) - 1) | 0;
    let addNullByte = true;
    if (maxLength < 0) {
      maxLength = 0;
      addNullByte = false;
    }
    const input = await this.host.systemIO.readString(this.getNumber(), maxLength);
    let length = Math.min(maxLength, input.length);
    try {
      for (let i = 0; i < length; i++)
        this.host.memory.setByte((buffer + i) | 0, input.charCodeAt(i));
      if (length < maxLength) {
        this.host.memory.setByte((buffer + length) | 0, 10);
        length++;
      }
      if (addNullByte) this.host.memory.setByte((buffer + length) | 0, 0);
    } catch (error) {
      if (!(error instanceof AddressErrorException)) throw error;
      throw new ProcessingException(statement, error, this.host.exceptionHost);
    }
  }
}
