/* Copyright (c) 2003–2007 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Platform host adaptation for the Tone sequencer and EndOfTrackListener of
 * mars/mips/instructions/syscalls/ToneGenerator.java, revised by Max Hailperin; see MARSlicense.txt. */
import type { Tone } from './Tone.js';

/** Platform sound output replacing the javax.sound.midi sequencer and its end-of-track listener. */
export interface ToneGeneratorHost {
  /** Start one tone immediately. Only waitForEnd requests a completion wait; false returns immediately without retaining a waiter. */
  playTone(tone: Tone, waitForEnd: boolean): Promise<void>;
}
