/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallReadDouble.java; see MARSlicense.txt. */
import { AbstractSyscall } from '../AbstractSyscall.js';
import type { SyscallHost } from '../SyscallHost.js';
import type { ProgramStatement } from '../../assembler/programs/ProgramStatement.js';
import { ProcessingException } from '../../diagnostics/ProcessingException.js';
import { Exceptions } from '../../simulator/Exceptions.js';
import { NumberFormatException } from '../../formatting/Binary.js';
import { Binary } from '../../formatting/Binary.js';
/** Canonical ReadDouble service; hardware and I/O remain owned by the injected session. */
export class SyscallReadDouble extends AbstractSyscall {
  /** Construct service 7 (ReadDouble) for this session. */
  constructor(host: SyscallHost) {
    super(7, 'ReadDouble', host);
  }
  /** Execute the canonical register, memory, console, and error behavior. */
  override async simulate(statement: ProgramStatement): Promise<void> {
    let value: number;
    try {
      value = await this.host.systemIO.readDouble(this.getNumber());
    } catch (error) {
      if (!(error instanceof NumberFormatException)) throw error;
      throw new ProcessingException(
        statement,
        `invalid double input (syscall ${this.getNumber()})`,
        this.host.exceptionHost,
        Exceptions.SYSCALL_EXCEPTION
      );
    }
    const bits = new DataView(new ArrayBuffer(8));
    bits.setFloat64(0, value);
    const raw = bits.getBigInt64(0);
    this.host.coprocessor1.updateRegister(1, Binary.highOrderLongToInt(raw));
    this.host.coprocessor1.updateRegister(0, Binary.lowOrderLongToInt(raw));
  }
}
