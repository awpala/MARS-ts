/* Copyright (c) 2003–2006 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/Syscall.java; see MARSlicense.txt. */
import type { ProgramStatement } from '../assembler/programs/ProgramStatement.js';
import type { SimulationCode } from '../instructions/SimulationCode.js';
/** Session-owned service metadata and execution contract; no external resources are owned by the descriptor. */
export interface Syscall extends SimulationCode<ProgramStatement> {
	/** Service name used by canonical number overrides. */
	getName(): string;
	/** Replace the signed service number during session initialization. */
	setNumber(number: number): void;
	/** Current service number selected by the value in $v0. */
	getNumber(): number;
}
