/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 * Ports mars/mips/hardware/MemoryAccessNotice.java. */
import { AccessNotice, type AccessOrigin } from './AccessNotice.js';

/** An immutable memory access description; all addresses and values are signed word patterns. */
export class MemoryAccessNotice extends AccessNotice {
	private readonly address: number;
	private readonly length: number;
	private readonly value: number;
	/** Captures a word access with three arguments, or a specified byte length with four. */
	constructor(
		type: number,
		address: number,
		lengthOrValue: number,
		value?: number,
		origin: AccessOrigin = 'other'
	) {
		super(type, origin);
		this.address = address | 0;
		this.length = value === undefined ? 4 : lengthOrValue;
		this.value = (value ?? lengthOrValue) | 0;
	}
	/** Returns the signed accessed address. */
	getAddress(): number {
		return this.address;
	}
	/** Returns the access width in bytes. */
	getLength(): number {
		return this.length;
	}
	/** Returns the word pattern read or written. */
	getValue(): number {
		return this.value;
	}
	/** Returns the canonical diagnostic string. */
	toString(): string {
		return `${this.getAccessType() === AccessNotice.READ ? 'R' : 'W'} Mem ${this.address} ${this.length}B = ${this.value}`;
	}
}
