/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Extracts shared algorithms from mars/mips/instructions/syscalls/SyscallConfirmDialog.java,
 * SyscallInputDialog{Int,Float,Double,String}.java, and SyscallMessageDialog*.java; see MARSlicense.txt. */
import { AbstractSyscall } from '../AbstractSyscall.js';
import type { ProgramStatement } from '../../assembler/programs/ProgramStatement.js';
import { AddressErrorException } from '../../hardware/memory/AddressErrorException.js';
import { InvalidRegisterAccessException } from '../../hardware/registers/InvalidRegisterAccessException.js';
import { ProcessingException } from '../../diagnostics/ProcessingException.js';
import { NumberFormatException } from '../../formatting/Binary.js';
import { JavaFloatingPoint } from '../../formatting/JavaFloatingPoint.js';
import { parseInteger } from '../../io/SystemIO.js';
/** Shared byte-message and numeric-input algorithms of the legacy dialog syscalls; state stays with the machine and host. */
export abstract class AbstractDialogSyscall extends AbstractSyscall {
  /** Read Java's byte-to-char message, wrapping memory errors through the current exception host. */
  protected readString(statement: ProgramStatement, address: number): string {
    let text = '';
    try {
      for (
        let ch = this.host.memory.getByte(address) & 0xffff;
        ch !== 0;
        ch = this.host.memory.getByte(address) & 0xffff
      ) {
        text += String.fromCharCode(ch);
        address = (address + 1) | 0;
      }
    } catch (error) {
      if (!(error instanceof AddressErrorException)) throw error;
      throw new ProcessingException(statement, error, this.host.exceptionHost);
    }
    return text;
  }
  /** Suspend for numeric input and retain the canonical result clearing, parse rules, and status/write ordering. */
  protected async readNumber(
    statement: ProgramStatement,
    kind: 'int' | 'float' | 'double'
  ): Promise<void> {
    const input = await this.host.dialogs.showInputDialog(
      this.readString(statement, this.host.registerFile.getValue(4))
    );
    const store = (value: number) => {
      if (kind === 'int') this.host.registerFile.updateRegister(4, value);
      else if (kind === 'float') this.host.coprocessor1.setRegisterToFloat(0, value);
      else this.host.coprocessor1.setRegisterPairToDouble(0, value);
    };
    try {
      if (kind !== 'int') store(0);
      if (input === null || input.length === 0) {
        if (kind === 'int') store(0);
        this.host.registerFile.updateRegister(5, input === null ? -2 : -3);
      } else {
        const value =
          kind === 'int'
            ? parseInteger(input)
            : kind === 'float'
              ? JavaFloatingPoint.parseFloat(input)
              : JavaFloatingPoint.parseDouble(input);
        store(value);
        this.host.registerFile.updateRegister(5, 0);
      }
    } catch (error) {
      if (error instanceof InvalidRegisterAccessException) {
        this.host.registerFile.updateRegister(5, -1);
        throw this.syscallException(statement, 'invalid int reg. access during double input');
      }
      if (!(error instanceof NumberFormatException)) throw error;
      if (kind === 'int') store(0);
      this.host.registerFile.updateRegister(5, -1);
    }
  }
}
