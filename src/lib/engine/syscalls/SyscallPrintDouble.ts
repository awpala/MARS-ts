/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallPrintDouble.java; see MARSlicense.txt. */
import { AbstractSyscall, type SyscallHost } from './AbstractSyscall.js';
/** Canonical PrintDouble service; hardware and I/O remain owned by the injected session. */
export class SyscallPrintDouble extends AbstractSyscall {
  /** Construct service 3 (PrintDouble) for this session. */
  constructor(host: SyscallHost) {
    super(3, 'PrintDouble', host);
  }
  /** Execute the canonical register, memory, console, and error behavior. */
  override simulate(): void {
    this.host.systemIO.printString(
      this.host.systemIO.formatDouble(this.host.coprocessor1.getDoubleFromRegisterPair(12))
    );
  }
}
