/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 * Ports mars/mips/hardware/RegisterAccessNotice.java. */
import { AccessNotice, type AccessOrigin } from './AccessNotice.js';

/** Immutable access event for one named register. */
export class RegisterAccessNotice extends AccessNotice {
  /** Captures the register's name and access context. */
  constructor(
    type: number,
    private readonly registerName: string,
    origin: AccessOrigin = 'other'
  ) {
    super(type, origin);
  }
  /** Returns the accessed register's name. */
  getRegisterName(): string {
    return this.registerName;
  }
  /** Returns the legacy diagnostic representation. */
  toString(): string {
    return `${this.getAccessType() === AccessNotice.READ ? 'R' : 'W'} Reg ${this.registerName}`;
  }
}
