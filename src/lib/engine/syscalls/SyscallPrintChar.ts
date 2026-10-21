/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallPrintChar.java; see MARSlicense.txt. */
import { AbstractSyscall, type SyscallHost } from './AbstractSyscall.js';
/** Canonical PrintChar service; hardware and I/O remain owned by the injected session. */
export class SyscallPrintChar extends AbstractSyscall {
  /** Construct service 11 (PrintChar) for this session. */
  constructor(host: SyscallHost) {
    super(11, 'PrintChar', host);
  }
  /** Execute the canonical register, memory, console, and error behavior. */
  override simulate(): void {
    this.host.systemIO.printString(String.fromCharCode(this.host.registerFile.getValue(4) & 0xff));
  }
}
