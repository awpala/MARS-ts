/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallExit.java; see MARSlicense.txt. */
import { AbstractSyscall, type SyscallHost } from './AbstractSyscall.js';
import { ProcessingException } from '../diagnostics/ProcessingException.js';
/** Canonical Exit service; hardware and I/O remain owned by the injected session. */
export class SyscallExit extends AbstractSyscall {
  /** Construct service 10 (Exit) for this session. */
  constructor(host: SyscallHost) {
    super(10, 'Exit', host);
  }
  /** Execute the canonical register, memory, console, and error behavior. */
  override simulate(): void {
    throw new ProcessingException();
  }
}
