/* Copyright (c) 2003–2009 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Extracts the shared argument validation of mars/mips/instructions/syscalls/SyscallMidiOut.java
 * and SyscallMidiOutSync.java; see MARSlicense.txt. */
import { AbstractSyscall } from '../AbstractSyscall.js';
import type { Tone } from './Tone.js';
import { ToneGenerator } from './ToneGenerator.js';

/** Shared `$a0`–`$a3` tone arguments of the legacy MIDI services; neither service writes registers. */
export abstract class AbstractMidiSyscall extends AbstractSyscall {
  /** Lowest accepted pitch, instrument, and volume. */
  static readonly rangeLowEnd = 0;
  /** Highest accepted pitch, instrument, and volume; duration has no upper limit below the int range. */
  static readonly rangeHighEnd = 127;
  /** Read pitch, duration, instrument, and volume, replacing each out-of-range value with its default before any byte conversion. */
  protected readTone(): Tone {
    const registers = this.host.registerFile;
    const inRange = (value: number) =>
      value >= AbstractMidiSyscall.rangeLowEnd && value <= AbstractMidiSyscall.rangeHighEnd;
    const pitch = registers.getValue(4);
    const duration = registers.getValue(5);
    const instrument = registers.getValue(6);
    const volume = registers.getValue(7);
    return {
      pitch: inRange(pitch) ? pitch : ToneGenerator.DEFAULT_PITCH,
      duration: duration < 0 ? ToneGenerator.DEFAULT_DURATION : duration,
      instrument: inRange(instrument) ? instrument : ToneGenerator.DEFAULT_INSTRUMENT,
      volume: inRange(volume) ? volume : ToneGenerator.DEFAULT_VOLUME
    };
  }
}
