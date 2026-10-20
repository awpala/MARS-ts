/* Copyright (c) 2003–2006 Pete Sanderson and Kenneth Vollmar. MIT; see MARSlicense.txt.
 * Ports the private BackStep record in mars/simulator/BackStepper.java. */

/** Canonical undo action identifiers, retained in their Java numeric order. */
export enum BackStepAction {
	/** Restore a word without byte-order conversion. */
	MemoryRawWord = 0,
	/** Restore a word with the configured byte order. */
	MemoryWord = 1,
	/** Restore a halfword. */
	MemoryHalf = 2,
	/** Restore a byte. */
	MemoryByte = 3,
	/** Restore an integer register. */
	Register = 4,
	/** Restore a branch's preincrement program counter. */
	ProgramCounter = 5,
	/** Restore a coprocessor-zero register. */
	Coprocessor0 = 6,
	/** Restore a coprocessor-one register. */
	Coprocessor1 = 7,
	/** Clear a coprocessor-one condition flag. */
	ConditionClear = 8,
	/** Set a coprocessor-one condition flag. */
	ConditionSet = 9,
	/** Keep an instruction with no writes visible while stepping backward. */
	DoNothing = 10
}

/** Session services needed to associate an undo record with its original instruction. */
export interface BackStepContext<Statement> {
	/** Resolve the actual stored statement object without instruction-fetch notification. */
	getStatementNoNotify(address: number): Statement | null;
	/** Whether the current simulated instruction is in a delayed branch slot. */
	inDelaySlot(): boolean;
}

/** Reusable undo record; only the owning circular stack may assign its fields. */
export class BackStep<Statement> {
	/** Kind of restoration. */
	action = BackStepAction.DoNothing;
	/** Original instruction address, or -1 when lookup threw for a GUI edit. */
	pc = 0;
	/** Actual instruction reference used to group all writes of one instruction. */
	ps: Statement | null = null;
	/** First action argument. */
	param1 = 0;
	/** Second action argument. */
	param2 = 0;
	/** Delay-slot state captured with this action. */
	inDelaySlot = false;
	/** Replaces all fields without allocating a new record. */
	assign(
		action: BackStepAction,
		pc: number,
		param1: number,
		param2: number,
		context: BackStepContext<Statement>
	): void {
		this.action = action;
		this.pc = pc | 0;
		try {
			this.ps = context.getStatementNoNotify(this.pc);
		} catch {
			this.ps = null;
			this.pc = -1;
		}
		this.param1 = param1 | 0;
		this.param2 = param2 | 0;
		this.inDelaySlot = context.inDelaySlot();
	}
}
