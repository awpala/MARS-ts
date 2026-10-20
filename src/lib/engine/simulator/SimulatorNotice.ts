/* Copyright (c) 2003–2009 Pete Sanderson and Kenneth Vollmar. MIT; see MARSlicense.txt.
 * Ports mars/simulator/SimulatorNotice.java. */
import { JavaFloatingPoint } from '../formatting/JavaFloatingPoint.js';

/** Immutable execution start/stop notification carrying the canonical scheduler context. */
export class SimulatorNotice {
	/** Execution is about to initialize its program counter and fetch. */
	static readonly SIMULATOR_START = 0;
	/** Execution is leaving its loop, whether paused or finished. */
	static readonly SIMULATOR_STOP = 1;
	/** Captures action, requested limit, speed, and the Java-notice program counter. */
	constructor(
		private readonly action: number,
		private readonly maxSteps: number,
		private readonly runSpeed: number,
		private readonly programCounter: number
	) {}
	/** Start or stop constant. */
	getAction(): number {
		return this.action;
	}
	/** Requested maximum number of instructions; nonpositive means unlimited. */
	getMaxSteps(): number {
		return this.maxSteps;
	}
	/** Instructions per second; the canonical unlimited sentinel is 40. */
	getRunSpeed(): number {
		return this.runSpeed;
	}
	/** Instruction address supplied by the loop (not necessarily the next architectural PC). */
	getProgramCounter(): number {
		return this.programCounter;
	}
	/** Canonical diagnostic text, including its spacing and integer-valued double suffix. */
	toString(): string {
		const speed =
			this.runSpeed === 40
				? 'unlimited '
				: `${JavaFloatingPoint.formatDouble(this.runSpeed)} inst/sec`;
		return `${this.action === SimulatorNotice.SIMULATOR_START ? 'START ' : 'STOP  '}Max Steps ${this.maxSteps} Speed ${speed}Prog Ctr ${this.programCounter}`;
	}
}
