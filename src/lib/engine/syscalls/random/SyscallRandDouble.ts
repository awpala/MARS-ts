/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallRandDouble.java; see MARSlicense.txt. */
import { AbstractSyscall } from '../AbstractSyscall.js';
import type { SyscallHost } from '../SyscallHost.js';
import type { ProgramStatement } from '../../assembler/programs/ProgramStatement.js';
import { ProcessingException } from '../../diagnostics/ProcessingException.js';
import { Exceptions } from '../../simulator/Exceptions.js';
import { InvalidRegisterAccessException } from '../../hardware/registers/InvalidRegisterAccessException.js';
/** Canonical RandDouble service using the owning session's Java random streams. */
export class SyscallRandDouble extends AbstractSyscall {
  /** Construct service 44 (RandDouble) for this session. */
  constructor(host: SyscallHost) {
    super(44, 'RandDouble', host);
  }
  /** Execute the canonical random-stream and register behavior. */
  override simulate(statement: ProgramStatement): void {
    try {
      this.host.coprocessor1.setRegisterPairToDouble(
        0,
        this.host.randomStreams.get(this.host.registerFile.getValue(4)).nextDouble()
      );
    } catch (error) {
      if (!(error instanceof InvalidRegisterAccessException)) throw error;
      throw new ProcessingException(
        statement,
        `Internal error storing double to register (syscall ${this.getNumber()})`,
        this.host.exceptionHost,
        Exceptions.SYSCALL_EXCEPTION
      );
    }
  }
}
