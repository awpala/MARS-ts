/* Copyright (c) 2003–2009 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallMidiOut.java; see MARSlicense.txt. */
import type { SyscallHost } from '../SyscallHost.js';
import { AbstractMidiSyscall } from './AbstractMidiSyscall.js';
/** Canonical MidiOut service: start a tone and return immediately. */
export class SyscallMidiOut extends AbstractMidiSyscall {
  /** Construct service 31 (MidiOut) for this session. */
  constructor(host: SyscallHost) {
    super(31, 'MidiOut', host);
  }
  /** Validate `$a0`–`$a3` and start the tone without waiting for it. */
  override simulate(): void {
    const tone = this.readTone();
    this.host.toneGenerator.generateTone(tone.pitch, tone.duration, tone.instrument, tone.volume);
  }
}
