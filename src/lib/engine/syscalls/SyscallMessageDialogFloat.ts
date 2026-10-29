/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallMessageDialogFloat.java; see MARSlicense.txt. */
import { AbstractDialogSyscall } from './AbstractDialogSyscall.js';
import type { SyscallHost } from './AbstractSyscall.js';
import type { ProgramStatement } from '../assembler/programs/ProgramStatement.js';
/** Canonical MessageDialogFloat service; the injected host owns modal presentation and cancellation. */
export class SyscallMessageDialogFloat extends AbstractDialogSyscall {
  /** Construct service 57 (MessageDialogFloat) for this session. */
  constructor(host: SyscallHost) {
    super(57, 'MessageDialogFloat', host);
  }
  /** Await dialog completion before the simulator may execute the next instruction. */
  override async simulate(statement: ProgramStatement): Promise<void> {
    const message = this.readString(statement, this.host.registerFile.getValue(4));
    await this.host.dialogs.showMessageDialog(
      message + this.host.systemIO.formatFloat(this.host.coprocessor1.getFloatFromRegister(12)),
      1
    );
  }
}
