/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallInputDialogDouble.java; see MARSlicense.txt. */
import { AbstractDialogSyscall } from './AbstractDialogSyscall.js';
import type { SyscallHost } from '../SyscallHost.js';
import type { ProgramStatement } from '../../assembler/programs/ProgramStatement.js';
/** Canonical InputDialogDouble service; the injected host owns modal presentation and cancellation. */
export class SyscallInputDialogDouble extends AbstractDialogSyscall {
  /** Construct service 53 (InputDialogDouble) for this session. */
  constructor(host: SyscallHost) {
    super(53, 'InputDialogDouble', host);
  }
  /** Await dialog completion before the simulator may execute the next instruction. */
  override async simulate(statement: ProgramStatement): Promise<void> {
    await this.readNumber(statement, 'double');
  }
}
