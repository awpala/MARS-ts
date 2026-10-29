/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallRandInt.java; see MARSlicense.txt. */
import { AbstractSyscall, type SyscallHost } from './AbstractSyscall.js';
/** Canonical RandInt service using the owning session's Java random streams. */
export class SyscallRandInt extends AbstractSyscall {
  /** Construct service 41 (RandInt) for this session. */
  constructor(host: SyscallHost) {
    super(41, 'RandInt', host);
  }
  /** Execute the canonical random-stream and register behavior. */
  override simulate(): void {
    this.host.registerFile.updateRegister(
      4,
      this.host.randomStreams.get(this.host.registerFile.getValue(4)).nextInt()
    );
  }
}
