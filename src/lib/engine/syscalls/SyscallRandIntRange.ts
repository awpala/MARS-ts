/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallRandIntRange.java; see MARSlicense.txt. */
import { AbstractSyscall, type SyscallHost } from './AbstractSyscall.js';
import type { ProgramStatement } from '../assembler/programs/ProgramStatement.js';
import { ProcessingException } from '../diagnostics/ProcessingException.js';
import { Exceptions } from '../simulator/Exceptions.js';
/** Canonical RandIntRange service using the owning session's Java random streams. */
export class SyscallRandIntRange extends AbstractSyscall {
  /** Construct service 42 (RandIntRange) for this session. */
  constructor(host: SyscallHost) {
    super(42, 'RandIntRange', host);
  }
  /** Execute the canonical random-stream and register behavior. */
  override simulate(statement: ProgramStatement): void {
    const stream = this.host.randomStreams.get(this.host.registerFile.getValue(4));
    try {
      this.host.registerFile.updateRegister(4, stream.nextInt(this.host.registerFile.getValue(5)));
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      throw new ProcessingException(
        statement,
        `Upper bound of range cannot be negative (syscall ${this.getNumber()})`,
        this.host.exceptionHost,
        Exceptions.SYSCALL_EXCEPTION
      );
    }
  }
}
