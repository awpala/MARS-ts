/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallReadChar.java; see MARSlicense.txt. */
import { AbstractSyscall } from '../AbstractSyscall.js';
import type { SyscallHost } from '../SyscallHost.js';
import type { ProgramStatement } from '../../assembler/programs/ProgramStatement.js';
/** Canonical ReadChar service; hardware and I/O remain owned by the injected session. */
export class SyscallReadChar extends AbstractSyscall {
  /** Construct service 12 (ReadChar) for this session. */
  constructor(host: SyscallHost) {
    super(12, 'ReadChar', host);
  }
  /** Await one input character and write its code to $v0; a RangeError from the read becomes a syscall diagnostic before any register write. */
  override async simulate(statement: ProgramStatement): Promise<void> {
    let value: number;
    try {
      value = await this.host.systemIO.readChar(this.getNumber());
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      throw this.syscallException(statement, 'invalid char input');
    }
    this.host.registerFile.updateRegister(2, value);
  }
}
