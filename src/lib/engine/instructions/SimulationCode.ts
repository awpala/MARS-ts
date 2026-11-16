/* Copyright (c) 2003–2006 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/SimulationCode.java; see MARSlicense.txt. */

/** One instruction's simulation operation; the owning session supplies the implementation. */
export interface SimulationCode<Statement> {
  /** Execute the supplied ProgramStatement; asynchronous host I/O suspends completion. Instruction and host failures propagate to the simulator. */
  simulate(statement: Statement): void | Promise<void>;
}
