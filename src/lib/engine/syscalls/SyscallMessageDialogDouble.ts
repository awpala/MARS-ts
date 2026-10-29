/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallMessageDialogDouble.java; see MARSlicense.txt. */
import { AbstractDialogSyscall } from './AbstractDialogSyscall.js';
import type { SyscallHost } from './AbstractSyscall.js';
import type { ProgramStatement } from '../assembler/programs/ProgramStatement.js';
import { InvalidRegisterAccessException } from '../hardware/registers/InvalidRegisterAccessException.js';
import { ProcessingException } from '../diagnostics/ProcessingException.js';
import { Exceptions } from '../simulator/Exceptions.js';
/** Canonical MessageDialogDouble service; the injected host owns modal presentation and cancellation. */
export class SyscallMessageDialogDouble extends AbstractDialogSyscall {
  /** Construct service 58 (MessageDialogDouble) for this session. */
  constructor(host: SyscallHost) {
    super(58, 'MessageDialogDouble', host);
  }
  /** Await dialog completion before the simulator may execute the next instruction. */
  override async simulate(statement: ProgramStatement): Promise<void> {
    const message = this.readString(statement, this.host.registerFile.getValue(4));
    try {
      await this.host.dialogs.showMessageDialog(
        message +
          this.host.systemIO.formatDouble(this.host.coprocessor1.getDoubleFromRegisterPair(12)),
        1
      );
    } catch (error) {
      if (!(error instanceof InvalidRegisterAccessException)) throw error;
      this.host.registerFile.updateRegister(5, -1);
      throw new ProcessingException(
        statement,
        `invalid int reg. access during double input (syscall ${this.getNumber()})`,
        this.host.exceptionHost,
        Exceptions.SYSCALL_EXCEPTION
      );
    }
  }
}
