/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 * Ports mars/mips/hardware/AddressErrorException.java. */
import { Binary } from '../../formatting/Binary.js';

/** An invalid memory address, with the MIPS load/store exception type. */
export class AddressErrorException extends Error {
	private readonly address: number;
	/** Appends the canonical hexadecimal address to the supplied message prefix. */
	constructor(
		message: string,
		private readonly type: number,
		address: number
	) {
		super(message + Binary.intToHexString(address));
		this.name = 'AddressErrorException';
		this.address = address | 0;
	}
	/** Returns the erroneous signed address. */
	getAddress(): number {
		return this.address;
	}
	/** Returns the MIPS exception cause number. */
	getType(): number {
		return this.type;
	}
}
