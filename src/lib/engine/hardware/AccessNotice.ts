/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 * Ports mars/mips/hardware/AccessNotice.java. */

/** Host-supplied execution context replaces Java thread identity. */
export type AccessOrigin = 'gui' | 'mips' | 'other';

/** An immutable access event with explicit origin instead of process thread state. */
export abstract class AccessNotice {
	/** Read access discriminator. */
	static readonly READ = 0;
	/** Write access discriminator. */
	static readonly WRITE = 1;
	/** Validates access type and captures origin at access time. */
	constructor(
		private readonly type: number,
		private readonly origin: AccessOrigin = 'other'
	) {
		if (type !== AccessNotice.READ && type !== AccessNotice.WRITE)
			throw new RangeError('IllegalArgumentException');
	}
	/** Returns READ or WRITE. */
	getAccessType(): number {
		return this.type;
	}
	/** Returns the injected execution context that replaces getThread(). */
	getOrigin(): AccessOrigin {
		return this.origin;
	}
	/** Reports a GUI-originated access. */
	accessIsFromGUI(): boolean {
		return this.origin === 'gui';
	}
	/** Reports an executing MIPS instruction's access. */
	accessIsFromMIPS(): boolean {
		return this.origin === 'mips';
	}
}
