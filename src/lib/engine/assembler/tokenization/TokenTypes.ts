/*
Copyright (c) 2003-2008,  Pete Sanderson and Kenneth Vollmar

Developed by Pete Sanderson (psanderson@otterbein.edu)
and Kenneth Vollmar (kenvollmar@missouristate.edu)

Permission is hereby granted, free of charge, to any person obtaining 
a copy of this software and associated documentation files (the 
"Software"), to deal in the Software without restriction, including 
without limitation the rights to use, copy, modify, merge, publish, 
distribute, sublicense, and/or sell copies of the Software, and to 
permit persons to whom the Software is furnished to do so, subject 
to the following conditions:

The above copyright notice and this permission notice shall be 
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, 
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF 
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. 
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR 
ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF 
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION 
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

(MIT license, http://www.opensource.org/licenses/mit-license.html)
 */
// Ports mars/assembler/TokenTypes.java.

import { Binary, NumberFormatException } from '../../formatting/Binary.js';
import { DataTypes } from '../directives/DataTypes.js';
import { Directives } from '../directives/Directives.js';
import { JavaCharacter } from './JavaCharacter.js';
import { Macro, type MacroRegisters } from '../macros/Macro.js';

/** Session-owned register and instruction lookups used by lexical classification. */
export interface TokenClassificationContext extends MacroRegisters {
	/** The real instruction set's matching operation; null denotes no matching operator. */
	instructionSet: {
		/** Return matching definitions, or null. */
		matchOperator(value: string): object | null;
	};
}

/** Canonical category identities and the legacy ordered token-classification algorithm. */
export class TokenTypes {
	/** Characters that delimit tokens in MIPS source. */
	static readonly TOKEN_DELIMITERS = '\t ,()';
	/** Canonical comment category identity. */
	static readonly COMMENT = new TokenTypes('COMMENT');
	/** Canonical directive category identity. */
	static readonly DIRECTIVE = new TokenTypes('DIRECTIVE');
	/** Canonical operator category identity. */
	static readonly OPERATOR = new TokenTypes('OPERATOR');
	/** Canonical delimiter category identity. */
	static readonly DELIMITER = new TokenTypes('DELIMITER');
	/** Canonical register name category identity. */
	static readonly REGISTER_NAME = new TokenTypes('REGISTER_NAME');
	/** Canonical register number category identity. */
	static readonly REGISTER_NUMBER = new TokenTypes('REGISTER_NUMBER');
	/** Canonical fp register name category identity. */
	static readonly FP_REGISTER_NAME = new TokenTypes('FP_REGISTER_NAME');
	/** Canonical identifier category identity. */
	static readonly IDENTIFIER = new TokenTypes('IDENTIFIER');
	/** Canonical left paren category identity. */
	static readonly LEFT_PAREN = new TokenTypes('LEFT_PAREN');
	/** Canonical right paren category identity. */
	static readonly RIGHT_PAREN = new TokenTypes('RIGHT_PAREN');
	/** Canonical integer 5 category identity. */
	static readonly INTEGER_5 = new TokenTypes('INTEGER_5');
	/** Canonical integer 16 category identity. */
	static readonly INTEGER_16 = new TokenTypes('INTEGER_16');
	/** Canonical integer 16u category identity. */
	static readonly INTEGER_16U = new TokenTypes('INTEGER_16U');
	/** Canonical integer 32 category identity. */
	static readonly INTEGER_32 = new TokenTypes('INTEGER_32');
	/** Canonical real number category identity. */
	static readonly REAL_NUMBER = new TokenTypes('REAL_NUMBER');
	/** Canonical quoted string category identity. */
	static readonly QUOTED_STRING = new TokenTypes('QUOTED_STRING');
	/** Canonical plus category identity. */
	static readonly PLUS = new TokenTypes('PLUS');
	/** Canonical minus category identity. */
	static readonly MINUS = new TokenTypes('MINUS');
	/** Canonical colon category identity. */
	static readonly COLON = new TokenTypes('COLON');
	/** Canonical error category identity. */
	static readonly ERROR = new TokenTypes('ERROR');
	/** Canonical macro parameter category identity. */
	static readonly MACRO_PARAMETER = new TokenTypes('MACRO_PARAMETER');

