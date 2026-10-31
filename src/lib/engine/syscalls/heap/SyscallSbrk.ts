/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallSbrk.java; see MARSlicense.txt. */
import { AbstractSyscall } from '../AbstractSyscall.js';
import type { SyscallHost } from '../SyscallHost.js';
import type { ProgramStatement } from '../../assembler/programs/ProgramStatement.js';
/** Canonical Sbrk service; hardware and I/O remain owned by the injected session. */
export class SyscallSbrk extends AbstractSyscall {
  /** Construct service 9 (Sbrk) for this session. */
  constructor(host: SyscallHost) {
    super(9, 'Sbrk', host);
  }
  /** Execute the canonical register, memory, console, and error behavior. */
  override simulate(statement: ProgramStatement): void {
    let address: number;
    try {
      address = this.host.memory.allocateBytesFromHeap(this.host.registerFile.getValue(4));
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'IllegalArgumentException') throw error;
      throw this.syscallException(statement, error.message);
    }
    this.host.registerFile.updateRegister(2, address);
  }
}
