/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 * Ports mars/mips/hardware/InvalidRegisterAccessException.java. */

/** Signals use of an odd register for a double-precision pair. */
export class InvalidRegisterAccessException extends Error {
	/** Creates the legacy exception with no detail message. */
	constructor() {
		super();
		this.name = 'InvalidRegisterAccessException';
	}
}
