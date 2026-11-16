/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallReadInt.java; see MARSlicense.txt. */
import { AbstractReadNumberSyscall } from './AbstractReadNumberSyscall.js';
import type { SyscallHost } from '../SyscallHost.js';
import type { ProgramStatement } from '../../assembler/programs/ProgramStatement.js';
/** Canonical ReadInt service; hardware and I/O remain owned by the injected session. */
export class SyscallReadInt extends AbstractReadNumberSyscall {
  /** Construct service 5 (ReadInt) for this session. */
  constructor(host: SyscallHost) {
    super(5, 'ReadInt', host);
  }
  /** Await a parsed signed integer, then write $v0. Numeric-input failures become syscall diagnostics before the register write. */
  override async simulate(statement: ProgramStatement): Promise<void> {
    const value = await this.readNumber(statement, 'integer');
    this.host.registerFile.updateRegister(2, value);
  }
}
