/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallPrintDouble.java; see MARSlicense.txt. */
import { AbstractSyscall } from '../AbstractSyscall.js';
import type { SyscallHost } from '../SyscallHost.js';
/** Canonical PrintDouble service; hardware and I/O remain owned by the injected session. */
export class SyscallPrintDouble extends AbstractSyscall {
  /** Construct service 3 (PrintDouble) for this session. */
  constructor(host: SyscallHost) {
    super(3, 'PrintDouble', host);
  }
  /** Format the double in $f12/$f13 through the session runtime and print it without changing registers. */
  override simulate(): void {
    this.host.systemIO.printString(
      this.host.systemIO.formatDouble(this.host.coprocessor1.getDoubleFromRegisterPair(12))
    );
  }
}
