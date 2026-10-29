/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallPrintIntUnsigned.java; see MARSlicense.txt. */
import { AbstractSyscall } from '../AbstractSyscall.js';
import type { SyscallHost } from '../SyscallHost.js';
import { Binary } from '../../formatting/Binary.js';
/** Canonical PrintIntUnsigned service; hardware and I/O remain owned by the injected session. */
export class SyscallPrintIntUnsigned extends AbstractSyscall {
  /** Construct service 36 (PrintIntUnsigned) for this session. */
  constructor(host: SyscallHost) {
    super(36, 'PrintIntUnsigned', host);
  }
  /** Execute the canonical register, memory, console, and error behavior. */
  override simulate(): void {
    this.host.systemIO.printString(
      Binary.unsignedIntToIntString(this.host.registerFile.getValue(4))
    );
  }
}
