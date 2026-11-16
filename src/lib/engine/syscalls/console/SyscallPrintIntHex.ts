/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallPrintIntHex.java; see MARSlicense.txt. */
import { AbstractSyscall } from '../AbstractSyscall.js';
import type { SyscallHost } from '../SyscallHost.js';
import { Binary } from '../../formatting/Binary.js';
/** Canonical PrintIntHex service; hardware and I/O remain owned by the injected session. */
export class SyscallPrintIntHex extends AbstractSyscall {
  /** Construct service 34 (PrintIntHex) for this session. */
  constructor(host: SyscallHost) {
    super(34, 'PrintIntHex', host);
  }
  /** Print $a0 as eight hexadecimal digits with a 0x prefix without changing registers. */
  override simulate(): void {
    this.host.systemIO.printString(Binary.intToHexString(this.host.registerFile.getValue(4)));
  }
}
