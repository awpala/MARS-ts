/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallReadDouble.java; see MARSlicense.txt. */
import { AbstractReadNumberSyscall } from './AbstractReadNumberSyscall.js';
import type { SyscallHost } from '../SyscallHost.js';
import type { ProgramStatement } from '../../assembler/programs/ProgramStatement.js';
import { Binary } from '../../formatting/Binary.js';
/** Canonical ReadDouble service; hardware and I/O remain owned by the injected session. */
export class SyscallReadDouble extends AbstractReadNumberSyscall {
  /** Construct service 7 (ReadDouble) for this session. */
  constructor(host: SyscallHost) {
    super(7, 'ReadDouble', host);
  }
  /** Await a parsed double, then write its high word to $f1 before its low word to $f0. Numeric-input failures become syscall diagnostics before register writes. */
  override async simulate(statement: ProgramStatement): Promise<void> {
    const value = await this.readNumber(statement, 'double');
    const bits = new DataView(new ArrayBuffer(8));
    bits.setFloat64(0, value);
    const raw = bits.getBigInt64(0);
    this.host.coprocessor1.updateRegister(1, Binary.highOrderLongToInt(raw));
    this.host.coprocessor1.updateRegister(0, Binary.lowOrderLongToInt(raw));
  }
}
