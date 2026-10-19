/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 * Ports mars/assembler/DataTypes.java. */

import { Directives } from './Directives.js';

/** MIPS storage widths and value bounds. */
export class DataTypes {
	/** Legacy double size. */
	static readonly DOUBLE_SIZE = 8;
	/** Legacy float size. */
	static readonly FLOAT_SIZE = 4;
	/** Legacy word size. */
	static readonly WORD_SIZE = 4;
	/** Legacy half size. */
	static readonly HALF_SIZE = 2;
	/** Legacy byte size. */
	static readonly BYTE_SIZE = 1;
	/** Legacy char size. */
	static readonly CHAR_SIZE = 1;
	/** Legacy max word value. */
	static readonly MAX_WORD_VALUE = 2147483647;
	/** Legacy min word value. */
	static readonly MIN_WORD_VALUE = -2147483648;
	/** Legacy max half value. */
	static readonly MAX_HALF_VALUE = 32767;
	/** Legacy min half value. */
	static readonly MIN_HALF_VALUE = -32768;
	/** Legacy max uhalf value. */
	static readonly MAX_UHALF_VALUE = 65535;
	/** Legacy min uhalf value. */
	static readonly MIN_UHALF_VALUE = 0;
	/** Legacy max byte value. */
	static readonly MAX_BYTE_VALUE = 127;
	/** Legacy min byte value. */
	static readonly MIN_BYTE_VALUE = -128;
	/** Legacy max float value. */
	static readonly MAX_FLOAT_VALUE = 3.4028234663852886e38;
	/** Legacy low float value. */
	static readonly LOW_FLOAT_VALUE = -3.4028234663852886e38;
	/** Legacy max double value. */
	static readonly MAX_DOUBLE_VALUE = Number.MAX_VALUE;
	/** Legacy low double value. */
	static readonly LOW_DOUBLE_VALUE = -Number.MAX_VALUE;
	/** Returns numeric directive storage size in bytes, or zero. */
	static getLengthInBytes(d: Directives): number {
		if (d === Directives.FLOAT) return this.FLOAT_SIZE;
		if (d === Directives.DOUBLE) return this.DOUBLE_SIZE;
		if (d === Directives.WORD) return this.WORD_SIZE;
		if (d === Directives.HALF) return this.HALF_SIZE;
		if (d === Directives.BYTE) return this.BYTE_SIZE;
		return 0;
	}
	/** Tests integer bounds by default; pass floating=true for Java's double overload. */
	static outOfRange(d: Directives, value: number, floating = false): boolean {
		if (floating)
			return (
				d === Directives.FLOAT && (value < this.LOW_FLOAT_VALUE || value > this.MAX_FLOAT_VALUE)
			);
		return (
			(d === Directives.HALF && (value < this.MIN_HALF_VALUE || value > this.MAX_HALF_VALUE)) ||
			(d === Directives.BYTE && (value < this.MIN_BYTE_VALUE || value > this.MAX_BYTE_VALUE))
		);
	}
}
