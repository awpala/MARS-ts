/* Copyright (c) 2003–2007 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports the ToneGenerator class of mars/mips/instructions/syscalls/ToneGenerator.java,
 * developed by Tony Brock and revised by Max Hailperin; see MARSlicense.txt. */
import type { ToneGeneratorHost } from './ToneGeneratorHost.js';

/** Session-owned tone service; the optional host owns every audio resource, timer, and teardown. */
export class ToneGenerator {
  /** Default pitch for an out-of-range argument: 60, middle C. */
  static readonly DEFAULT_PITCH = 60;
  /** Default duration for a negative argument: 1000 milliseconds. */
  static readonly DEFAULT_DURATION = 1000;
  /** Default instrument for an out-of-range argument: 0, Acoustic Grand Piano. */
  static readonly DEFAULT_INSTRUMENT = 0;
  /** Default volume for an out-of-range argument: 100 of 127. */
  static readonly DEFAULT_VOLUME = 100;
  /** Bind the optional sound host; without one, tones are silent and synchronous tones return at once, as Java does without a MIDI device. */
  constructor(private readonly host?: ToneGeneratorHost) {}
  /** Start a tone and return immediately; host failures are swallowed as Java's tone thread reports and abandons them. */
  generateTone(pitch: number, duration: number, instrument: number, volume: number): void {
    this.host?.playTone({ pitch, duration, instrument, volume }).catch(() => {});
  }
  /** Start a tone and wait for its end; without a host, or on host failure, return without waiting as Java does. */
  generateToneSynchronously(
    pitch: number,
    duration: number,
    instrument: number,
    volume: number
  ): void | Promise<void> {
    if (!this.host) return;
    return this.host.playTone({ pitch, duration, instrument, volume }).catch(() => {});
  }
}
