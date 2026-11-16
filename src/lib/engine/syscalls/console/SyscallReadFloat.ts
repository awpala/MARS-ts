/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallReadFloat.java; see MARSlicense.txt. */
import { AbstractReadNumberSyscall } from './AbstractReadNumberSyscall.js';
import type { SyscallHost } from '../SyscallHost.js';
import type { ProgramStatement } from '../../assembler/programs/ProgramStatement.js';
/** Canonical ReadFloat service; hardware and I/O remain owned by the injected session. */
export class SyscallReadFloat extends AbstractReadNumberSyscall {
  /** Construct service 6 (ReadFloat) for this session. */
  constructor(host: SyscallHost) {
    super(6, 'ReadFloat', host);
  }
  /** Await a parsed float, then write its raw single-precision bits to $f0. Numeric-input failures become syscall diagnostics before the register write. */
  override async simulate(statement: ProgramStatement): Promise<void> {
    const value = await this.readNumber(statement, 'float');
    const bits = new DataView(new ArrayBuffer(4));
    bits.setFloat32(0, value);
    this.host.coprocessor1.updateRegister(0, bits.getInt32(0));
  }
}
