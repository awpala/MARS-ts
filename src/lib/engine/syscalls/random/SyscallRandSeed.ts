/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallRandSeed.java; see MARSlicense.txt. */
import { AbstractSyscall } from '../AbstractSyscall.js';
import type { SyscallHost } from '../SyscallHost.js';
/** Canonical RandSeed service using the owning session's Java random streams. */
export class SyscallRandSeed extends AbstractSyscall {
  /** Construct service 40 (RandSeed) for this session. */
  constructor(host: SyscallHost) {
    super(40, 'RandSeed', host);
  }
  /** Execute the canonical random-stream and register behavior. */
  override simulate(): void {
    this.host.randomStreams.setSeed(
      this.host.registerFile.getValue(4),
      this.host.registerFile.getValue(5)
    );
  }
}
