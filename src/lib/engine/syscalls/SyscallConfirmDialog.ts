/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallConfirmDialog.java; see MARSlicense.txt. */
import { AbstractDialogSyscall } from './AbstractDialogSyscall.js';
import type { SyscallHost } from './AbstractSyscall.js';
import type { ProgramStatement } from '../assembler/programs/ProgramStatement.js';
/** Canonical ConfirmDialog service; the injected host owns modal presentation and cancellation. */
export class SyscallConfirmDialog extends AbstractDialogSyscall {
  /** Construct service 50 (ConfirmDialog) for this session. */
  constructor(host: SyscallHost) {
    super(50, 'ConfirmDialog', host);
  }
  /** Await dialog completion before the simulator may execute the next instruction. */
  override async simulate(statement: ProgramStatement): Promise<void> {
    const message = this.readString(statement, this.host.registerFile.getValue(4));
    this.host.registerFile.updateRegister(4, await this.host.dialogs.showConfirmDialog(message));
  }
}
