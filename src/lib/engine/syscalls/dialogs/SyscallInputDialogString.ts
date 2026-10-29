/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallInputDialogString.java; see MARSlicense.txt. */
import { AbstractDialogSyscall } from './AbstractDialogSyscall.js';
import type { SyscallHost } from '../SyscallHost.js';
import type { ProgramStatement } from '../../assembler/programs/ProgramStatement.js';
import { AddressErrorException } from '../../hardware/memory/AddressErrorException.js';
import { ProcessingException } from '../../diagnostics/ProcessingException.js';
/** Canonical InputDialogString service; the injected host owns modal presentation and cancellation. */
export class SyscallInputDialogString extends AbstractDialogSyscall {
  /** Construct service 54 (InputDialogString) for this session. */
  constructor(host: SyscallHost) {
    super(54, 'InputDialogString', host);
  }
  /** Await dialog completion before the simulator may execute the next instruction. */
  override async simulate(statement: ProgramStatement): Promise<void> {
    const message = this.readString(statement, this.host.registerFile.getValue(4));
    const input = await this.host.dialogs.showInputDialog(message);
    const address = this.host.registerFile.getValue(5);
    const maxLength = this.host.registerFile.getValue(6);
    try {
      if (input === null) this.host.registerFile.updateRegister(5, -2);
      else if (input.length === 0) this.host.registerFile.updateRegister(5, -3);
      else {
        const limit = (maxLength - 1) | 0;
        for (let i = 0; i < input.length && i < limit; i++)
          this.host.memory.setByte((address + i) | 0, input.charCodeAt(i));
        if (input.length < limit)
          this.host.memory.setByte((address + Math.min(input.length, (maxLength - 2) | 0)) | 0, 10);
        this.host.memory.setByte((address + Math.min((input.length + 1) | 0, limit)) | 0, 0);
        this.host.registerFile.updateRegister(5, input.length > limit ? -4 : 0);
      }
    } catch (error) {
      if (!(error instanceof AddressErrorException)) throw error;
      throw new ProcessingException(statement, error, this.host.exceptionHost);
    }
  }
}
