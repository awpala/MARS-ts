/* Copyright (c) 2003–2006 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Number override contract for mars/mips/instructions/SyscallLoader.java; see MARSlicense.txt.
 * Original loader adapted from Bret Barker's GameServer class (Developing Games in Java). */

/** Parsed number override supplied by session configuration. */
export interface SyscallOverride {
  /** Case-sensitive service name. */
  getName(): string;
  /** Signed service number. */
  getNumber(): number;
}
