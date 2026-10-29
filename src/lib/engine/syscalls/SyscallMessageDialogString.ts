/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallMessageDialogString.java; see MARSlicense.txt. */
import { AbstractDialogSyscall } from './AbstractDialogSyscall.js';
import type { SyscallHost } from './AbstractSyscall.js';
import type { ProgramStatement } from '../assembler/programs/ProgramStatement.js';
/** Canonical MessageDialogString service; the injected host owns modal presentation and cancellation. */
export class SyscallMessageDialogString extends AbstractDialogSyscall {
  /** Construct service 59 (MessageDialogString) for this session. */
  constructor(host: SyscallHost) {
    super(59, 'MessageDialogString', host);
  }
  /** Await dialog completion before the simulator may execute the next instruction. */
  override async simulate(statement: ProgramStatement): Promise<void> {
    const message = this.readString(statement, this.host.registerFile.getValue(4));
    const suffix = this.readString(statement, this.host.registerFile.getValue(5));
    await this.host.dialogs.showMessageDialog(message + suffix, 1);
  }
}
