/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallMessageDialog.java; see MARSlicense.txt. */
import { AbstractDialogSyscall } from './AbstractDialogSyscall.js';
import type { SyscallHost } from '../SyscallHost.js';
import type { ProgramStatement } from '../../assembler/programs/ProgramStatement.js';
/** Canonical MessageDialog service; the injected host owns modal presentation and cancellation. */
export class SyscallMessageDialog extends AbstractDialogSyscall {
  /** Construct service 55 (MessageDialog) for this session. */
  constructor(host: SyscallHost) {
    super(55, 'MessageDialog', host);
  }
  /** Await dialog completion before the simulator may execute the next instruction. */
  override async simulate(statement: ProgramStatement): Promise<void> {
    const message = this.readString(statement, this.host.registerFile.getValue(4));
    const type = this.host.registerFile.getValue(5);
    await this.host.dialogs.showMessageDialog(message, type < 0 || type > 3 ? -1 : type);
  }
}
