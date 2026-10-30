/* Copyright (c) 2003–2007 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallMidiOutSync.java, as modified by Max Hailperin; see MARSlicense.txt. */
import type { SyscallHost } from '../SyscallHost.js';
import { AbstractMidiSyscall } from './AbstractMidiSyscall.js';
/** Canonical MidiOutSync service: start a tone and complete when it ends. */
export class SyscallMidiOutSync extends AbstractMidiSyscall {
  /** Construct service 33 (MidiOutSync) for this session. */
  constructor(host: SyscallHost) {
    super(33, 'MidiOutSync', host);
  }
  /** Validate `$a0`–`$a3`, then suspend the current instruction until the host reports the tone's end. */
  override simulate(): void | Promise<void> {
    const tone = this.readTone();
    return this.host.toneGenerator.generateToneSynchronously(
      tone.pitch,
      tone.duration,
      tone.instrument,
      tone.volume
    );
  }
}
