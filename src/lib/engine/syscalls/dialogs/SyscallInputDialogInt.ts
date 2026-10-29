/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallInputDialogInt.java; see MARSlicense.txt. */
import { AbstractDialogSyscall } from './AbstractDialogSyscall.js';
import type { SyscallHost } from '../SyscallHost.js';
import type { ProgramStatement } from '../../assembler/programs/ProgramStatement.js';
/** Canonical InputDialogInt service; the injected host owns modal presentation and cancellation. */
export class SyscallInputDialogInt extends AbstractDialogSyscall {
  /** Construct service 51 (InputDialogInt) for this session. */
  constructor(host: SyscallHost) {
    super(51, 'InputDialogInt', host);
  }
  /** Await dialog completion before the simulator may execute the next instruction. */
  override async simulate(statement: ProgramStatement): Promise<void> {
    await this.readNumber(statement, 'int');
  }
}
