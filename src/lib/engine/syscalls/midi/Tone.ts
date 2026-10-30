/* Copyright (c) 2003–2007 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports the Tone class of mars/mips/instructions/syscalls/ToneGenerator.java,
 * developed by Tony Brock; see MARSlicense.txt. */

/** One validated MIDI tone; legacy Tone sends these on channel 0 at 1 tick per millisecond. */
export type Tone = {
  /** MIDI note 0–127, where 60 is middle C. */
  readonly pitch: number;
  /** Non-negative length in milliseconds, unbounded below the signed 32-bit maximum. */
  readonly duration: number;
  /** General MIDI program 0–127, where 0 is Acoustic Grand Piano. */
  readonly instrument: number;
  /** MIDI note-on velocity 0–127, where 0 is silent. */
  readonly volume: number;
};
