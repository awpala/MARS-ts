/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallExit2.java; see MARSlicense.txt. */
import { AbstractSyscall } from '../AbstractSyscall.js';
import type { SyscallHost } from '../SyscallHost.js';
import { ProcessingException } from '../../diagnostics/ProcessingException.js';
/** GUI Exit2 ignores $a0 and terminates normally, as in the canonical Swing implementation. */
export class SyscallExit2 extends AbstractSyscall {
  /** Construct service 17 (Exit2) for this session. */
  constructor(host: SyscallHost) {
    super(17, 'Exit2', host);
  }
  /** Throw the normal-exit ProcessingException sentinel without reading an exit status or changing registers. */
  override simulate(): void {
    throw new ProcessingException();
  }
}
