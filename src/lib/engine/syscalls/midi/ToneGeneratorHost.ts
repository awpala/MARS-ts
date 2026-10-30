/* Copyright (c) 2003–2007 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Platform host adaptation for the Tone sequencer and EndOfTrackListener of
 * mars/mips/instructions/syscalls/ToneGenerator.java, revised by Max Hailperin; see MARSlicense.txt. */
import type { Tone } from './Tone.js';

/** Platform sound output replacing the javax.sound.midi sequencer and its end-of-track listener. */
export interface ToneGeneratorHost {
  /** Start one tone immediately; resolve when its duration has elapsed or the host releases the wait. */
  playTone(tone: Tone): Promise<void>;
}
