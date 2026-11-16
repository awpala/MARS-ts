/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Extracts the shared input algorithm from mars/mips/instructions/syscalls/
 * SyscallReadInt.java, SyscallReadFloat.java, and SyscallReadDouble.java; see MARSlicense.txt. */
import { AbstractSyscall } from '../AbstractSyscall.js';
import type { ProgramStatement } from '../../assembler/programs/ProgramStatement.js';
import { NumberFormatException } from '../../formatting/Binary.js';

/** Shared numeric console read/error boundary; concrete services retain their canonical register writes. */
export abstract class AbstractReadNumberSyscall extends AbstractSyscall {
  /** Await the session's parser, translating only its numeric-input failure with the current service number. */
  protected async readNumber(
    statement: ProgramStatement,
    kind: 'integer' | 'float' | 'double'
  ): Promise<number> {
    const method =
      kind === 'integer' ? 'readInteger' : kind === 'float' ? 'readFloat' : 'readDouble';
    try {
      return await this.host.systemIO[method](this.getNumber());
    } catch (error) {
      if (!(error instanceof NumberFormatException)) throw error;
      throw this.syscallException(statement, `invalid ${kind} input`);
    }
  }
}