	private constructor(private readonly descriptor: string) {
		Object.freeze(this);
	}
	/** Return the canonical category name. */
	toString(): string {
		return this.descriptor;
	}

	/** Classify in the original precedence order using the owning session's real lookup services. */
	static matchTokenType(value: string, context: TokenClassificationContext): TokenTypes {
		if (value.length === 0) throw new RangeError('String index out of range: 0');
		if (value.charAt(0) === "'") return this.ERROR;
		if (value.charAt(0) === '#') return this.COMMENT;
		if (value.length === 1) {
			switch (value.charAt(0)) {
				case '(':
					return this.LEFT_PAREN;
				case ')':
					return this.RIGHT_PAREN;
				case ':':
					return this.COLON;
				case '+':
					return this.PLUS;
				case '-':
					return this.MINUS;
			}
		}
		if (Macro.tokenIsMacroParameter(value, false, context)) return this.MACRO_PARAMETER;
		const register = context.registerFile.getUserRegister(value);
		if (register !== null)
			return register.getName() === value ? this.REGISTER_NAME : this.REGISTER_NUMBER;
		if (context.coprocessor1.getRegister(value) !== null) return this.FP_REGISTER_NAME;
		// Most instruction examples contain words, not numbers. Preserve precedence without an exception per word.
		if (Binary.isIntegerCandidate(value)) {
			try {
				const number = Binary.stringToInt(value);
				if (number >= 0 && number <= 31) return this.INTEGER_5;
				if (number >= DataTypes.MIN_UHALF_VALUE && number <= DataTypes.MAX_UHALF_VALUE)
					return this.INTEGER_16U;
				if (number >= DataTypes.MIN_HALF_VALUE && number <= DataTypes.MAX_HALF_VALUE)
					return this.INTEGER_16;
				return this.INTEGER_32;
			} catch (error) {
				if (!(error instanceof NumberFormatException)) throw error;
			}
		}
		if (this.isJavaDouble(value)) return this.REAL_NUMBER;
		if (context.instructionSet.matchOperator(value) !== null) return this.OPERATOR;
		if (value.charAt(0) === '.' && Directives.matchDirective(value) !== null) return this.DIRECTIVE;
		if (value.charAt(0) === '"') return this.QUOTED_STRING;
		if (this.isValidIdentifier(value)) return this.IDENTIFIER;
		return this.ERROR;
	}
	/** Whether the category represents an integer immediate of any supported width. */
	static isIntegerTokenType(type: TokenTypes | null): boolean {
		return (
			type === this.INTEGER_5 ||
			type === this.INTEGER_16 ||
			type === this.INTEGER_16U ||
			type === this.INTEGER_32
		);
	}
	/** Whether the category represents a floating-point literal. */
	static isFloatingTokenType(type: TokenTypes | null): boolean {
		return type === this.REAL_NUMBER;
	}
	/** Test Java UTF-16 identifier rules, including Unicode letters/digits and _, ., $. */
	static isValidIdentifier(value: string): boolean {
		if (value.length === 0) throw new RangeError('String index out of range: 0');
		let result = JavaCharacter.isLetter(value.charAt(0)) || '_.$'.includes(value.charAt(0));
		let index = 1;
		while (result && index < value.length) {
			if (
				!JavaCharacter.isLetterOrDigit(value.charAt(index)) &&
				!'_.$'.includes(value.charAt(index))
			)
				result = false;
			index++;
		}
		return result;
	}
	private static isJavaDouble(value: string): boolean {
		// Only parse success is observed here. Java accepts decimal/hex float grammar,
		// NaN/Infinity, type suffixes, and trim() whitespace, unlike Number/parseFloat.
		let start = 0;
		let end = value.length;
		while (start < end && value.charCodeAt(start) <= 32) start++;
		while (end > start && value.charCodeAt(end - 1) <= 32) end--;
		const trimmed = value.substring(start, end);
		return /^[+-]?(?:NaN|Infinity|(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?[fFdD]?|0[xX](?:[0-9a-fA-F]+(?:\.[0-9a-fA-F]*)?|\.[0-9a-fA-F]+)[pP][+-]?[0-9]+[fFdD]?)$/.test(
			trimmed
		);
	}
}
