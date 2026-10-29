/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallInputDialogFloat.java; see MARSlicense.txt. */
import { AbstractDialogSyscall } from './AbstractDialogSyscall.js';
import type { SyscallHost } from '../SyscallHost.js';
import type { ProgramStatement } from '../../assembler/programs/ProgramStatement.js';
/** Canonical InputDialogFloat service; the injected host owns modal presentation and cancellation. */
export class SyscallInputDialogFloat extends AbstractDialogSyscall {
  /** Construct service 52 (InputDialogFloat) for this session. */
  constructor(host: SyscallHost) {
    super(52, 'InputDialogFloat', host);
  }
  /** Await dialog completion before the simulator may execute the next instruction. */
  override async simulate(statement: ProgramStatement): Promise<void> {
    await this.readNumber(statement, 'float');
  }
}
