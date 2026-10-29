/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallRandFloat.java; see MARSlicense.txt. */
import { AbstractSyscall } from '../AbstractSyscall.js';
import type { SyscallHost } from '../SyscallHost.js';
/** Canonical RandFloat service using the owning session's Java random streams. */
export class SyscallRandFloat extends AbstractSyscall {
  /** Construct service 43 (RandFloat) for this session. */
  constructor(host: SyscallHost) {
    super(43, 'RandFloat', host);
  }
  /** Execute the canonical random-stream and register behavior. */
  override simulate(): void {
    this.host.coprocessor1.setRegisterToFloat(
      0,
      this.host.randomStreams.get(this.host.registerFile.getValue(4)).nextFloat()
    );
  }
}
