/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallReadFloat.java; see MARSlicense.txt. */
import { AbstractSyscall } from '../AbstractSyscall.js';
import type { SyscallHost } from '../SyscallHost.js';
import type { ProgramStatement } from '../../assembler/programs/ProgramStatement.js';
import { NumberFormatException } from '../../formatting/Binary.js';
/** Canonical ReadFloat service; hardware and I/O remain owned by the injected session. */
export class SyscallReadFloat extends AbstractSyscall {
  /** Construct service 6 (ReadFloat) for this session. */
  constructor(host: SyscallHost) {
    super(6, 'ReadFloat', host);
  }
  /** Execute the canonical register, memory, console, and error behavior. */
  override async simulate(statement: ProgramStatement): Promise<void> {
    let value: number;
    try {
      value = await this.host.systemIO.readFloat(this.getNumber());
    } catch (error) {
      if (!(error instanceof NumberFormatException)) throw error;
      throw this.syscallException(statement, 'invalid float input');
    }
    const bits = new DataView(new ArrayBuffer(4));
    bits.setFloat32(0, value);
    this.host.coprocessor1.updateRegister(0, bits.getInt32(0));
  }
}
