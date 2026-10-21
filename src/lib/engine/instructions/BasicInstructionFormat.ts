/* Copyright (c) 2003–2006 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/BasicInstructionFormat.java; see MARSlicense.txt. */

/** Identity objects for the canonical machine instruction formats. */
export class BasicInstructionFormat {
  /** Register format. */
  static readonly R_FORMAT = new BasicInstructionFormat();
  /** Immediate format. */
  static readonly I_FORMAT = new BasicInstructionFormat();
  /** Immediate branch format, with PC-relative address interpretation. */
  static readonly I_BRANCH_FORMAT = new BasicInstructionFormat();
  /** Jump format. */
  static readonly J_FORMAT = new BasicInstructionFormat();
  private constructor() {}
}
