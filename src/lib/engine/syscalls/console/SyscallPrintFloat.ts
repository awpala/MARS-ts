/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallPrintFloat.java; see MARSlicense.txt. */
import { AbstractSyscall } from '../AbstractSyscall.js';
import type { SyscallHost } from '../SyscallHost.js';
/** Canonical PrintFloat service; hardware and I/O remain owned by the injected session. */
export class SyscallPrintFloat extends AbstractSyscall {
  /** Construct service 2 (PrintFloat) for this session. */
  constructor(host: SyscallHost) {
    super(2, 'PrintFloat', host);
  }
  /** Execute the canonical register, memory, console, and error behavior. */
  override simulate(): void {
    this.host.systemIO.printString(
      this.host.systemIO.formatFloat(this.host.coprocessor1.getFloatFromRegister(12))
    );
  }
}
